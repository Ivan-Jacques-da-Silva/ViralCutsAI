import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Ensure required tables exist to avoid runtime 42P01 errors
// This is a lightweight safety net; drizzle-kit push remains the source of truth.
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "videos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "video_path" text NOT NULL,
        "source" text NOT NULL,
        "uploaded_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "video_cuts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "video_id" varchar NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
        "start_time" integer NOT NULL,
        "end_time" integer NOT NULL,
        "description" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "processed_cuts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "cut_id" varchar NOT NULL REFERENCES "video_cuts"("id") ON DELETE CASCADE,
        "format" text NOT NULL,
        "output_path" text NOT NULL,
        "subtitles" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);
  } finally {
    client.release();
  }
}

// Fire and forget on module load
void ensureSchema();
