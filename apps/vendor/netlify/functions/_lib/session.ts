/**
 * Session validation helper. Reads the session token from either:
 *
 *   1. The `cethos_session` HttpOnly cookie (preferred — the cookie path
 *      is what makes federated SSO across `*.cethos.com` work).
 *   2. The `session_token` field on the parsed JSON body (legacy — kept
 *      so the current frontend keeps working through the cookie cutover).
 *
 * Cookie-presented sessions opportunistically rotate after 24h: a new
 * row is inserted into vendor_sessions, the old one is marked
 * `revoked_at = now()`, and the caller is expected to include
 * `auth.rotated` in their response Set-Cookie via `jsonWithCookies()`.
 *
 * Body-presented sessions never rotate (the frontend can't update its
 * localStorage from a Set-Cookie). Once the frontend migrates to
 * cookies, the body fallback can be removed and rotation is universal.
 */

import { query } from "./db";
import { err, type NetlifyResponse } from "./response";
import {
  SESSION_COOKIE_NAME,
  buildSessionCookie,
  parseCookies,
} from "./cookies";

interface SessionRow {
  id: string;
  vendor_id: string;
  expires_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  origin: string | null;
}

const ROTATE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d, matches existing flow

/**
 * On success, `vendor_id` is always present. `rotated` carries a NEW
 * session token if and only if the token was presented via cookie AND
 * rotation fired. Callers that received a `rotated` token MUST send it
 * back via `Set-Cookie` — use `jsonWithCookies()` from response.ts.
 *
 * On failure, an err()-shaped NetlifyResponse is returned. Use the
 * standard `if ("statusCode" in auth) return auth;` guard.
 */
export type SessionAuth =
  | { vendor_id: string; rotated?: string }
  | NetlifyResponse;

export async function requireSession(
  body: { session_token?: string } | null | undefined,
  headers?: Record<string, string | undefined>,
): Promise<SessionAuth> {
  const cookies = parseCookies(headers);
  const fromCookie = cookies[SESSION_COOKIE_NAME];
  const fromBody = body?.session_token?.trim();
  const token = fromCookie || fromBody;
  const isCookieAuth = !!fromCookie;

  if (!token) return err("session_token required", 401);

  const rows = await query<SessionRow>(
    `SELECT id, vendor_id, expires_at, last_seen_at, revoked_at, origin
       FROM vendor_sessions
      WHERE session_token = $1
      LIMIT 1`,
    [token],
  );
  const session = rows[0];
  if (
    !session ||
    session.revoked_at ||
    new Date(session.expires_at) < new Date()
  ) {
    return err("invalid_or_expired_session", 401);
  }

  // Touch last_seen_at for activity tracking. Fire-and-forget on the
  // happy path; the rotation branch overrides this with an explicit
  // revoke + new-row insert that subsumes the touch.
  if (!isCookieAuth || !shouldRotate(session)) {
    void query(
      `UPDATE vendor_sessions SET last_seen_at = now() WHERE id = $1`,
      [session.id],
    ).catch(() => {});
    return { vendor_id: session.vendor_id };
  }

  // Rotation path. Cookie-only — body callers can't pick up Set-Cookie.
  const newToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await query(
    `INSERT INTO vendor_sessions
       (vendor_id, session_token, expires_at, last_seen_at, origin, rotated_from)
     VALUES ($1, $2, $3, now(), $4, $5)`,
    [
      session.vendor_id,
      newToken,
      newExpiresAt,
      session.origin ?? "rotation",
      token,
    ],
  );
  await query(
    `UPDATE vendor_sessions
        SET revoked_at = now()
      WHERE id = $1`,
    [session.id],
  );
  return { vendor_id: session.vendor_id, rotated: newToken };
}

function shouldRotate(session: SessionRow): boolean {
  const lastSeen = session.last_seen_at
    ? new Date(session.last_seen_at).getTime()
    : 0;
  return Date.now() - lastSeen > ROTATE_AFTER_MS;
}

/**
 * Helper for sso-issue, auth-logout, and other new endpoints that want
 * to express "I'm done with this session, revoke it." Idempotent.
 */
export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  await query(
    `UPDATE vendor_sessions
        SET revoked_at = now()
      WHERE session_token = $1
        AND revoked_at IS NULL`,
    [token],
  ).catch(() => {});
}

/**
 * Mint a fresh 30-day session row and return the token + expiry. Used by
 * endpoints that authenticate a vendor directly (e.g. password login on a
 * trusted browser). `origin` records how the session was created
 * ('otp' | 'password-trusted' | ...).
 */
export async function createSession(
  vendorId: string,
  origin: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await query(
    `INSERT INTO vendor_sessions (vendor_id, session_token, expires_at, last_seen_at, origin)
     VALUES ($1, $2, $3, now(), $4)`,
    [vendorId, token, expiresAt, origin],
  );
  return { token, expiresAt };
}

// Re-export so callers don't have to import from two files for a
// typical "validate, build cookie, respond" flow.
export { buildSessionCookie, SESSION_COOKIE_NAME };
