import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/connection.js";

// WebRTC types
type RTCSdpType = "offer" | "answer" | "pranswer" | "rollback";

type RTCSessionDescriptionInit = {
  type: RTCSdpType;
  sdp?: string;
};

type RTCIceCandidateInit = {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
};
import {
  findWaitingRoom,
  createRoom,
  addPlayerToRoom,
  getRoomPlayers,
  updateRoomStatus,
  removePlayerFromRoom,
  getUserRoom,
  checkPlayerInRoom,
} from "../utils/roomManager.js";
import {
  initializeGame,
  getGameState,
  getGame,
  setGame,
  removeGame,
  validateMove,
  GameType,
} from "../utils/gameManager.js";
import logger from "./logger.js";
import { activeWSConnectionsGauge, totalRequestsCounter } from "./monitor.js";

// Store active games in memory
const userRooms = new Map<string, string>(); // userId -> roomId
const rematchRequests = new Map<string, Set<string>>(); // roomId -> Set of userIds

export const setupSocketHandlers = (io: Server): void => {
  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "User connected");
    totalRequestsCounter.inc();
    activeWSConnectionsGauge.inc();

    // Handle user connection
    socket.on("user_connect", async (data: { username: string }) => {
      try {
        logger.info({ data }, "user_connect received");
        const { username } = data;

        // Create or get user
        let userId: string;
        const existingUser = (await query(
          "SELECT id FROM users WHERE session_id = ?",
          [socket.id],
        )) as Array<{ id: string }>;

        if (existingUser.length > 0) {
          userId = existingUser[0].id;
          logger.info({ userId }, "Found existing user");
          await query("UPDATE users SET session_id = ? WHERE id = ?", [
            socket.id,
            userId,
          ]);
        } else {
          userId = uuidv4();
          logger.info({ userId, username }, "Creating new user");
          await query(
            "INSERT INTO users (id, username, session_id) VALUES (?, ?, ?)",
            [userId, username || `Player_${socket.id.substring(0, 6)}`, socket.id],
          );
        }

        (socket as Socket & { userId: string }).userId = userId;
        socket.emit("connected", { userId, username });
      } catch (error) {
        logger.error(error, "Error in user_connect");
        socket.emit("error", { message: "Failed to connect user" });
      }
    });

    // Handle joining random room
    socket.on("join_random", async (data: { gameType: string }) => {
      try {
        const socketWithUserId = socket as Socket & { userId?: string };
        if (!socketWithUserId.userId) {
          socket.emit("error", {
            message: "User not connected. Please set your username first.",
          });
          return;
        }

        const { gameType } = data;

        // Check if user is already in a room
        const existingRoom = await getUserRoom(socketWithUserId.userId);
        if (existingRoom) {
          const stillInRoom = await checkPlayerInRoom(
            existingRoom.id,
            socketWithUserId.userId,
          );

          if (
            stillInRoom &&
            existingRoom.game_type === gameType &&
            existingRoom.status === "waiting" &&
            existingRoom.player_count < 2
          ) {
            // User is still in a valid waiting room - rejoin socket room
            socket.join(existingRoom.id);
            userRooms.set(socketWithUserId.userId, existingRoom.id);

            // Load and send chat history
            const chatHistory = (await query(
              "SELECT cm.id, cm.user_id, cm.message, cm.created_at, u.username FROM chat_messages cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = ? ORDER BY cm.created_at ASC",
              [existingRoom.id],
            )) as Array<{
              id: string;
              user_id: string;
              message: string;
              created_at: Date;
              username: string;
            }>;

            if (chatHistory.length > 0) {
              socket.emit("chat_history", {
                messages: chatHistory.map((msg) => ({
                  id: msg.id,
                  userId: msg.user_id,
                  username: msg.username,
                  message: msg.message,
                  timestamp: msg.created_at,
                })),
              });
            }

            const players = await getRoomPlayers(existingRoom.id);

            if (players.length === 2) {
              const game = initializeGame(gameType as GameType);
              setGame(existingRoom.id, game);
              await updateRoomStatus(existingRoom.id, "playing");
              const gameState = getGameState(game);
              io.to(existingRoom.id).emit("game_start", {
                roomId: existingRoom.id,
                gameType,
                players,
                gameState,
              });
            } else {
              socket.emit("waiting_for_player", {
                roomId: existingRoom.id,
                players,
              });
            }
            return;
          } else {
            if (stillInRoom) {
              await removePlayerFromRoom(existingRoom.id, socketWithUserId.userId);
            }
            socket.leave(existingRoom.id);
            userRooms.delete(socketWithUserId.userId);
          }
        }

        // Look for waiting room with available slot
        let room = await findWaitingRoom(gameType);

        if (!room) {
          // Create new room
          const roomId = await createRoom(gameType);
          await addPlayerToRoom(roomId, socketWithUserId.userId, true);
          room = { id: roomId, player_count: 1 };
        } else {
          // Join existing room
          const currentPlayers = await getRoomPlayers(room.id);
          if (currentPlayers.length >= 2) {
            // Room already full, create new one
            const roomId = await createRoom(gameType);
            await addPlayerToRoom(roomId, socketWithUserId.userId, true);
            room = { id: roomId, player_count: 1 };
          } else {
            const alreadyInRoom = await checkPlayerInRoom(
              room.id,
              socketWithUserId.userId,
            );
            if (!alreadyInRoom) {
              await addPlayerToRoom(room.id, socketWithUserId.userId, false);
            }
          }
        }

        // Join socket room
        socket.join(room.id);
        userRooms.set(socketWithUserId.userId, room.id);

        // Load and send chat history
        const chatHistory = (await query(
          "SELECT cm.id, cm.user_id, cm.message, cm.created_at, u.username FROM chat_messages cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = ? ORDER BY cm.created_at ASC",
          [room.id],
        )) as Array<{
          id: string;
          user_id: string;
          message: string;
          created_at: Date;
          username: string;
        }>;

        if (chatHistory.length > 0) {
          socket.emit("chat_history", {
            messages: chatHistory.map((msg) => ({
              id: msg.id,
              userId: msg.user_id,
              username: msg.username,
              message: msg.message,
              timestamp: msg.created_at,
            })),
          });
        }

        const players = await getRoomPlayers(room.id);

        if (players.length === 2) {
          const game = initializeGame(gameType as GameType);
          setGame(room.id, game);
          await updateRoomStatus(room.id, "playing");
          const gameState = getGameState(game);
          io.to(room.id).emit("game_start", {
            roomId: room.id,
            gameType,
            players,
            gameState,
          });
        } else {
          socket.emit("waiting_for_player", { roomId: room.id, players });
          socket.to(room.id).emit("player_joined", {
            roomId: room.id,
            players,
          });
        }
      } catch (error) {
        logger.error(error, "Error in join_random");
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Handle joining by keyword
    socket.on(
      "join_keyword",
      async (data: { gameType: string; keyword: string }) => {
        try {
          const socketWithUserId = socket as Socket & { userId?: string };
          if (!socketWithUserId.userId) {
            socket.emit("error", { message: "User not connected" });
            return;
          }

          const { gameType, keyword } = data;
          let room = null;

          // Check if room with keyword exists and has space
          const keywordRooms = (await query(
            "SELECT r.id, r.game_type, r.status, COUNT(rp.user_id) as player_count FROM rooms r LEFT JOIN room_players rp ON r.id = rp.room_id WHERE r.keyword = ? AND r.game_type = ? GROUP BY r.id HAVING player_count < 2",
            [keyword, gameType],
          )) as Array<{
            id: string;
            game_type: string;
            status: string;
            player_count: number;
          }>;

          if (keywordRooms.length > 0) {
            room = keywordRooms[0];
          }

          if (!room) {
            const roomId = await createRoom(gameType, keyword);
            await addPlayerToRoom(roomId, socketWithUserId.userId, true);
            room = { id: roomId, player_count: 0 };
          } else {
            const alreadyInRoom = await checkPlayerInRoom(
              room.id,
              socketWithUserId.userId,
            );
            if (!alreadyInRoom) {
              await addPlayerToRoom(room.id, socketWithUserId.userId, false);
            }
          }

          socket.join(room.id);
          userRooms.set(socketWithUserId.userId, room.id);

          const players = await getRoomPlayers(room.id);

          if (players.length === 2) {
            const game = initializeGame(gameType as GameType);
            setGame(room.id, game);
            await updateRoomStatus(room.id, "playing");
            const gameState = getGameState(game);
            io.to(room.id).emit("game_start", {
              roomId: room.id,
              gameType,
              players,
              gameState,
            });
          } else {
            socket.emit("waiting_for_player", { roomId: room.id, players });
            socket.to(room.id).emit("player_joined", {
              roomId: room.id,
              players,
            });
          }
        } catch (error) {
          logger.error(error, "Error in join_keyword");
          socket.emit("error", { message: "Failed to join room" });
        }
      },
    );

    // Handle player move
    socket.on("player_move", async (data: { gameType: string; move: unknown }) => {
      try {
        const socketWithUserId = socket as Socket & { userId?: string };
        if (!socketWithUserId.userId) {
          socket.emit("error", { message: "User not connected" });
          return;
        }

        const roomId = userRooms.get(socketWithUserId.userId);
        if (!roomId) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const game = getGame(roomId);
        if (!game) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        const players = await getRoomPlayers(roomId);
        const currentPlayerIndex = players.findIndex(
          (p) => p.id === socketWithUserId.userId,
        );
        let playerTeam: string;

        if (data.gameType === "tic_tac_toe") {
          playerTeam = currentPlayerIndex === 0 ? "X" : "O";
        } else if (data.gameType === "checkers") {
          playerTeam = currentPlayerIndex === 0 ? "player1" : "player2";
        } else if (data.gameType === "chess") {
          playerTeam = currentPlayerIndex === 0 ? "w" : "b";
        } else {
          socket.emit("error", { message: "Invalid game type" });
          return;
        }

        const result = validateMove(
          data.gameType as GameType,
          game,
          data.move,
          playerTeam,
        );

        if (!result.valid) {
          socket.emit("error", { message: result.error || "Invalid move" });
          return;
        }

        // Broadcast move to all players in room
        const updatedState = getGameState(game);
        io.to(roomId).emit("move_update", {
          move: data.move,
          gameState: updatedState,
        });

        // Check if game is over
        const gameState = game.getState() as {
          winner?: string;
          isDraw?: boolean;
          winningTeam?: string;
        };

        if (gameState.winner || gameState.isDraw || gameState.winningTeam) {
          await updateRoomStatus(roomId, "finished");

          const winnerId =
            gameState.winner || gameState.winningTeam
              ? players.find((p, idx) => {
                  if (data.gameType === "tic_tac_toe") {
                    return (
                      gameState.winner === (idx === 0 ? "X" : "O")
                    );
                  } else if (data.gameType === "checkers") {
                    return (
                      gameState.winner ===
                      (idx === 0 ? "player1" : "player2")
                    );
                  } else if (data.gameType === "chess") {
                    return (
                      gameState.winningTeam === (idx === 0 ? "w" : "b")
                    );
                  }
                  return false;
                })?.id
              : null;

          const matchId = uuidv4();
          await query(
            `INSERT INTO matches (id, room_id, game_type, winner_id, moves_json, result)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              matchId,
              roomId,
              data.gameType,
              winnerId,
              JSON.stringify([data.move]),
              gameState.isDraw
                ? "draw"
                : winnerId === socketWithUserId.userId
                  ? "win"
                  : "loss",
            ],
          );

          io.to(roomId).emit("game_over", {
            winner: gameState.winner || gameState.winningTeam,
            isDraw: gameState.isDraw,
            gameState: updatedState,
          });
        }
      } catch (error) {
        logger.error(error, "Error in player_move");
        socket.emit("error", { message: "Failed to process move" });
      }
    });

    // Handle chat message
    socket.on("chat_message", async (data: { message: string }) => {
      try {
        const socketWithUserId = socket as Socket & { userId?: string };
        if (!socketWithUserId.userId) {
          socket.emit("error", { message: "User not connected" });
          return;
        }

        const roomId = userRooms.get(socketWithUserId.userId);
        if (!roomId) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const { message } = data;
        const sanitizedMessage = message.substring(0, 500).replace(/<[^>]*>/g, "");

        // Save to database
        const messageId = uuidv4();
        await query(
          "INSERT INTO chat_messages (id, room_id, user_id, message) VALUES (?, ?, ?, ?)",
          [messageId, roomId, socketWithUserId.userId, sanitizedMessage],
        );

        // Get username
        const user = (await query("SELECT username FROM users WHERE id = ?", [
          socketWithUserId.userId,
        ])) as Array<{ username: string }>;
        const username = user[0]?.username || "Unknown";

        // Broadcast to room
        io.to(roomId).emit("chat_message", {
          id: messageId,
          userId: socketWithUserId.userId,
          username,
          message: sanitizedMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error(error, "Error in chat_message");
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle WebRTC offer
    socket.on("webrtc_offer", (data: { offer: RTCSessionDescriptionInit }) => {
      const socketWithUserId = socket as Socket & { userId?: string };
      const roomId = userRooms.get(socketWithUserId.userId || "");
      if (roomId) {
        socket.to(roomId).emit("webrtc_offer", {
          senderId: socketWithUserId.userId,
          offer: data.offer,
        });
      }
    });

    // Handle WebRTC answer
    socket.on("webrtc_answer", (data: { answer: RTCSessionDescriptionInit }) => {
      const socketWithUserId = socket as Socket & { userId?: string };
      const roomId = userRooms.get(socketWithUserId.userId || "");
      if (roomId) {
        socket.to(roomId).emit("webrtc_answer", {
          senderId: socketWithUserId.userId,
          answer: data.answer,
        });
      }
    });

    // Handle ICE candidate
    socket.on("webrtc_ice_candidate", (data: { candidate: RTCIceCandidateInit }) => {
      const socketWithUserId = socket as Socket & { userId?: string };
      const roomId = userRooms.get(socketWithUserId.userId || "");
      if (roomId) {
        socket.to(roomId).emit("webrtc_ice_candidate", {
          senderId: socketWithUserId.userId,
          candidate: data.candidate,
        });
      }
    });

    // Handle rematch request
    socket.on("rematch_request", async (data: { roomId?: string; gameType?: string }) => {
      try {
        const socketWithUserId = socket as Socket & { userId?: string };
        if (!socketWithUserId.userId) return;

        const roomId = data.roomId || userRooms.get(socketWithUserId.userId);
        if (!roomId) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        // Get game type from room
        const roomInfo = (await query(
          "SELECT game_type FROM rooms WHERE id = ?",
          [roomId],
        )) as Array<{ game_type: string }>;
        
        if (roomInfo.length === 0) {
          socket.emit("error", { message: "Room not found" });
          return;
        }

        const gameType = data.gameType || roomInfo[0].game_type;

        if (!rematchRequests.has(roomId)) {
          rematchRequests.set(roomId, new Set());
        }
        rematchRequests.get(roomId)!.add(socketWithUserId.userId);

        const players = await getRoomPlayers(roomId);
        if (rematchRequests.get(roomId)!.size === players.length) {
          const game = initializeGame(gameType as GameType);
          setGame(roomId, game);
          await updateRoomStatus(roomId, "playing");
          rematchRequests.delete(roomId);

          const gameState = getGameState(game);
          io.to(roomId).emit("new_match_start", {
            roomId,
            gameType,
            players,
            gameState,
          });
        } else {
          socket.emit("rematch_pending", { roomId });
        }
      } catch (error) {
        logger.error(error, "Error in rematch_request");
        socket.emit("error", { message: "Failed to request rematch" });
      }
    });

    // Handle leave room
    socket.on("leave_room", async (data: { roomId?: string }) => {
      try {
        const socketWithUserId = socket as Socket & { userId?: string };
        if (!socketWithUserId.userId) return;

        const roomId = data.roomId || userRooms.get(socketWithUserId.userId);
        if (!roomId) {
          logger.warn("User tried to leave room but not in any room");
          return;
        }

        await removePlayerFromRoom(roomId, socketWithUserId.userId);
        socket.leave(roomId);
        userRooms.delete(socketWithUserId.userId);

        const players = await getRoomPlayers(roomId);
        if (players.length === 0) {
          removeGame(roomId);
          rematchRequests.delete(roomId);
          await query("DELETE FROM rooms WHERE id = ?", [roomId]);
        } else {
          const room = (await query("SELECT status FROM rooms WHERE id = ?", [
            roomId,
          ])) as Array<{ status: string }>;
          if (room.length > 0 && room[0].status === "playing") {
            await updateRoomStatus(roomId, "waiting");
          }
          socket.to(roomId).emit("player_left", {
            userId: socketWithUserId.userId,
            players,
          });
        }
      } catch (error) {
        logger.error(error, "Error in leave_room");
      }
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      logger.info({ socketId: socket.id }, "User disconnected");
      activeWSConnectionsGauge.dec();

      const socketWithUserId = socket as Socket & { userId?: string };
      if (socketWithUserId.userId) {
        const roomId = userRooms.get(socketWithUserId.userId);
        if (roomId) {
          await removePlayerFromRoom(roomId, socketWithUserId.userId);
          socket.to(roomId).emit("player_left", {
            userId: socketWithUserId.userId,
          });
          userRooms.delete(socketWithUserId.userId);

          const players = await getRoomPlayers(roomId);
          if (players.length === 0) {
            removeGame(roomId);
            rematchRequests.delete(roomId);
            await query("DELETE FROM rooms WHERE id = ?", [roomId]);
          } else {
            const room = (await query("SELECT status FROM rooms WHERE id = ?", [
              roomId,
            ])) as Array<{ status: string }>;
            if (room.length > 0 && room[0].status === "playing") {
              await updateRoomStatus(roomId, "waiting");
            }
          }
        }
      }
    });
  });
};

