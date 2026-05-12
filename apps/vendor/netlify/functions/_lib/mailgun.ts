/**
 * Mailgun helper for Netlify Functions. Sends operational emails (OTP
 * codes, etc.) via Mailgun's REST API. Lambda → mailgun.net is reachable
 * from anywhere — no regional block issues.
 *
 * Env vars required (set in Netlify):
 *   MAILGUN_API_KEY
 *   MAILGUN_DOMAIN          (e.g. mg.cethos.com)
 *   MAILGUN_FROM_EMAIL      (e.g. CETHOS <noreply@cethos.com>)
 */

interface MailgunSendArgs {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  tags?: string[];
}

export async function sendMailgun(args: MailgunSendArgs): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `noreply@${domain}`;
  if (!apiKey || !domain) {
    return { sent: false, reason: "mailgun_not_configured" };
  }

  const toFormatted = args.to.name
    ? `${args.to.name} <${args.to.email}>`
    : args.to.email;

  const formData = new URLSearchParams();
  formData.append("from", fromEmail);
  formData.append("to", toFormatted);
  formData.append("subject", args.subject);
  formData.append("html", args.html);
  for (const tag of args.tags || []) formData.append("o:tag", tag);

  try {
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
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
