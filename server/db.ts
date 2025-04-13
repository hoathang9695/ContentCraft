import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create a connection pool instead of a single client
export const pool = new pg.Pool({
  host: process.env.PGHOST || '42.96.40.138',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'chiakhoathanhcong',
  database: process.env.PGDATABASE || 'content',
  port: parseInt(process.env.PGPORT || '5432'),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: false,
  allowExitOnIdle: false,
  // Add logging
  query_timeout: 10000,
  statement_timeout: 10000
});

// Add error logging
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

pool.on('connect', () => {
  console.log('Connected to database successfully');
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