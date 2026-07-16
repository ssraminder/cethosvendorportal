/**
 * Netlify Function: auth-password
 * Region-safe port of the Supabase edge `vendor-auth-password`, on the /sb
 * path (Postgres-direct). Verifies email + password.
 *
 * POST /sb/auth-password
 * Body: { email: string, password: string }
 *
 * Target model (docs/CVP-VENDOR-AUTH-PASSWORD-PLAN.md): password is the
 * everyday factor; OTP is periodic step-up. After a correct password:
 *   - if a VALID trusted-device cookie is present (this browser passed OTP
 *     within TRUSTED_DEVICE_DAYS) → issue a session and log in, NO OTP;
 *   - otherwise → { ok: true, needs_otp: true, email } and the caller must
 *     complete an OTP (auth-otp-send/verify) to get a session.
 *
 * The trusted-device cookie only ever lets the vendor skip the OTP step — the
 * password is always required here. All auth failures return the same generic
 * 401, with a dummy bcrypt compare on the miss path for uniform timing.
 */

import { query } from "./_lib/db";
import {
  json,
  jsonWithCookies,
  parseBody,
  err,
  type NetlifyResponse,
} from "./_lib/response";
import { verifyPassword } from "./_lib/password";
import { readTrustTokenFromRequest, buildTrustCookie, buildSessionCookie } from "./_lib/cookies";
import { checkAndRotateTrustedDevice } from "./_lib/trusted-device";
import { createSession } from "./_lib/session";

interface Body {
  email?: string;
  password?: string;
}

interface LookupRow {
  vendor_id: string;
  password_hash: string | null;
}

interface VendorProfile {
  id: string;
  full_name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  vendor_type: string | null;
  contractor_type: string | null;
  country: string | null;
  availability_status: string | null;
}

const INVALID = "Invalid email or password";

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as Body;
    const email = (body.email ?? "").toLowerCase().trim();
    const password = body.password ?? "";
    if (!email || !password) return err("Email and password are required", 400);

    const rows = await query<LookupRow>(
      `SELECT v.id AS vendor_id, a.password_hash
         FROM vendors v
         LEFT JOIN vendor_auth a ON a.vendor_id = v.id
        WHERE lower(v.email) = $1
        LIMIT 1`,
      [email],
    );
    const row = rows[0];

    // Dummy compare on the miss path → uniform timing (no enumeration).
    const ok = await verifyPassword(password, row?.password_hash);
    if (!row || !ok) return err(INVALID, 401);

    const vendorId = row.vendor_id;
    const userAgent = event.headers?.["user-agent"] ?? null;

    // Trusted-device fast-path: valid device cookie → skip OTP, log in.
    const trustToken = readTrustTokenFromRequest(event.headers);
    const trust = await checkAndRotateTrustedDevice(vendorId, trustToken, userAgent);

    if (!trust.trusted) {
      // Untrusted / expired browser → require OTP step-up. No session issued.
      return json({ ok: true, needs_otp: true, email });
    }

    // Trusted browser → issue a session directly.
    const profiles = await query<VendorProfile>(
      `SELECT id, full_name, business_name, email, phone, status,
              vendor_type, contractor_type, country, availability_status
         FROM vendors WHERE id = $1 LIMIT 1`,
      [vendorId],
    );
    const vendor = profiles[0];
    if (!vendor) return err("Failed to fetch vendor profile", 500);

    const { token: sessionToken, expiresAt } = await createSession(vendorId, "password-trusted");

    // Stamp first login via cvp_translators (mirrors auth-otp-verify).
    let isFirstLogin = false;
    const translator = await query<{ id: string; invite_accepted_at: string | null }>(
      `SELECT id, invite_accepted_at FROM cvp_translators WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (translator[0] && !translator[0].invite_accepted_at) {
      isFirstLogin = true;
      await query(
        `UPDATE cvp_translators SET invite_accepted_at = now() WHERE id = $1`,
        [translator[0].id],
      );
    }

    const cookies = [buildSessionCookie(sessionToken)];
    // Re-set the rotated trusted-device cookie.
    if (trust.rotated) cookies.push(buildTrustCookie(trust.rotated));

    return jsonWithCookies(
      {
        success: true,
        session_token: sessionToken,
        expires_at: expiresAt,
        vendor,
        is_first_login: isFirstLogin,
      },
      cookies,
    );
  } catch (e) {
    console.error("auth-password error:", e);
    return err("Internal server error", 500, {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
};
