import express from "express";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/connection.js";
import logger from "../lib/logger.js";
import { getUserBalance, updateUserBalance } from "../utils/roomManager.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = express.Router();

// Use JWT authentication middleware for all pix routes
router.use(authenticateToken);

// Pix integration is not active yet - these are stubbed endpoints
const PIX_ENABLED = false;

// Request Pix deposit (creates QR code)
router.post("/deposit/request", async (req: AuthRequest, res) => {
  try {
    if (!PIX_ENABLED) {
      return res.status(503).json({
        error: "Pix integration is not available yet",
        enabled: false,
      });
    }

    const { amount } = req.body;
    const userId = req.userId;

    if (!userId || !amount) {
      return res.status(400).json({ error: "userId and amount are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    if (amount < 1) {
      return res.status(400).json({ error: "Minimum deposit is R$ 1.00" });
    }

    // Check if user exists
    const user = (await query("SELECT id, balance FROM users WHERE id = ?", [
      userId,
    ])) as Array<{ id: string; balance: number }>;

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const transactionId = uuidv4();

    // TODO: Integrate with real Pix provider (e.g., Mercado Pago, PagSeguro, etc.)
    // This is a stub implementation
    const qrCodeData = {
      // In real implementation, this would come from Pix provider
      qrCode: `00020126580014br.gov.bcb.pix0136${transactionId}5204000053039865802BR5925PLATFORM NAME6009SAO PAULO62070503***6304`,
      qrCodeBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      transactionId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    };

    // Create pending transaction
    await query(
      `INSERT INTO pix_transactions 
       (id, user_id, transaction_type, amount, status, qr_code, qr_code_expires_at, balance_before)
       VALUES (?, ?, 'deposit', ?, 'pending', ?, ?, ?)`,
      [
        transactionId,
        userId,
        amount,
        JSON.stringify(qrCodeData),
        qrCodeData.expiresAt,
        user[0].balance,
      ],
    );

    res.json({
      transactionId,
      qrCode: qrCodeData.qrCode,
      qrCodeBase64: qrCodeData.qrCodeBase64,
      expiresAt: qrCodeData.expiresAt,
      amount,
      message: "Pix deposit request created. Scan QR code to complete payment.",
    });
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
      `SELECT id, user_id, amount, status, balance_after, error_message, created_at, updated_at
       FROM pix_transactions 
       WHERE id = ? AND user_id = ? AND transaction_type = 'deposit'`,
      [transactionId, userId],
    )) as Array<{
      id: string;
      user_id: string;
      amount: number;
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
      amount: transaction[0].amount,
      status: transaction[0].status,
      balanceAfter: transaction[0].balance_after,
      errorMessage: transaction[0].error_message,
      createdAt: transaction[0].created_at,
      updatedAt: transaction[0].updated_at,
    });
  } catch (error) {
    logger.error(error, "Error checking Pix deposit status");
    res.status(500).json({ error: "Failed to check deposit status" });
  }
});

// Request Pix withdrawal
router.post("/withdrawal/request", async (req: AuthRequest, res) => {
  try {
    if (!PIX_ENABLED) {
      return res.status(503).json({
        error: "Pix integration is not available yet",
        enabled: false,
      });
    }

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

    // TODO: Integrate with real Pix provider
    // This is a stub implementation
    // In real implementation, this would:
    // 1. Validate Pix key with provider
    // 2. Initiate withdrawal request
    // 3. Update transaction status based on provider response

    // Create pending withdrawal transaction
    await query(
      `INSERT INTO pix_transactions 
       (id, user_id, transaction_type, amount, status, pix_key, balance_before)
       VALUES (?, ?, 'withdrawal', ?, 'pending', ?, ?)`,
      [transactionId, userId, amount, pixKey, userBalance],
    );

    // For now, we'll simulate processing (in real implementation, this would be async)
    // In production, you'd use webhooks from the Pix provider
    setTimeout(async () => {
      try {
        // TODO: Check with Pix provider if withdrawal was successful
        // For now, simulate success after 2 seconds
        const success = true; // This would come from provider

        if (success) {
          // Deduct from balance
          const newBalance = userBalance - amount;
          await updateUserBalance(userId, newBalance);

          // Update transaction
          await query(
            `UPDATE pix_transactions 
             SET status = 'completed', balance_after = ?, pix_transaction_id = ?
             WHERE id = ?`,
            [newBalance, `pix_${transactionId}`, transactionId],
          );

          logger.info(
            `Pix withdrawal completed: ${userId} withdrew ${amount} BRL`,
          );
        } else {
          await query(
            `UPDATE pix_transactions 
             SET status = 'failed', error_message = ?
             WHERE id = ?`,
            ["Withdrawal failed", transactionId],
          );
        }
      } catch (error) {
        logger.error(error, "Error processing Pix withdrawal");
        await query(
          `UPDATE pix_transactions 
           SET status = 'failed', error_message = ?
           WHERE id = ?`,
          ["Internal error processing withdrawal", transactionId],
        );
      }
    }, 2000);

    res.json({
      transactionId,
      amount,
      pixKey: pixKey.replace(/(.{4})(.*)(.{4})/, "$1****$3"), // Mask Pix key
      status: "processing",
      message: "Withdrawal request submitted. Processing...",
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
      amount: number;
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
      amount: transaction[0].amount,
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
      amount: number;
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
        amount: t.amount,
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

