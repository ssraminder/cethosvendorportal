/**
 * Twilio SMS helper. Mirrors the Supabase Edge `vendor-verify-phone`
 * usage so env vars (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_FROM_NUMBER) carry over.
 */

interface SendSmsArgs {
  to: string;
  body: string;
}

export async function sendTwilioSms(args: SendSmsArgs): Promise<{ sent: boolean; reason?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { sent: false, reason: "twilio_not_configured" };
  }

  const params = new URLSearchParams({ To: args.to, From: from, Body: args.body });
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { sent: false, reason: `twilio_${res.status}: ${text.slice(0, 200)}` };
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
