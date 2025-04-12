
import { defineConfig } from "drizzle-kit";
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  connectionString,
});
