const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../../config/database");

const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 7,
);

// Hash a refresh token before storing it in the database.
function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Generate a short-lived access token.
function generateAccessToken(user, sessionId, tokenVersion) {
  return jwt.sign(
    {
      sub: user.id,
      sid: sessionId,
      role: user.role,
      tokenVersion,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    },
  );
}

// Create a database session and issue tokens.
async function createSession(client, user) {
  const refreshToken = crypto.randomBytes(64).toString("hex");
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const sessionExpiry = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  );

  const sessionResult = await client.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, access_token_version`,
    [user.id, refreshTokenHash, sessionExpiry],
  );

  const sessionId = sessionResult.rows[0].id;
  const tokenVersion = sessionResult.rows[0].access_token_version;

  const accessToken = generateAccessToken(user, sessionId, tokenVersion);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

// Register a new vendor account.
async function register({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error("Password must be at least 8 characters");
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role)
             VALUES ($1, $2, 'vendor')
             RETURNING id, email, role`,
      [normalizedEmail, passwordHash],
    );

    const user = userResult.rows[0];

    const tokens = await createSession(client, user);

    await client.query("COMMIT");

    return {
      user,
      tokens,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      const duplicateError = new Error(
        "An account with this email already exists",
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  } finally {
    client.release();
  }
}

// Authenticate an existing user.
async function login({ email, password }) {
  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `SELECT id, email, password_hash, role, is_active
         FROM users
         WHERE email = $1`,
    [normalizedEmail],
  );

  const user = result.rows[0];

  // Use the same response for an unknown email and an incorrect password.
  if (!user || !user.is_active) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokens = await createSession(client, user);

    await client.query("COMMIT");

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      tokens,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Refresh an access token using a valid refresh token.

async function refresh(refreshToken) {
  if (!refreshToken) {
    const error = new Error("Refresh token is required");
    error.statusCode = 400;
    throw error;
  }

  const oldTokenHash = hashRefreshToken(refreshToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the session row to prevent concurrent token rotation.
    const result = await client.query(
      `SELECT
                s.id AS session_id,
                s.user_id,
                u.email,
                u.role,
                u.is_active
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.refresh_token_hash = $1
               AND s.revoked_at IS NULL
               AND s.expires_at > NOW()
             FOR UPDATE OF s`,
      [oldTokenHash],
    );

    const session = result.rows[0];

    if (!session || !session.is_active) {
      const error = new Error("Invalid or expired refresh token");
      error.statusCode = 401;
      throw error;
    }

    // Generate a new refresh token.
    const newRefreshToken = crypto.randomBytes(64).toString("hex");
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    const newExpiry = new Date(
      Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    );

    // Rotate the refresh token and invalidate previous access tokens.
    const updateResult = await client.query(
      `UPDATE sessions
             SET refresh_token_hash = $1,
                 expires_at = $2,
                 access_token_version = access_token_version + 1
             WHERE id = $3
             RETURNING access_token_version`,
      [newRefreshTokenHash, newExpiry, session.session_id],
    );

    const newTokenVersion = updateResult.rows[0].access_token_version;

    const user = {
      id: session.user_id,
      email: session.email,
      role: session.role,
    };

    // Generate an access token with the updated version.
    const accessToken = generateAccessToken(
      user,
      session.session_id,
      newTokenVersion,
    );

    await client.query("COMMIT");

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Revoke the current session during logout.
async function logout(sessionId) {
  const result = await pool.query(
    `UPDATE sessions
         SET revoked_at = NOW()
         WHERE id = $1
           AND revoked_at IS NULL
         RETURNING id`,
    [sessionId],
  );

  return result.rowCount > 0;
}

module.exports = {
  register,
  login,
  refresh,
  logout,
};
