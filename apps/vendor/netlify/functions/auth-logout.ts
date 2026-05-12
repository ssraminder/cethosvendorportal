/**
 * Netlify Function: auth-logout
 *
 * Revokes the current vendor session and clears the cookie. Idempotent
 * — calling it without a session is fine.
 *
 * POST /sb/auth-logout
 * Body: { session_token?: string }   // optional; cookie is preferred
 * Returns: { success: true }
 *
 * The Set-Cookie response clears `cethos_session_vendor` on `.cethos.com`
 * regardless of whether a valid session was actually revoked. This means
 * the browser ends up clean even if the server-side session was already
 * gone (expired, revoked elsewhere, etc.).
 *
 * NOTE: this complements the existing `vendor-auth-logout` Supabase
 * Edge Function. Frontend will migrate to /sb/auth-logout when it picks
 * up the cookie-based session flow.
 */

import {
  jsonWithCookies,
  parseBody,
  type NetlifyResponse,
} from "./_lib/response";
import {
  buildClearSessionCookie,
  parseCookies,
  SESSION_COOKIE_NAME,
} from "./_lib/cookies";
import { revokeSession } from "./_lib/session";

export const handler = async (event: {
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  const cookies = parseCookies(event.headers);
  const body = (parseBody(event.body, event.isBase64Encoded) ?? {}) as {
    session_token?: string;
  };
  const token = cookies[SESSION_COOKIE_NAME] || body.session_token?.trim();

  if (token) {
    await revokeSession(token);
  }

  return jsonWithCookies({ success: true }, [buildClearSessionCookie()]);
};
