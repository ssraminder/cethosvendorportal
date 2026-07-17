/**
 * SMS helper — relays through the Supabase `vendor-send-sms` edge function.
 *
 * WHY NOT CALL TWILIO DIRECTLY FROM HERE:
 * The Twilio credentials live ONLY in Supabase. Netlify holds the Mailgun /
 * Brevo / DB secrets, but its TWILIO_* copies had gone stale — Twilio answered
 * 20003 ("Authenticate") and SMS silently failed (vendor login "Text me the
 * code instead", and NDA phone OTP). Rather than keep two copies of the same
 * credentials in sync — the drift that caused that outage — this mints a
 * short-lived `service_role` JWT with SUPABASE_JWT_SECRET (already in Netlify
 * env; same technique as storage.ts) and lets the edge function hold the only
 * copy of the Twilio credentials.
 *
 * The edge function is verify_jwt=true AND checks the role claim is
 * service_role — the anon key is public, so signature-validity alone would
 * leave it an open SMS relay.
 *
 * Signature is unchanged, so call sites (auth-otp-send, nda-otp-send) are not
 * affected.
 */

import { createHmac } from "crypto";

interface SendSmsArgs {
  to: string;
  body: string;
}

const RELAY_PATH = "/functions/v1/vendor-send-sms";
/** Short-lived: the token is minted and used immediately, server-to-server. */
const JWT_TTL_SECONDS = 60;

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** HS256 service_role JWT signed with the project JWT secret. */
function mintServiceRoleJwt(secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    role: "service_role",
    iss: "supabase",
    iat: now,
    exp: now + JWT_TTL_SECONDS,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${base64url(signature)}`;
}

export async function sendTwilioSms(args: SendSmsArgs): Promise<{ sent: boolean; reason?: string }> {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseUrl || !secret) {
    return { sent: false, reason: "sms_relay_not_configured" };
  }

  try {
    const token = mintServiceRoleJwt(secret);
    const res = await fetch(`${supabaseUrl}${RELAY_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: args.to, body: args.body }),
    });

    const data = (await res.json().catch(() => ({}))) as { sent?: boolean; reason?: string };
    if (!res.ok || !data.sent) {
      return { sent: false, reason: data.reason || `sms_relay_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return "***";
  return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
}
