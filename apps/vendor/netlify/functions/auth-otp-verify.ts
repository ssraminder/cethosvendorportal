/**
 * Netlify Function: auth-otp-verify
 * Drop-in for Supabase Edge `vendor-auth-otp-verify`. Direct Postgres.
 *
 * POST /sb/auth-otp-verify
 * Body: { email, otp_code }
 * Returns: { success, session_token, expires_at, vendor, needs_password, is_first_login }
 */

import { randomUUID } from "node:crypto";
import { query } from "./_lib/db";
import {
  err,
  json,
  jsonWithCookies,
  parseBody,
  type NetlifyResponse,
} from "./_lib/response";
import { buildSessionCookie, buildTrustCookie, hostFromHeaders } from "./_lib/cookies";
import { issueTrustedDevice } from "./_lib/trusted-device";
import {
  hashOtp,
  OTP_LOCKOUT_MINUTES,
  OTP_MAX_ATTEMPTS,
  timingSafeEqual,
} from "./_lib/otp-crypto";

interface OtpRow {
  id: string;
  vendor_id: string;
  otp_hash: string | null;
  salt: string | null;
  attempts: number;
  locked_until: string | null;
}

interface VendorRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  vendor_type: string | null;
  country: string | null;
  availability_status: string | null;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      email?: string;
      otp_code?: string;
      remember_device?: boolean;
    };
    const email = (body.email ?? "").toLowerCase().trim();
    const otpCode = (body.otp_code ?? "").trim();
    const rememberDevice = body.remember_device === true;
    const userAgent = event.headers?.["user-agent"] ?? null;
    if (!email || !otpCode) return err("Email and code are required", 400);

    // Find the latest non-verified, non-expired OTP for this email
    const otps = await query<OtpRow>(
      `SELECT id, vendor_id, otp_hash, salt, attempts, locked_until
         FROM vendor_otp
        WHERE email = $1 AND verified = false AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    const otp = otps[0];
    if (!otp) {
      return err("Invalid or expired code", 401);
    }

    // Per-row lockout. Combined with the 60s send-side rate limit, a
    // brute-forcer can only try OTP_MAX_ATTEMPTS codes per minute against
    // any single email.
    if (otp.locked_until && new Date(otp.locked_until) > new Date()) {
      return err("Too many attempts. Request a new code.", 429);
    }

    // Hash-and-compare. Per M-6, the legacy `otp_code` column has been
    // dropped; every active OTP row carries otp_hash + salt now.
    let match = false;
    if (otp.otp_hash && otp.salt) {
      match = timingSafeEqual(hashOtp(otpCode, otp.salt), otp.otp_hash);
    }

    if (!match) {
      const newAttempts = otp.attempts + 1;
      const shouldLock = newAttempts >= OTP_MAX_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;
      await query(
        `UPDATE vendor_otp SET attempts = $2, locked_until = $3 WHERE id = $1`,
        [otp.id, newAttempts, lockedUntil],
      );
      return err(
        shouldLock ? "Too many attempts. Request a new code." : "Invalid or expired code",
        shouldLock ? 429 : 401,
      );
    }

    await query(`UPDATE vendor_otp SET verified = true WHERE id = $1`, [otp.id]);

    const sessionToken = `${randomUUID()}-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO vendor_sessions (vendor_id, session_token, expires_at, last_seen_at, origin)
       VALUES ($1, $2, $3, now(), 'otp')`,
      [otp.vendor_id, sessionToken, expiresAt],
    );

    const vendors = await query<VendorRow>(
      `SELECT id, full_name, email, phone, status, vendor_type, country, availability_status
       FROM vendors WHERE id = $1 LIMIT 1`,
      [otp.vendor_id],
    );
    const vendor = vendors[0];
    if (!vendor) return err("Failed to fetch vendor profile", 500);

    const authRows = await query<{ vendor_id: string }>(
      `SELECT vendor_id FROM vendor_auth WHERE vendor_id = $1 LIMIT 1`,
      [otp.vendor_id],
    );

    // First-login flag from cvp_translators
    let isFirstLogin = false;
    const translatorRows = await query<{ id: string; invite_accepted_at: string | null }>(
      `SELECT id, invite_accepted_at FROM cvp_translators WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (translatorRows[0] && !translatorRows[0].invite_accepted_at) {
      isFirstLogin = true;
      await query(
        `UPDATE cvp_translators SET invite_accepted_at = now() WHERE id = $1`,
        [translatorRows[0].id],
      );
    }

    // Set the HttpOnly session cookie alongside returning the raw token
    // in the body. The body field is what the current frontend reads
    // (localStorage); the cookie is what cookie-aware future code (and
    // the new `sso-issue` function) reads. Both refer to the same
    // session row — there's no double bookkeeping.
    // Optionally remember this browser: issue a trusted-device token so future
    // password logins here can skip the OTP step-up for TRUSTED_DEVICE_DAYS.
    const cookies = [buildSessionCookie(sessionToken)];
    let deviceRemembered = false;
    if (rememberDevice) {
      try {
        const rawTrust = await issueTrustedDevice(otp.vendor_id, userAgent);
        cookies.push(buildTrustCookie(rawTrust, { host: hostFromHeaders(event.headers) }));
        deviceRemembered = true;
      } catch (e) {
        // Non-fatal: login still succeeds without the trusted-device cookie.
        console.error("issueTrustedDevice failed:", e);
      }
    }

    return jsonWithCookies(
      {
        success: true,
        session_token: sessionToken,
        expires_at: expiresAt,
        vendor,
        needs_password: authRows.length === 0,
        is_first_login: isFirstLogin,
        device_remembered: deviceRemembered,
      },
      cookies,
    );
  } catch (e) {
    console.error("auth-otp-verify error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
