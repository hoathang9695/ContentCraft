import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create a connection pool with detailed logging
export const pool = new pg.Pool({
  host: "42.96.40.138",
  user: "postgres",
  password: "chiakhoathanhcong",
  database: "content",
  port: 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: false,
  allowExitOnIdle: false,
});

// Log connection details
console.log("Database connection config:", {
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  port: process.env.PGPORT,
});

// Add detailed connection logging and error handling
pool.on("connect", () => {
  console.log("Database connected successfully");
  console.log("Connection config:", {
    host: pool.options.host,
    database: pool.options.database,
    user: pool.options.user,
    port: pool.options.port,
  });
});

pool.on("error", (err) => {
  console.error("Database pool error:", err);
  // Attempt to reconnect on error
  pool.connect().catch((connectErr) => {
    console.error("Failed to reconnect to database:", connectErr);
  });
});

// Test connection immediately and retry if needed
async function testConnection() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("Database connection test successful:", res.rows[0]);
  } catch (err) {
    console.error("Database connection test failed:", err);
    // Wait 5 seconds and retry
    setTimeout(testConnection, 5000);
  }
}

testConnection();

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });
