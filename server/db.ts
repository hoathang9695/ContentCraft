
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create a connection pool with detailed logging
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
  allowExitOnIdle: false
});

// Add detailed connection logging
pool.on('connect', () => {
  console.log('Database connected successfully');
  console.log('Connection config:', {
    host: pool.options.host,
    database: pool.options.database,
    user: pool.options.user,
    port: pool.options.port
  });
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Test connection immediately
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection test failed:', err);
  } else {
    console.log('Database connection test successful:', res.rows[0]);
  }
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });
