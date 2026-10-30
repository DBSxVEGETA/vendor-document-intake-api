const jwt = require("jsonwebtoken");
const pool = require("../config/database");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const accessToken = authHeader.split(" ")[1];

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    // Confirm that the session is still active.
    const result = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.role,
        u.is_active,
        s.id AS session_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1
       AND s.user_id = $2
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND s.access_token_version = $3`,
      [decoded.sid, decoded.sub, decoded.tokenVersion],
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Session is invalid or has been revoked",
      });
    }

    // Make the authenticated user available to later middleware/controllers.
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: user.session_id,
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;
