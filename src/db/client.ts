import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import { relations } from "./schema/index.js";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 2_000,
  query_timeout: 2_000,
});

export const db = drizzle({ client: pool, relations });

export async function pingDb(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
