import express from "express";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/connection.js";
import logger from "../lib/logger.js";
import { getUserBalance, updateUserBalance } from "../utils/roomManager.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { config } from "../config/env.js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { emitBalanceUpdate, emitDepositStatus } from "../lib/socket-manager.js";

const router = express.Router();

/**
 * Webhook endpoint for Mercado Pago payment notifications
 * 
 * NOTE: Webhooks are OPTIONAL. The system works without them using polling.
 * The frontend polls /deposit/status every 3 seconds, which checks Mercado Pago API.
 * 
 * To use webhooks (optional, for instant updates):
 * 1. Use ngrok or similar: ngrok http 3001
 * 2. Configure webhook URL in Mercado Pago dashboard: https://your-ngrok-url.ngrok.io/api/pix/webhook
 * 3. Or use your production domain when deployed
 */
router.post("/webhook", express.json(), async (req, res) => {
  try {
    if (!config.mercadoPago.accessToken) {
      return res.status(503).json({ error: "Pix integration not configured" });
    }

    // Mercado Pago webhook sends: { type: "payment", data: { id: "123" } }
    const paymentId = req.body?.data?.id;

    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID is required" });
    }

    // Get payment details from Mercado Pago
    if (!paymentClient) {
      return res.status(503).json({ error: "Mercado Pago SDK not initialized" });
    }
    const payment = await paymentClient.get({ id: Number(paymentId) });
    const paymentData = payment;

    // Find transaction by Mercado Pago payment ID
    const transaction = (await query(
      `SELECT id, user_id, amount, status
       FROM pix_transactions 
       WHERE pix_transaction_id = ? AND transaction_type = 'deposit'`,
      [String(paymentId)],
    )) as Array<{
      id: string;
      user_id: string;
      amount: number | string;
      status: string;
    }>;

    if (transaction.length === 0) {
      logger.warn(`Webhook received for unknown payment: ${paymentId}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    const tx = transaction[0];

    // Only process if payment status changed
    if (paymentData.status === "approved" && tx.status !== "completed") {
      const amount = typeof tx.amount === "number" ? tx.amount : Number(tx.amount);
      const userBalance = await getUserBalance(tx.user_id);
      const newBalance = userBalance + amount;

      await updateUserBalance(tx.user_id, newBalance);
      await query(
        `UPDATE pix_transactions 
         SET status = 'completed', balance_after = ?, updated_at = NOW()
         WHERE id = ?`,
        [newBalance, tx.id],
      );

      // Emit real-time balance update via socket
      await emitBalanceUpdate(tx.user_id, newBalance);
      await emitDepositStatus(tx.user_id, tx.id, "completed", amount, newBalance);

      logger.info(
        `Pix deposit completed via webhook: ${tx.user_id} - Amount: ${amount} - Payment ID: ${paymentId} - New balance: ${newBalance}`,
      );
    } else if (paymentData.status === "rejected" && tx.status !== "failed") {
      await query(
        `UPDATE pix_transactions 
         SET status = 'failed', error_message = ?, updated_at = NOW()
         WHERE id = ?`,
        [paymentData.status_detail || "Payment was rejected", tx.id],
      );

      await emitDepositStatus(tx.user_id, tx.id, "failed");

      logger.info(
        `Pix deposit rejected via webhook: ${tx.user_id} - Payment ID: ${paymentId}`,
      );
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(error, "Error processing webhook");
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// Use JWT authentication middleware for all other pix routes
router.use(authenticateToken);

// Initialize Mercado Pago (v2 SDK)
let mercadoPagoClient: MercadoPagoConfig | null = null;
let paymentClient: Payment | null = null;

const accessToken = config.mercadoPago.accessToken;
if (accessToken && accessToken.trim() !== "") {
  try {
    mercadoPagoClient = new MercadoPagoConfig({ accessToken });
    paymentClient = new Payment(mercadoPagoClient);
    logger.info("Mercado Pago SDK v2 initialized successfully");
  } catch (error) {
    logger.error(error, "Failed to initialize Mercado Pago SDK");
  }
} else {
  logger.warn("Mercado Pago access token not configured or empty");
  logger.warn("Please set MERCADO_PAGO_ACCESS_TOKEN in your .env file and restart the server");
}

/**
 * Validate Mercado Pago error and extract error message and status
 * Handles both v1 and v2 SDK error formats
 */
function validateError(error: any): { errorMessage: string; errorStatus: number } {
  let errorMessage = "Unknown error cause";
  let errorStatus = 400;

  // v2 SDK error format
  if (error.message) {
    errorMessage = error.message;
  }

  // v1 SDK error format (legacy)
  if (error.cause) {
    const sdkErrorMessage = error.cause[0]?.description;
    if (sdkErrorMessage) {
      errorMessage = sdkErrorMessage;
    }
  }

  // Extract status code
  if (error.status) {
    errorStatus = error.status;
  } else if (error.statusCode) {
    errorStatus = error.statusCode;
  }

  return { errorMessage, errorStatus };
}

// Request Pix deposit (creates QR code)
router.post("/deposit/request", async (req: AuthRequest, res) => {
  try {
    const accessToken = config.mercadoPago.accessToken;
    logger.info(`Deposit request - Access token present: ${!!accessToken}, length: ${accessToken?.length || 0}`);
    
    if (!accessToken || accessToken.trim() === "") {
      logger.warn("Mercado Pago access token is missing or empty");
      return res.status(503).json({
        error: "Pix integration is not configured. Please set MERCADO_PAGO_ACCESS_TOKEN in your .env file",
        enabled: false,
        message: "The server cannot find the Mercado Pago access token. Please check your .env file and restart the server.",
      });
    }

    const { amount, payer } = req.body;
    const userId = req.userId;

    logger.info(`Deposit request received - userId: ${userId}, amount: ${amount}, body:`, req.body);

    if (!userId) {
      logger.warn("Deposit request missing userId");
      return res.status(400).json({ error: "userId is required. Please ensure you are authenticated." });
    }

    if (!amount) {
      logger.warn("Deposit request missing amount");
      return res.status(400).json({ error: "amount is required" });
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum)) {
      logger.warn(`Deposit request invalid amount: ${amount}`);
      return res.status(400).json({ error: "amount must be a valid number" });
    }

    if (amountNum <= 0) {
      logger.warn(`Deposit request amount too low: ${amountNum}`);
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    if (amountNum < 1) {
      logger.warn(`Deposit request below minimum: ${amountNum}`);
      return res.status(400).json({ error: "Minimum deposit is R$ 1.00" });
    }

    // Get user info from database
    const user = (await query(
      "SELECT id, username, email, balance FROM users WHERE id = ?",
      [userId],
    )) as Array<{
      id: string;
      username: string;
      email: string | null;
      balance: number | string;
    }>;

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = user[0];
    const userBalance =
      typeof userData.balance === "number"
        ? userData.balance
        : Number(userData.balance || 0);

    // Extract payer info from request or use defaults from user
    const payerEmail =
      payer?.email || userData.email || `${userData.username}@example.com`;
    const payerFirstName = payer?.firstName || userData.username.split(" ")[0] || "User";
    const payerLastName =
      payer?.lastName || userData.username.split(" ").slice(1).join(" ") || "Name";
    const identificationType = payer?.identification?.type || "CPF";
    const identificationNumber =
      payer?.identification?.number || "00000000000";

    const transactionId = uuidv4();

    // Create payment request with Mercado Pago
    const paymentData = {
      payment_method_id: "pix",
      description: `Deposit to account - ${userData.username}`,
      transaction_amount: Number(amount),
      payer: {
        email: payerEmail,
        first_name: payerFirstName,
        last_name: payerLastName,
        identification: {
          type: identificationType,
          number: identificationNumber,
        },
      },
    };

    try {
      // Check if Mercado Pago is initialized
      if (!paymentClient) {
        throw new Error("Mercado Pago SDK not initialized");
      }
      
      const paymentResponse = await paymentClient.create({ body: paymentData });
      const response = paymentResponse;

      // Extract QR code data
      const qrCode =
        response.point_of_interaction?.transaction_data?.qr_code || "";
      const qrCodeBase64 =
        response.point_of_interaction?.transaction_data?.qr_code_base64 || "";

      // Calculate expiration (usually 30 minutes for Pix)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // Check for duplicate payment ID to prevent double processing
      const existingTx = (await query(
        `SELECT id FROM pix_transactions WHERE pix_transaction_id = ?`,
        [String(response.id)],
      )) as Array<{ id: string }>;

      if (existingTx.length > 0) {
        logger.warn(
          `Duplicate payment ID detected: ${response.id} - Transaction already exists`,
        );
        return res.status(409).json({
          error: "This payment has already been processed",
          transactionId: existingTx[0].id,
        });
      }

      // Store transaction in database
      await query(
        `INSERT INTO pix_transactions 
         (id, user_id, transaction_type, amount, status, pix_transaction_id, qr_code, qr_code_expires_at, balance_before)
         VALUES (?, ?, 'deposit', ?, 'pending', ?, ?, ?, ?)`,
        [
          transactionId,
          userId,
          amount,
          String(response.id),
          qrCode,
          expiresAt,
          userBalance,
        ],
      );

      // Emit deposit status to user
      await emitDepositStatus(userId, transactionId, "pending", amount);

      logger.info(
        `Pix deposit request created: ${userId} - Amount: ${amount} - Payment ID: ${response.id} - Transaction ID: ${transactionId}`,
      );

      res.status(201).json({
        transactionId,
        paymentId: response.id,
        status: response.status,
        detail: response.status_detail,
        qrCode,
        qrCodeBase64,
        expiresAt,
        amount,
        message: "Pix deposit request created. Scan QR code to complete payment.",
      });
    } catch (error: any) {
      logger.error(error, "Mercado Pago payment creation error");
      const { errorMessage, errorStatus } = validateError(error);
      res.status(errorStatus).json({ error_message: errorMessage });
    }
  } catch (error) {
    logger.error(error, "Error in Pix deposit request");
    res.status(500).json({ error: "Failed to create Pix deposit request" });
  }
});

// Check deposit status
router.get("/deposit/status/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const transaction = (await query(
      `SELECT id, user_id, amount, status, pix_transaction_id, balance_after, error_message, created_at, updated_at
       FROM pix_transactions 
       WHERE id = ? AND user_id = ? AND transaction_type = 'deposit'`,
      [transactionId, userId],
    )) as Array<{
      id: string;
      user_id: string;
      amount: number | string;
      status: string;
      pix_transaction_id: string | null;
      balance_after: number | null;
      error_message: string | null;
      created_at: Date;
      updated_at: Date;
    }>;

    if (transaction.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const tx = transaction[0];

    // If we have a Mercado Pago payment ID, check status with Mercado Pago
    if (tx.pix_transaction_id && paymentClient) {
      try {
        const payment = await paymentClient.get({ id: Number(tx.pix_transaction_id) });
        const paymentStatus = payment.status;

        // Update local status if it changed
        if (paymentStatus === "approved" && tx.status !== "completed") {
          // Payment was approved, update balance
          const amount =
            typeof tx.amount === "number" ? tx.amount : Number(tx.amount);
          const userBalance = await getUserBalance(userId as string);
          const newBalance = userBalance + amount;

          await updateUserBalance(userId as string, newBalance);
          await query(
            `UPDATE pix_transactions 
             SET status = 'completed', balance_after = ?, updated_at = NOW()
             WHERE id = ?`,
            [newBalance, transactionId],
          );

          // Emit real-time balance update via socket
          await emitBalanceUpdate(userId as string, newBalance);
          await emitDepositStatus(userId as string, transactionId, "completed", amount, newBalance);

          logger.info(
            `Pix deposit completed: ${userId} - Amount: ${amount} - New balance: ${newBalance}`,
          );
        } else if (paymentStatus === "rejected" && tx.status !== "failed") {
          await query(
            `UPDATE pix_transactions 
             SET status = 'failed', error_message = ?, updated_at = NOW()
             WHERE id = ?`,
            ["Payment was rejected", transactionId],
          );

          await emitDepositStatus(userId as string, transactionId, "failed");
        }

        // Return updated status
        const updatedTx = (await query(
          `SELECT status, balance_after, error_message, updated_at
           FROM pix_transactions WHERE id = ?`,
          [transactionId],
        )) as Array<{
          status: string;
          balance_after: number | null;
          error_message: string | null;
          updated_at: Date;
        }>;

        if (updatedTx.length > 0) {
          return res.json({
            transactionId: tx.id,
            amount: typeof tx.amount === "number" ? tx.amount : Number(tx.amount),
            status: updatedTx[0].status,
            balanceAfter: updatedTx[0].balance_after,
            errorMessage: updatedTx[0].error_message,
            createdAt: tx.created_at,
            updatedAt: updatedTx[0].updated_at,
          });
        }
      } catch (error) {
        logger.error(error, "Error checking payment status with Mercado Pago");
        // Continue to return local status
      }
    }

    res.json({
      transactionId: tx.id,
      amount: typeof tx.amount === "number" ? tx.amount : Number(tx.amount),
      status: tx.status,
      balanceAfter: tx.balance_after,
      errorMessage: tx.error_message,
      createdAt: tx.created_at,
      updatedAt: tx.updated_at,
    });
  } catch (error) {
    logger.error(error, "Error checking Pix deposit status");
    res.status(500).json({ error: "Failed to check deposit status" });
  }
});


// Request Pix withdrawal
router.post("/withdrawal/request", async (req: AuthRequest, res) => {
  try {
    const { amount, pixKey } = req.body;
    const userId = req.userId;

    if (!userId || !amount || !pixKey) {
      return res
        .status(400)
        .json({ error: "userId, amount, and pixKey are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    if (amount < 1) {
      return res.status(400).json({ error: "Minimum withdrawal is R$ 1.00" });
    }

    // Validate Pix key format (basic validation)
    const pixKeyRegex = /^[a-zA-Z0-9@.\-+() ]+$/;
    if (!pixKeyRegex.test(pixKey) || pixKey.length < 3) {
      return res.status(400).json({
        error: "Invalid Pix key format",
      });
    }

    // Check user balance
    const userBalance = await getUserBalance(userId);
    if (userBalance < amount) {
      return res.status(400).json({
        error: "Insufficient balance",
        currentBalance: userBalance,
      });
    }

    // Check if user exists
    const user = (await query("SELECT id FROM users WHERE id = ?", [
      userId,
    ])) as Array<{ id: string }>;

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const transactionId = uuidv4();

    // Note: Mercado Pago doesn't directly support Pix withdrawals via the same API
    // This would typically require a separate integration or manual processing
    // For now, we'll create a pending transaction that needs manual processing
    // or integration with a withdrawal service

    // Create pending withdrawal transaction
    await query(
      `INSERT INTO pix_transactions 
       (id, user_id, transaction_type, amount, status, pix_key, balance_before)
       VALUES (?, ?, 'withdrawal', ?, 'pending', ?, ?)`,
      [transactionId, userId, amount, pixKey, userBalance],
    );

    // TODO: Integrate with withdrawal service or manual processing
    // For now, this requires manual approval/processing

    res.json({
      transactionId,
      amount,
      pixKey: pixKey.replace(/(.{4})(.*)(.{4})/, "$1****$3"), // Mask Pix key
      status: "pending",
      message:
        "Withdrawal request submitted. It will be processed manually or via withdrawal service integration.",
    });
  } catch (error) {
    logger.error(error, "Error in Pix withdrawal request");
    res.status(500).json({ error: "Failed to create Pix withdrawal request" });
  }
});

// Check withdrawal status
router.get("/withdrawal/status/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const transaction = (await query(
      `SELECT id, user_id, amount, status, balance_after, error_message, created_at, updated_at
       FROM pix_transactions 
       WHERE id = ? AND user_id = ? AND transaction_type = 'withdrawal'`,
      [transactionId, userId],
    )) as Array<{
      id: string;
      user_id: string;
      amount: number | string;
      status: string;
      balance_after: number | null;
      error_message: string | null;
      created_at: Date;
      updated_at: Date;
    }>;

    if (transaction.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({
      transactionId: transaction[0].id,
      amount:
        typeof transaction[0].amount === "number"
          ? transaction[0].amount
          : Number(transaction[0].amount),
      status: transaction[0].status,
      balanceAfter: transaction[0].balance_after,
      errorMessage: transaction[0].error_message,
      createdAt: transaction[0].created_at,
      updatedAt: transaction[0].updated_at,
    });
  } catch (error) {
    logger.error(error, "Error checking Pix withdrawal status");
    res.status(500).json({ error: "Failed to check withdrawal status" });
  }
});

// Check if Pix is enabled/configured
router.get("/status", async (req: AuthRequest, res) => {
  try {
    const isEnabled = !!config.mercadoPago.accessToken;
    res.json({
      enabled: isEnabled,
      configured: isEnabled,
      message: isEnabled
        ? "Pix integration is active"
        : "Pix integration is not configured. Please set MERCADO_PAGO_ACCESS_TOKEN",
    });
  } catch (error) {
    logger.error(error, "Error checking Pix status");
    res.status(500).json({ error: "Failed to check Pix status" });
  }
});

// Get user balance
router.get("/balance", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const balance = await getUserBalance(userId);

    res.json({
      userId,
      balance,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(error, "Error fetching user balance");
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// Get user's Pix transactions history
router.get("/transactions", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const transactions = (await query(
      `SELECT id, transaction_type, amount, status, pix_key, balance_after, error_message, created_at, updated_at
       FROM pix_transactions 
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    )) as Array<{
      id: string;
      transaction_type: string;
      amount: number | string;
      status: string;
      pix_key: string | null;
      balance_after: number | null;
      error_message: string | null;
      created_at: Date;
      updated_at: Date;
    }>;

    res.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.transaction_type,
        amount: typeof t.amount === "number" ? t.amount : Number(t.amount),
        status: t.status,
        pixKey: t.pix_key
          ? t.pix_key.replace(/(.{4})(.*)(.{4})/, "$1****$3")
          : null,
        balanceAfter: t.balance_after,
        errorMessage: t.error_message,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
    });
  } catch (error) {
    logger.error(error, "Error fetching Pix transactions");
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Update user's Pix key
router.post("/pix-key", async (req: AuthRequest, res) => {
  try {
    const { pixKey } = req.body;
    const userId = req.userId;

    if (!userId || !pixKey) {
      return res.status(400).json({ error: "userId and pixKey are required" });
    }

    // Validate Pix key format
    const pixKeyRegex = /^[a-zA-Z0-9@.\-+() ]+$/;
    if (!pixKeyRegex.test(pixKey) || pixKey.length < 3) {
      return res.status(400).json({
        error: "Invalid Pix key format",
      });
    }

    // Check if user exists
    const user = (await query("SELECT id FROM users WHERE id = ?", [
      userId,
    ])) as Array<{ id: string }>;

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update Pix key
    await query("UPDATE users SET pix_key = ? WHERE id = ?", [pixKey, userId]);

    res.json({
      message: "Pix key updated successfully",
      pixKey: pixKey.replace(/(.{4})(.*)(.{4})/, "$1****$3"), // Mask for response
    });
  } catch (error) {
    logger.error(error, "Error updating Pix key");
    res.status(500).json({ error: "Failed to update Pix key" });
  }
});

// Get user's Pix key (masked)
router.get("/pix-key/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = (await query("SELECT pix_key FROM users WHERE id = ?", [
      userId,
    ])) as Array<{ pix_key: string | null }>;

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const pixKey = user[0].pix_key;
    res.json({
      pixKey: pixKey ? pixKey.replace(/(.{4})(.*)(.{4})/, "$1****$3") : null,
      hasPixKey: !!pixKey,
    });
  } catch (error) {
    logger.error(error, "Error fetching Pix key");
    res.status(500).json({ error: "Failed to fetch Pix key" });
  }
});

export default router;
