/**
 * Netlify Function: set-password
 * Region-safe port of the Supabase edge `vendor-set-password`, on the /sb
 * path (Postgres-direct). Sets or changes the vendor's login password.
 *
 * POST /sb/set-password
 * Body: { session_token?: string, password: string, current_password?: string }
 * (session_token optional here because the HttpOnly cookie is preferred;
 *  requireSession() reads either.)
 *
 * Authorization to change an EXISTING password, in priority order:
 *   1. correct `current_password` (normal change-password), OR
 *   2. a recently VERIFIED OTP for this vendor (≤10 min) — this is the
 *      "forgot password" path: the vendor proved control of their email/phone
 *      via the OTP login they just completed, so they may set a new password
 *      without knowing the old one, OR
 *   3. `must_reset = true` on the account (staff-forced reset).
 * First-time set (no existing password) needs none of the above.
 *
 * See docs/CVP-VENDOR-AUTH-PASSWORD-PLAN.md.
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, jsonWithCookies, type NetlifyResponse } from "./_lib/response";
import { buildSessionCookie } from "./_lib/cookies";
import { hashPassword, verifyPassword, checkPasswordPolicy } from "./_lib/password";
import { revokeAllTrustedDevices } from "./_lib/trusted-device";

// How recent a verified OTP must be to authorize a password reset without the
// current password (the forgot-password path).
const RESET_OTP_WINDOW = "10 minutes";

interface Body {
  session_token?: string;
  password?: string;
  current_password?: string;
}

interface AuthRow {
  password_hash: string | null;
  must_reset: boolean | null;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as Body;
    const auth = await requireSession(body, event.headers);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const password = body.password;
    const policy = checkPasswordPolicy(password);
    if (!policy.ok) return err(policy.message ?? "Invalid password", 400);

    // Existing password?
    const rows = await query<AuthRow>(
      `SELECT password_hash, must_reset FROM vendor_auth WHERE vendor_id = $1 LIMIT 1`,
      [vendor_id],
    );
    const existing = rows[0];
    const hasExistingPassword = !!(existing && existing.password_hash);

    if (hasExistingPassword) {
      let authorized = false;

      // (1) correct current password
      if (body.current_password) {
        authorized = await verifyPassword(body.current_password, existing!.password_hash);
        if (!authorized) return err("Current password is incorrect", 401);
      }

      // (2) recently verified OTP (forgot-password path)
      if (!authorized) {
        const recentOtp = await query<{ id: string }>(
          `SELECT id FROM vendor_otp
             WHERE vendor_id = $1 AND verified = true
               AND created_at > now() - INTERVAL '${RESET_OTP_WINDOW}'
             LIMIT 1`,
          [vendor_id],
        );
        if (recentOtp.length > 0) authorized = true;
      }

      // (3) staff-forced reset
      if (!authorized && existing!.must_reset) authorized = true;

      if (!authorized) {
        return err("Current password required", 400, { code: "current_password_required" });
      }
    }

    const passwordHash = await hashPassword(password as string);

    await query(
      `INSERT INTO vendor_auth (vendor_id, password_hash, password_set_at, must_reset, updated_at)
       VALUES ($1, $2, now(), false, now())
       ON CONFLICT (vendor_id)
       DO UPDATE SET password_hash = EXCLUDED.password_hash,
                     password_set_at = now(),
                     must_reset = false,
                     updated_at = now()`,
      [vendor_id, passwordHash],
    );

    // Security: a password change forces OTP step-up again on every browser.
    await revokeAllTrustedDevices(vendor_id);

    // Preserve session-cookie rotation if requireSession rotated the token.
    if ("rotated" in auth && auth.rotated) {
      return jsonWithCookies({ success: true }, [buildSessionCookie(auth.rotated)]);
    }
    return json({ success: true });
  } catch (e) {
    console.error("set-password error:", e);
    return err("Internal server error", 500, {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
};
