import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create a connection pool with detailed logging
export const pool = new pg.Pool({
  host: process.env.PGHOST || "42.96.40.138",
  user: process.env.PGUSER || "postgres", 
  password: process.env.PGPASSWORD || "chiakhoathanhcong",
  database: process.env.PGDATABASE || "content",
  port: parseInt(process.env.PGPORT || "5432"),
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
async function testConnection(retryCount = 0) {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("Database connection test successful:", res.rows[0]);

    // Enable unaccent extension for search (only on first successful connection)
    if (retryCount === 0) {
      try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS unaccent');
        console.log("✅ Unaccent extension enabled");
      } catch (extErr) {
        console.warn("⚠️ Could not enable unaccent extension:", extErr.message);
      }
    }

    // Reset retry count on success
    if (retryCount > 0) {
      console.log(`✅ Database reconnected after ${retryCount} retries`);
    }
  } catch (err) {
    console.error(`Database connection test failed (attempt ${retryCount + 1}):`, err);

    // Max retry limit to prevent infinite loops
    if (retryCount < 10) {
      const delay = Math.min(5000 * Math.pow(1.5, retryCount), 30000); // Exponential backoff
      console.log(`⏳ Retrying database connection in ${delay}ms...`);
      setTimeout(() => testConnection(retryCount + 1), delay);
    } else {
      console.error("❌ Max database connection retries reached. Manual intervention required.");
    }
  }
}

testConnection();

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });
import {
  users,
  supportRequests,
  groups,
  pages,
  feedbackRequests,
  smtpConfig,
  emailTemplates,
} from "../shared/schema.js";