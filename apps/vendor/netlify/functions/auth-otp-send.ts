/**
 * Netlify Function: auth-otp-send
 * Drop-in for Supabase Edge `vendor-auth-otp-send`. Direct Postgres +
 * direct Mailgun.
 *
 * POST /sb/auth-otp-send
 * Body: { email: string, channel: "email" }
 * Returns: { success, channel, masked_contact }
 */

import { query } from "./_lib/db";
import { sendBrevo } from "./_lib/brevo";
import { sendMailgun } from "./_lib/mailgun";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { generateOtp, generateSalt, hashOtp } from "./_lib/otp-crypto";

interface Vendor {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}

export const handler = async (event: { body: string | null; isBase64Encoded?: boolean }): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      email?: string;
      channel?: "email" | "sms";
    };
    const email = (body.email ?? "").toLowerCase().trim();
    const channel = body.channel ?? "email";
    if (!email) return err("Email is required", 400);
    if (channel !== "email") {
      // Phase 1 of the migration only supports email OTP. SMS path can be
      // ported later if needed; vendor portal defaults to email anyway.
      return err("Only email channel supported", 400);
    }

    const vendors = await query<Vendor>(
      "SELECT id, full_name, email, phone FROM vendors WHERE email = $1 LIMIT 1",
      [email],
    );
    const vendor = vendors[0];
    if (!vendor) {
      return err("No vendor account found for this email", 404);
    }

    // Rate limit: deny if a non-verified OTP was issued in the last 60s
    const recent = await query<{ id: string }>(
      `SELECT id FROM vendor_otp
       WHERE vendor_id = $1 AND verified = false
         AND created_at > now() - INTERVAL '60 seconds'
       LIMIT 1`,
      [vendor.id],
    );
    if (recent.length > 0) {
      return err("Please wait before requesting another code", 429);
    }

    // Crypto-strong 6-digit OTP + per-row salt. Store only the hash in
    // the DB; the raw code lives just in this scope + the email body.
    // Audit finding H-4.
    const otpCode = generateOtp();
    const salt = generateSalt();
    const otpHash = hashOtp(otpCode, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO vendor_otp
         (vendor_id, email, phone, channel, otp_hash, salt, attempts, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7)`,
      [vendor.id, vendor.email, vendor.phone, channel, otpHash, salt, expiresAt],
    );

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="padding: 24px;">
    <p style="color: #374151; font-size: 15px;">Hi ${vendor.full_name},</p>
    <p style="color: #374151; font-size: 15px; line-height: 1.5;">Your CETHOS verification code is:</p>
    <div style="text-align: center; margin: 24px 0;">
      <div style="display: inline-block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px 40px;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: 'Courier New', monospace;">${otpCode}</span>
      </div>
    </div>
    <p style="color: #6b7280; font-size: 13px; text-align: center;">This code expires in 10 minutes.</p>
    <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">If you did not request this code, you can safely ignore this email.</p>
  </div>
</div>`;

    // Try Brevo first (vendor portal's standard provider). Fall back to
    // Mailgun if Brevo isn't configured — covers either env-var setup.
    const useBrevo = !!process.env.BREVO_API_KEY;
    const sendResult = useBrevo
      ? await sendBrevo({
          to: { email: vendor.email, name: vendor.full_name },
          subject: `${otpCode} is your CETHOS verification code`,
          html,
          tags: ["vendor-auth-otp"],
        })
      : await sendMailgun({
          to: { email: vendor.email, name: vendor.full_name },
          subject: `${otpCode} is your CETHOS verification code`,
          html,
          tags: ["vendor-auth-otp"],
        });

    if (!sendResult.sent) {
      console.error(`Email send failed via ${useBrevo ? "Brevo" : "Mailgun"}:`, sendResult.reason);
      return err("Failed to send email", 502, { detail: sendResult.reason });
    }

    return json({
      success: true,
      channel: "email",
      masked_contact: maskEmail(vendor.email),
    });
  } catch (e) {
    console.error("auth-otp-send error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
