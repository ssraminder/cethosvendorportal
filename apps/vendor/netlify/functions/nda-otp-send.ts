/**
 * Netlify Function: nda-otp-send
 * Sends an OTP code for a single channel (email or phone) tied to the
 * NDA signing flow. Codes are written to vendor_otp with channel
 * 'nda_email' or 'nda_phone' so the NDA signing endpoint can verify
 * recent both-factor confirmation without sharing state with the login
 * OTP flow.
 *
 * POST /sb/nda-otp-send
 * Body: { session_token, channel: "email" | "phone" }
 * Returns: { success, channel, masked_contact }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { sendBrevo } from "./_lib/brevo";
import { sendMailgun } from "./_lib/mailgun";
import { sendTwilioSms, maskPhone } from "./_lib/twilio";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { generateOtp, generateSalt, hashOtp } from "./_lib/otp-crypto";

interface VendorRow {
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

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      channel?: "email" | "phone";
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const channel = body.channel;
    if (channel !== "email" && channel !== "phone") {
      return err("channel must be 'email' or 'phone'", 400);
    }
    const ndaChannel = channel === "email" ? "nda_email" : "nda_phone";

    const vendors = await query<VendorRow>(
      "SELECT id, full_name, email, phone FROM vendors WHERE id = $1 LIMIT 1",
      [vendor_id],
    );
    const vendor = vendors[0];
    if (!vendor) return err("Vendor not found", 404);

    if (channel === "phone" && !vendor.phone) {
      return err("No phone number on file. Add one in Profile first.", 400);
    }

    // Rate limit per channel: 60-second window
    const recent = await query<{ id: string }>(
      `SELECT id FROM vendor_otp
       WHERE vendor_id = $1 AND channel = $2 AND verified = false
         AND created_at > now() - INTERVAL '60 seconds'
       LIMIT 1`,
      [vendor.id, ndaChannel],
    );
    if (recent.length > 0) {
      return err("Please wait before requesting another code", 429);
    }

    // Same hash-at-rest pattern as vendor-auth OTP (audit H-4). Raw code
    // only lives in this scope + the email/SMS body; DB stores hash+salt.
    const code = generateOtp();
    const salt = generateSalt();
    const otpHash = hashOtp(code, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO vendor_otp
         (vendor_id, email, phone, channel, otp_hash, salt, attempts, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7)`,
      [vendor.id, vendor.email, vendor.phone, ndaChannel, otpHash, salt, expiresAt],
    );

    if (channel === "email") {
      const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="padding: 24px;">
    <p style="color: #374151; font-size: 15px;">Hi ${vendor.full_name},</p>
    <p style="color: #374151; font-size: 15px; line-height: 1.5;">Your NDA signing verification code is:</p>
    <div style="text-align: center; margin: 24px 0;">
      <div style="display: inline-block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px 40px; font-family: monospace; font-size: 32px; letter-spacing: 8px; color: #0F9DA0; font-weight: 700;">${code}</div>
    </div>
    <p style="color: #6b7280; font-size: 13px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  </div>
</div>`;
      const subject = "Your CETHOS NDA verification code";

      let result = await sendBrevo({
        to: { email: vendor.email, name: vendor.full_name },
        subject,
        html,
        tags: ["nda-otp"],
      });
      if (!result.sent) {
        // Brevo not configured or hard-failed; fall back to Mailgun. Either
        // provider gives us the same user-visible behaviour.
        result = await sendMailgun({
          to: { email: vendor.email, name: vendor.full_name },
          subject,
          html,
          tags: ["nda-otp"],
        });
      }
      if (!result.sent) {
        return err("Failed to send verification email", 500, { detail: result.reason });
      }

      return json({ success: true, channel: "email", masked_contact: maskEmail(vendor.email) });
    }

    // Phone
    const smsBody = `Your CETHOS NDA verification code is ${code}. It expires in 10 minutes.`;
    const sms = await sendTwilioSms({ to: vendor.phone as string, body: smsBody });
    if (!sms.sent) {
      return err("Failed to send verification SMS", 500, { detail: sms.reason });
    }

    return json({ success: true, channel: "phone", masked_contact: maskPhone(vendor.phone as string) });
  } catch (e) {
    console.error("nda-otp-send error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
