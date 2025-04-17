
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { log } from "./vite";

// Tăng số lần retry và thời gian timeout
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;
const CONNECTION_TIMEOUT = 60000;

// Create a connection pool with detailed logging
export const pool = new pg.Pool({
  host: process.env.PGHOST || '172.16.0.231',
  user: process.env.PGUSER || 'postgres', 
  password: process.env.PGPASSWORD || 'chiakhoathanhcong',
  database: process.env.PGDATABASE || 'content',
  port: parseInt(process.env.PGPORT || '5432'),
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: CONNECTION_TIMEOUT,
  ssl: {
    rejectUnauthorized: false
  },
  allowExitOnIdle: false
});

// Log connection details
log('Database connection config:', {
  host: process.env.PGHOST || '172.16.0.231',
  database: process.env.PGDATABASE || 'content',
  user: process.env.PGUSER || 'postgres',
  port: process.env.PGPORT || '5432'
}, 'db');

// Add detailed connection logging and error handling with retry
pool.on('connect', () => {
  log('Database connected successfully', 'db');
  log('Connection config:', {
    host: pool.options.host,
    database: pool.options.database,
    user: pool.options.user,
    port: pool.options.port,
    ssl: pool.options.ssl ? 'enabled' : 'disabled',
    max: pool.options.max,
    idleTimeoutMillis: pool.options.idleTimeoutMillis,
    connectionTimeoutMillis: pool.options.connectionTimeoutMillis
  }, 'db');
});

pool.on('error', (err) => {
  log(`Database pool error: ${err}`, 'db-error');
  retryConnection();
});

// Retry connection function
async function retryConnection(retries = 0) {
  if (retries >= MAX_RETRIES) {
    log(`Failed to connect after ${MAX_RETRIES} retries`, 'db-error');
    return;
  }

  try {
    const client = await pool.connect();
    client.release();
    log('Successfully reconnected to database', 'db');
  } catch (err) {
    log(`Retry ${retries + 1}/${MAX_RETRIES} failed: ${err}`, 'db-error');
    setTimeout(() => retryConnection(retries + 1), RETRY_DELAY);
  }
}

// Test connection with retry
async function testConnection(retries = 0) {
  try {
    const res = await pool.query('SELECT NOW()');
    log('Database connection test successful:', res.rows[0], 'db');
  } catch (err) {
    log(`Database connection test failed: ${err}`, 'db-error');
    if (retries < MAX_RETRIES) {
      log(`Retrying connection in ${RETRY_DELAY}ms...`, 'db');
      setTimeout(() => testConnection(retries + 1), RETRY_DELAY);
    }
  }
}

testConnection();

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });
