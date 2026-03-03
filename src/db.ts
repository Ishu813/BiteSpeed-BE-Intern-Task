import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export const pool = new Pool({
  connectionString,
});

export async function testDbConnection(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function initializeDatabase(): Promise<void> {
  await testDbConnection();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      "phoneNumber" TEXT,
      email TEXT,
      "linkedId" INTEGER,
      "linkPrecedence" TEXT NOT NULL DEFAULT 'primary',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );
  `);
}

