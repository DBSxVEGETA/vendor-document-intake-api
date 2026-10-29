require("dotenv").config();

const pool = require("../config/database");

async function checkDatabase() {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, NOW() AS server_time",
    );

    console.log("Database connection successful:");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkDatabase();
