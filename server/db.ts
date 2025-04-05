import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Create PostgreSQL client
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

// Connect to PostgreSQL
async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database");
  } catch (err) {
    console.error("Error connecting to PostgreSQL:", err);
    process.exit(1);
  }
}

// Initialize connection
connectToDatabase();

// Create Drizzle ORM instance with our schema
export const db = drizzle(client, { schema });