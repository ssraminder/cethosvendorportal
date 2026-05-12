/**
 * Shared Postgres pool for Netlify Functions. Connects directly to
 * Supabase Postgres via the pooler endpoint (port 6543, native postgres
 * protocol). Bypasses Supabase's HTTPS edge entirely so we don't get
 * the regional-block / CF-routing issues that plague *.supabase.co.
 *
 * Env var required:
 *   DATABASE_URL = postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
 *
 * Find this in Supabase Dashboard → Project Settings → Database →
 * "Transaction pooler" connection string. Use the URI form, not psql.
 */

import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL env var is not set");
  }
  pool = new Pool({
    connectionString: url,
    // Pooler endpoint is in TLS mode but uses Supabase's own cert chain
    ssl: { rejectUnauthorized: false },
    max: 5,
    // Pooler closes idle connections aggressively; short timeout matches
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  return pool;
}

export async function query<T = unknown>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const p = getPool();
  const res = await p.query(text, params);
  return res.rows as T[];
}
