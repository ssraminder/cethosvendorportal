/**
 * Brevo (Sendinblue) helper for Netlify Functions. Matches the existing
 * Supabase _shared/brevo.ts patterns so env vars carry over directly.
 *
 * Env vars required (set in Netlify):
 *   BREVO_API_KEY
 *   BREVO_SENDER_EMAIL   (e.g. noreply@cethos.com)
 *   BREVO_SENDER_NAME    (e.g. "CETHOS Vendor Portal")
 */

interface BrevoSendArgs {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  tags?: string[];
}

export async function sendBrevo(args: BrevoSendArgs): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "brevo_not_configured" };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "noreply@cethos.com";
  const senderName = process.env.BREVO_SENDER_NAME ?? "CETHOS Vendor Portal";

  const payload = {
    to: [args.to],
    sender: { email: senderEmail, name: senderName },
    subject: args.subject,
    htmlContent: args.html,
    tags: args.tags,
  };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, reason: `${res.status}: ${errText.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
