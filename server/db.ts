import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { log } from "./vite";

const MAX_RETRIES = 10;
const RETRY_DELAY = 3000;
const CONNECTION_TIMEOUT = 30000;

// Create a connection pool with retry mechanism
const createPool = () => {
  const pool = new pg.Pool({
    host: process.env.PGHOST || '172.16.0.231',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'chiakhoathanhcong',
    database: process.env.PGDATABASE || 'content', 
    port: parseInt(process.env.PGPORT || '5432'),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: CONNECTION_TIMEOUT,
    application_name: 'emso_content_app',
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    statement_timeout: 30000,
    query_timeout: 30000,
    ssl: {
      rejectUnauthorized: false
    },
    allowExitOnIdle: false
  });

  // Add event listeners
  pool.on('connect', () => {
    log('New client connected to postgres', 'db');
  });

  pool.on('acquire', () => {
    log('Client acquired from pool', 'db');
  });

  pool.on('error', (err) => {
    log(`Pool error: ${err.message}`, 'db-error');
  });

  return pool;
};

export const pool = createPool();

// Retry mechanism for database connection
const connectWithRetry = async (retries = 0) => {
  try {
    const client = await pool.connect();
    client.release();
    log('Successfully connected to database', 'db');
    return true;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      log(`Connection attempt ${retries + 1} failed: ${err.message}`, 'db-error');
      log(`Retrying in ${RETRY_DELAY}ms...`, 'db');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectWithRetry(retries + 1);
    } else {
      log(`Failed to connect after ${MAX_RETRIES} attempts`, 'db-error');
      throw err;
    }
  }
};

// Initialize connection
connectWithRetry().catch(err => {
  log(`Initial database connection failed: ${err.message}`, 'db-error');
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Export connect function for external use
export const ensureDatabaseConnection = () => connectWithRetry();