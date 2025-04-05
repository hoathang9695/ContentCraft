import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create a connection pool instead of a single client
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // Increase connection timeout to 10 seconds
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

// Connect to PostgreSQL and test connection with exponential backoff
let retryCount = 0;
const maxRetries = 5;

async function connectToDatabase() {
  try {
    // Get a client from the pool to test the connection
    const client = await pool.connect();
    console.log("Connected to PostgreSQL database");
    // Reset retry count on successful connection
    retryCount = 0;
    // Release the client back to the pool
    client.release();
  } catch (err) {
    console.error("Error connecting to PostgreSQL:", err);
    // Calculate backoff time with exponential increase and a maximum of 30 seconds
    retryCount++;
    const backoffTime = Math.min(Math.pow(2, retryCount) * 1000, 30000);
    console.log(`Will retry connecting in ${backoffTime/1000} seconds... (Attempt ${retryCount} of ${maxRetries})`);
    
    if (retryCount < maxRetries) {
      // Retry after a delay with exponential backoff
      setTimeout(connectToDatabase, backoffTime);
    } else {
      console.error("Max retries reached. Please check your database configuration.");
      // Continue with application startup despite database issues
      // This allows the Express server to start even if DB isn't ready yet
    }
  }
}

// Initialize connection
connectToDatabase();

// Create Drizzle ORM instance with our schema using the pool
export const db = drizzle(pool, { schema });