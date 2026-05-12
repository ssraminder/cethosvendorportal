/**
 * Shared Postgres pool for Netlify Functions. Connects directly to
 * Supabase Postgres via the pooler endpoint, native postgres protocol.
 * Bypasses Supabase's HTTPS edge entirely.
 *
 * Configure via either DATABASE_URL or a set of DB_HOST/DB_PORT/DB_USER/
 * DB_PASSWORD/DB_NAME env vars. If both are set, the separate vars win.
 * Get the values from Supabase Dashboard → Project Settings → Database
 * → Transaction pooler.
 */

import { Pool } from "pg";

let pool: Pool | null = null;

function buildConfig(): import("pg").PoolConfig {
  const host = process.env.DB_HOST;
  if (host) {
    // Separate-vars path. Logs the host (NOT the password) on first connect
    // so we can confirm Lambda is using what we expect.
    const cfg = {
      host,
      port: Number(process.env.DB_PORT ?? "6543"),
      user: process.env.DB_USER ?? "",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "postgres",
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    };
    console.log(`[db] Using separate env vars: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
    return cfg;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Neither DATABASE_URL nor DB_HOST is set");
  }
  // Parse the URL just for logging — don't actually use the parsed parts,
  // pass the original string to pg so it handles encoding itself.
  try {
    const u = new URL(url);
    console.log(`[db] Using DATABASE_URL: ${u.username}@${u.hostname}:${u.port}${u.pathname}`);
  } catch {
    console.log(`[db] Using DATABASE_URL (unparseable, length=${url.length})`);
  }
  return {
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  };
}

export function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool(buildConfig());
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
