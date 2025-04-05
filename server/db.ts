import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create a connection pool instead of a single client
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
  // Add auto reconnect logic
  allowExitOnIdle: false, // Don't exit if all clients are idle
});

// Add error handling
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  // Don't crash the server on connection errors
});

// Listen for specific connection issues
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Database client error:', err);
    // Individual client error shouldn't crash the entire application
  });
});

// Connect to PostgreSQL and test connection
async function connectToDatabase() {
  try {
    // Get a client from the pool to test the connection
    const client = await pool.connect();
    console.log("Connected to PostgreSQL database");
    // Release the client back to the pool
    client.release();
  } catch (err) {
    console.error("Error connecting to PostgreSQL:", err);
    console.log("Will retry connecting in 5 seconds...");
    // Instead of exiting, retry after a delay
    setTimeout(connectToDatabase, 5000);
  }
}

// Initialize connection
connectToDatabase();

// Create Drizzle ORM instance with our schema using the pool
export const db = drizzle(pool, { schema });