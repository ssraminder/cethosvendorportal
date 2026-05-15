/**
 * Netlify Function: nda-otp-verify
 * Verifies a single-channel NDA OTP. Marks the matching vendor_otp row
 * as verified. The sign-nda endpoint then requires BOTH 'nda_email' and
 * 'nda_phone' rows verified within the last 30 minutes.
 *
 * POST /sb/nda-otp-verify
 * Body: { session_token, channel: "email" | "phone", code: string }
 * Returns: { success, channel }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import {
  hashOtp,
  OTP_LOCKOUT_MINUTES,
  OTP_MAX_ATTEMPTS,
  timingSafeEqual,
} from "./_lib/otp-crypto";

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      channel?: "email" | "phone";
      code?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const channel = body.channel;
    const code = (body.code ?? "").trim();
    if (channel !== "email" && channel !== "phone") {
      return err("channel must be 'email' or 'phone'", 400);
    }
    if (!/^\d{6}$/.test(code)) {
      return err("Code must be 6 digits", 400);
    }

    const ndaChannel = channel === "email" ? "nda_email" : "nda_phone";

    // Hash-and-compare (audit H-4 pattern). Latest unverified, unexpired
    // OTP for this vendor + channel; then timing-safe hash match.
    const rows = await query<{
      id: string;
      otp_hash: string | null;
      salt: string | null;
      attempts: number;
      locked_until: string | null;
    }>(
      `SELECT id, otp_hash, salt, attempts, locked_until
         FROM vendor_otp
        WHERE vendor_id = $1 AND channel = $2 AND verified = false
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1`,
      [vendor_id, ndaChannel],
    );
    const row = rows[0];
    if (!row) {
      return err("Invalid or expired code", 400);
    }

    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return err("Too many attempts. Request a new code.", 429);
    }

    const match =
      row.otp_hash != null &&
      row.salt != null &&
      timingSafeEqual(hashOtp(code, row.salt), row.otp_hash);

    if (!match) {
      const newAttempts = row.attempts + 1;
      const shouldLock = newAttempts >= OTP_MAX_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + OTP_LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;
      await query(
        `UPDATE vendor_otp SET attempts = $2, locked_until = $3 WHERE id = $1`,
        [row.id, newAttempts, lockedUntil],
      );
      return err(
        shouldLock ? "Too many attempts. Request a new code." : "Invalid or expired code",
        shouldLock ? 429 : 400,
      );
    }

    await query(
      `UPDATE vendor_otp SET verified = true WHERE id = $1`,
      [row.id],
    );

    return json({ success: true, channel });
  } catch (e) {
    console.error("nda-otp-verify error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
