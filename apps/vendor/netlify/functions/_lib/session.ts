/**
 * Session validation helper. Reads `session_token` from the request body
 * (NOT the Authorization header — that header would trigger a CORS
 * preflight, which is what we're trying to avoid). Looks up the session
 * in vendor_sessions and returns the vendor_id, or an error response.
 *
 * Usage:
 *   const auth = await requireSession(body);
 *   if ("statusCode" in auth) return auth;   // error response
 *   const { vendor_id } = auth;
 */

import { query } from "./db";
import { err, type NetlifyResponse } from "./response";

interface SessionRow {
  vendor_id: string;
}

export async function requireSession(
  body: { session_token?: string } | null | undefined,
): Promise<{ vendor_id: string } | NetlifyResponse> {
  const token = (body?.session_token ?? "").trim();
  if (!token) {
    return err("session_token required", 401);
  }
  const rows = await query<SessionRow>(
    `SELECT vendor_id FROM vendor_sessions
     WHERE session_token = $1 AND expires_at > now()
     LIMIT 1`,
    [token],
  );
  if (rows.length === 0) {
    return err("invalid_or_expired_session", 401);
  }
  // Touch last_seen_at for activity tracking. Fire-and-forget.
  void query(
    `UPDATE vendor_sessions SET last_seen_at = now() WHERE session_token = $1`,
    [token],
  ).catch(() => {});

  return { vendor_id: rows[0].vendor_id };
}
