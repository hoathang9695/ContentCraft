import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create a connection pool instead of a single client
// Create pool with better error handling
export const pool = new pg.Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: parseInt(process.env.PGPORT || '5432'),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: false,
  allowExitOnIdle: false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
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