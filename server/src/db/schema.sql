-- Database: real_skills

CREATE DATABASE IF NOT EXISTS real_skills;
USE real_skills;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    session_id VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    coins INT DEFAULT 100,
    -- OAuth fields
    oauth_provider ENUM('google', 'facebook') NULL,
    oauth_id VARCHAR(255) NULL,
    email VARCHAR(255) NULL,
    profile_picture VARCHAR(500) NULL,
    -- Account status
    is_banned BOOLEAN DEFAULT FALSE,
    banned_at DATETIME NULL,
    ban_reason TEXT NULL,
    report_count INT DEFAULT 0,
    -- Username set after OAuth login
    username_set BOOLEAN DEFAULT FALSE,
    INDEX idx_session_id (session_id),
    INDEX idx_oauth (oauth_provider, oauth_id),
    INDEX idx_email (email),
    INDEX idx_is_banned (is_banned),
    UNIQUE KEY unique_oauth (oauth_provider, oauth_id)
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(36) PRIMARY KEY,
    keyword VARCHAR(50) NULL,
    game_type ENUM('tic_tac_toe', 'checkers', 'chess') NOT NULL,
    status ENUM('waiting', 'playing', 'finished') DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_keyword (keyword),
    INDEX idx_status (status),
    INDEX idx_game_type (game_type),
    INDEX idx_game_status (game_type, status),
    INDEX idx_status_game (status, game_type)
);

-- Room players table
CREATE TABLE IF NOT EXISTS room_players (
    id VARCHAR(36) PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    is_host BOOLEAN DEFAULT FALSE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_room_user (room_id, user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id),
    INDEX idx_room_user (room_id, user_id)
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(36) PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL,
    game_type ENUM('tic_tac_toe', 'checkers', 'chess') NOT NULL,
    winner_id VARCHAR(36),
    moves_json TEXT,
    result ENUM('win', 'draw', 'loss'),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_room_id (room_id),
    INDEX idx_winner_id (winner_id)
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_room_id (room_id),
    INDEX idx_created_at (created_at)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(36) PRIMARY KEY,
    reported_user_id VARCHAR(36) NOT NULL,
    reporter_user_id VARCHAR(36) NOT NULL,
    room_id VARCHAR(36) NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    INDEX idx_reported_user (reported_user_id),
    INDEX idx_reporter_user (reporter_user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_created_at (created_at),
    -- Prevent duplicate reports from same reporter for same user
    UNIQUE KEY unique_report (reported_user_id, reporter_user_id, room_id)
);

