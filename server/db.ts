import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create a connection pool instead of a single client
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:chiakhoathanhcong@42.96.40.138:5432/content',
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // Increase connection timeout to 10 seconds
  ssl: false, // Disable SSL since connecting to external DB
  // Add auto reconnect logic
  allowExitOnIdle: false
});

// Add error handling
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
});

// Listen for specific connection issues
pool.on('connect', (client) => {
  console.log('Connected to PostgreSQL database');
  client.on('error', (err) => {
    console.error('Database client error:', err);
  });
});


// Create Drizzle ORM instance with our schema using the pool
export const db = drizzle(pool, { schema });