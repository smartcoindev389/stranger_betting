import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";

import { config } from "./config/env.js";
import { setupSocketHandlers } from "./lib/socket-handler.js";
import logger from "./lib/logger.js";
import { testConnection } from "./db/connection.js";
import {
  activeWSConnectionsGauge,
  register,
  totalRequestsCounter,
} from "./lib/monitor.js";

const app = express();
const httpServer = createServer(app);

// CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.writeHead(200, { "Content-Type": register.contentType });
  res.end(await register.metrics());
});

// Admin endpoint - get active rooms
app.get("/admin/rooms", async (req, res) => {
  try {
    const { query } = await import("./db/connection.js");
    const rooms = await query(
      `
      SELECT r.id, r.keyword, r.game_type, r.status, r.created_at,
             COUNT(rp.user_id) as player_count
      FROM rooms r
      LEFT JOIN room_players rp ON r.id = rp.room_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 50
    `,
    );
    res.json(rooms);
  } catch (error) {
    logger.error(error, "Error fetching rooms");
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Admin endpoint - get active users
app.get("/admin/users", async (req, res) => {
  try {
    const { query } = await import("./db/connection.js");
    const users = await query(
      `
      SELECT id, username, created_at, coins
      FROM users
      ORDER BY created_at DESC
      LIMIT 100
    `,
    );
    res.json(users);
  } catch (error) {
    logger.error(error, "Error fetching users");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Initialize database connection and start server
(async () => {
  try {
    await testConnection();
    logger.info("Database connected");

    // Start server
    httpServer.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error(error, "Failed to connect to database");
    logger.error("Please check your database configuration in .env file");
    process.exit(1);
  }
})();
