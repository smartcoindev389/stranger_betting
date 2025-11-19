import { Server } from "socket.io";

let ioInstance: Server | null = null;

export const setSocketInstance = (io: Server): void => {
  ioInstance = io;
};

export const getSocketInstance = (): Server | null => {
  return ioInstance;
};

/**
 * Emit balance update to a specific user
 */
export const emitBalanceUpdate = async (userId: string, newBalance: number): Promise<void> => {
  if (!ioInstance) return;
  
  try {
    // Find all sockets for this user
    const sockets = await ioInstance.fetchSockets();
    const userSockets = sockets.filter(
      (socket) => (socket as any).userId === userId
    );

    // Emit to all user's sockets
    userSockets.forEach((socket) => {
      socket.emit("balance_updated", {
        userId,
        balance: newBalance,
        timestamp: new Date().toISOString(),
      });
      
      // Also emit betting_info update
      socket.emit("betting_info", {
        userBalance: newBalance,
        bettingAmount: 0.25, // Default, will be updated by room if needed
        bettingStatus: "unlocked",
      });
    });
  } catch (error) {
    console.error("Error emitting balance update:", error);
  }
};

/**
 * Emit deposit status update to a specific user
 */
export const emitDepositStatus = async (
  userId: string,
  transactionId: string,
  status: string,
  amount?: number,
  newBalance?: number,
): Promise<void> => {
  if (!ioInstance) return;
  
  try {
    // Find all sockets for this user
    const sockets = await ioInstance.fetchSockets();
    const userSockets = sockets.filter(
      (socket) => (socket as any).userId === userId
    );

    // Emit to all user's sockets
    userSockets.forEach((socket) => {
      socket.emit("deposit_status", {
        transactionId,
        status,
        amount,
        newBalance,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error("Error emitting deposit status:", error);
  }
};

