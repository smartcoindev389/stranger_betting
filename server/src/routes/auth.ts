import express from "express";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/connection.js";
import logger from "../lib/logger.js";

const router = express.Router();

// Verify Google OAuth token and create/update user
router.post("/oauth/google", async (req, res) => {
  try {
    // Support both ID token (credential) and OAuth2 flow (direct user info)
    const { credential, oauthId, email, name, profilePicture } = req.body;

    let finalOauthId: string;
    let finalEmail: string | null;
    let finalName: string | null;
    let finalProfilePicture: string | null;

    if (credential) {
      // ID token flow (Google Sign-In with credential)
      let decodedToken: any;
      try {
        // Simple JWT decode (without verification - for development only!)
        // In production, use: https://www.npmjs.com/package/google-auth-library
        const base64Url = credential.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          Buffer.from(base64, "base64")
            .toString()
            .split("")
            .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
            .join("")
        );
        decodedToken = JSON.parse(jsonPayload);
      } catch (error) {
        logger.error(error, "Failed to decode Google token");
        return res.status(400).json({ error: "Invalid Google token" });
      }

      finalOauthId = decodedToken.sub;
      finalEmail = decodedToken.email || null;
      finalName = decodedToken.name || null;
      finalProfilePicture = decodedToken.picture || null;
    } else if (oauthId) {
      // OAuth2 flow (direct user info from frontend)
      finalOauthId = oauthId;
      finalEmail = email || null;
      finalName = name || null;
      finalProfilePicture = profilePicture || null;
    } else {
      return res.status(400).json({ error: "Missing Google credential or user info" });
    }

    if (!finalOauthId) {
      return res.status(400).json({ error: "Invalid Google token data" });
    }

    // Check if user exists
    const existingUser = (await query(
      "SELECT id, username, username_set, is_banned FROM users WHERE oauth_provider = ? AND oauth_id = ?",
      ["google", finalOauthId]
    )) as Array<{
      id: string;
      username: string;
      username_set: boolean;
      is_banned: boolean;
    }>;

    let userId: string;
    let hasUsername = false;

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      hasUsername = existingUser[0].username_set;

      // Update email/profile picture if changed
      await query(
        "UPDATE users SET email = ?, profile_picture = ? WHERE id = ?",
        [finalEmail, finalProfilePicture, userId]
      );

      // Check if banned
      if (existingUser[0].is_banned) {
        return res.status(403).json({
          error: "Account is banned",
          banned: true,
        });
      }
    } else {
      // Create new user
      userId = uuidv4();
      await query(
        `INSERT INTO users (id, oauth_provider, oauth_id, email, profile_picture, username, username_set)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "google",
          finalOauthId,
          finalEmail,
          finalProfilePicture,
          finalName || `User_${userId.substring(0, 8)}`,
          false,
        ]
      );
    }

    res.json({
      userId,
      hasUsername,
      username: existingUser.length > 0 ? existingUser[0].username : null,
    });
  } catch (error) {
    logger.error(error, "Error in Google OAuth");
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Verify Facebook OAuth token and create/update user
router.post("/oauth/facebook", async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: "Missing Facebook access token" });
    }

    // Verify the Facebook access token by calling Facebook Graph API
    const fbResponse = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );

    if (!fbResponse.ok) {
      return res.status(401).json({ error: "Invalid Facebook token" });
    }

    const fbData = await fbResponse.json();

    const oauthId = fbData.id;
    const email = fbData.email;
    const name = fbData.name;
    const profilePicture = fbData.picture?.data?.url;

    if (!oauthId) {
      return res.status(400).json({ error: "Invalid Facebook user data" });
    }

    // Check if user exists
    const existingUser = (await query(
      "SELECT id, username, username_set, is_banned FROM users WHERE oauth_provider = ? AND oauth_id = ?",
      ["facebook", oauthId]
    )) as Array<{
      id: string;
      username: string;
      username_set: boolean;
      is_banned: boolean;
    }>;

    let userId: string;
    let hasUsername = false;

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      hasUsername = existingUser[0].username_set;

      // Update email/profile picture if changed
      await query(
        "UPDATE users SET email = ?, profile_picture = ? WHERE id = ?",
        [email || null, profilePicture || null, userId]
      );

      // Check if banned
      if (existingUser[0].is_banned) {
        return res.status(403).json({
          error: "Account is banned",
          banned: true,
        });
      }
    } else {
      // Create new user
      userId = uuidv4();
      await query(
        `INSERT INTO users (id, oauth_provider, oauth_id, email, profile_picture, username, username_set)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          "facebook",
          oauthId,
          email || null,
          profilePicture || null,
          name || `User_${userId.substring(0, 8)}`,
          false,
        ]
      );
    }

    res.json({
      userId,
      hasUsername,
      username: existingUser.length > 0 ? existingUser[0].username : null,
    });
  } catch (error) {
    logger.error(error, "Error in Facebook OAuth");
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Set username after OAuth login
router.post("/set-username", async (req, res) => {
  try {
    const { userId, username } = req.body;

    if (!userId || !username) {
      return res.status(400).json({ error: "Missing userId or username" });
    }

    // Validate username
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        error: "Username must be between 3 and 20 characters",
      });
    }

    // Check if username is taken
    const existing = (await query(
      "SELECT id FROM users WHERE username = ? AND id != ?",
      [username, userId]
    )) as Array<{ id: string }>;

    if (existing.length > 0) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // Update user
    await query(
      "UPDATE users SET username = ?, username_set = ? WHERE id = ?",
      [username, true, userId]
    );

    res.json({ success: true, username });
  } catch (error) {
    logger.error(error, "Error setting username");
    res.status(500).json({ error: "Failed to set username" });
  }
});

// Check if user is banned
router.get("/check-ban/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = (await query(
      "SELECT is_banned, banned_at, ban_reason FROM users WHERE id = ?",
      [userId]
    )) as Array<{
      is_banned: boolean;
      banned_at: Date | null;
      ban_reason: string | null;
    }>;

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      isBanned: user[0].is_banned,
      bannedAt: user[0].banned_at,
      banReason: user[0].ban_reason,
    });
  } catch (error) {
    logger.error(error, "Error checking ban status");
    res.status(500).json({ error: "Failed to check ban status" });
  }
});

export default router;

