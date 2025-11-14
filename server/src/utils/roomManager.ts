import { v4 as uuidv4 } from "uuid";
import { query } from "../db/connection.js";

export interface RoomPlayer {
  id: string;
  username: string;
  isHost: boolean;
}

export const findWaitingRoom = async (
  gameType: string,
): Promise<{ id: string; player_count: number } | null> => {
  const sql = `
    SELECT r.id, COUNT(rp.user_id) as player_count
    FROM rooms r
    INNER JOIN room_players rp ON r.id = rp.room_id
    WHERE r.game_type = ? AND r.status = 'waiting'
    GROUP BY r.id
    HAVING player_count = 1
    ORDER BY r.created_at ASC
    LIMIT 1
  `;

  const results = (await query(sql, [gameType])) as Array<{
    id: string;
    player_count: number;
  }>;

  return results.length > 0 ? results[0] : null;
};

export const createRoom = async (
  gameType: string,
  keyword: string | null = null,
): Promise<string> => {
  const roomId = uuidv4();

  const sql = `
    INSERT INTO rooms (id, keyword, game_type, status)
    VALUES (?, ?, ?, 'waiting')
  `;

  await query(sql, [roomId, keyword, gameType]);
  return roomId;
};

export const addPlayerToRoom = async (
  roomId: string,
  userId: string,
  isHost = false,
): Promise<void> => {
  const id = uuidv4();

  const sql = `
    INSERT INTO room_players (id, room_id, user_id, is_host)
    VALUES (?, ?, ?, ?)
  `;

  await query(sql, [id, roomId, userId, isHost]);
};

export const getRoomPlayers = async (
  roomId: string,
): Promise<RoomPlayer[]> => {
  const sql = `
    SELECT u.id, u.username, rp.is_host
    FROM room_players rp
    JOIN users u ON rp.user_id = u.id
    WHERE rp.room_id = ?
  `;

  const results = (await query(sql, [roomId])) as Array<{
    id: string;
    username: string;
    is_host: boolean;
  }>;

  return results.map((r) => ({
    id: r.id,
    username: r.username,
    isHost: r.is_host,
  }));
};

export const updateRoomStatus = async (
  roomId: string,
  status: "waiting" | "playing" | "finished",
): Promise<void> => {
  const sql = `UPDATE rooms SET status = ? WHERE id = ?`;
  await query(sql, [status, roomId]);
};

export const removePlayerFromRoom = async (
  roomId: string,
  userId: string,
): Promise<void> => {
  const sql = `DELETE FROM room_players WHERE room_id = ? AND user_id = ?`;
  await query(sql, [roomId, userId]);
};

export const getUserRoom = async (
  userId: string,
): Promise<{ id: string; game_type: string; status: string; player_count: number } | null> => {
  const sql = `
    SELECT r.id, r.game_type, r.status, COUNT(rp.user_id) as player_count
    FROM room_players rp
    JOIN rooms r ON rp.room_id = r.id
    WHERE rp.user_id = ?
    GROUP BY r.id
    LIMIT 1
  `;
  const results = (await query(sql, [userId])) as Array<{
    id: string;
    game_type: string;
    status: string;
    player_count: number;
  }>;
  return results.length > 0 ? results[0] : null;
};

export const checkPlayerInRoom = async (
  roomId: string,
  userId: string,
): Promise<boolean> => {
  const sql = `SELECT id FROM room_players WHERE room_id = ? AND user_id = ?`;
  const results = (await query(sql, [roomId, userId])) as Array<{ id: string }>;
  return results.length > 0;
};

