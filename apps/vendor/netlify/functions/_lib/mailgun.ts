/**
 * Mailgun helper for Netlify Functions. Sends operational emails (OTP
 * codes, etc.) via Mailgun's REST API. Lambda → mailgun.net is reachable
 * from anywhere — no regional block issues.
 *
 * Env vars (set in Netlify):
 *   MAILGUN_API_KEY       — your Mailgun private API key
 *   MAILGUN_DOMAIN        — e.g. reply.cethos.com (the sending subdomain you've verified in Mailgun)
 *   MAILGUN_SENDER_EMAIL  — e.g. vm@reply.cethos.com
 *   MAILGUN_SENDER_NAME   — e.g. "Cethos Vendor Portal"
 *
 * If MAILGUN_SENDER_NAME is set, the From header is composed as
 *   "Cethos Vendor Portal <vm@reply.cethos.com>"
 * Otherwise the bare email is used.
 */

interface MailgunSendArgs {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  tags?: string[];
}

// Quote a display name per RFC 5322 §3.4. If the name contains any
// `specials` chars (paren, angle, comma, colon, etc.) or non-ASCII, it
// must be wrapped in a quoted-string with embedded backslashes/quotes
// escaped. Mailgun's parser is strict — "Test Vendor (Dutch→English)"
// without quoting gets rejected with "to parameter is not a valid
// address".
function rfc5322DisplayName(name: string): string {
  const needsQuoting = /[\(\)<>\[\]:;@\\,"]|[^\x20-\x7E]/.test(name);
  if (!needsQuoting) return name;
  return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function sendMailgun(args: MailgunSendArgs): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    return { sent: false, reason: "mailgun_not_configured" };
  }

  const senderEmail = process.env.MAILGUN_SENDER_EMAIL
    ?? process.env.MAILGUN_FROM_EMAIL
    ?? `noreply@${domain}`;
  const senderName = process.env.MAILGUN_SENDER_NAME;
  const from = senderName ? `${rfc5322DisplayName(senderName)} <${senderEmail}>` : senderEmail;

  const toFormatted = args.to.name
    ? `${rfc5322DisplayName(args.to.name)} <${args.to.email}>`
    : args.to.email;

  const formData = new URLSearchParams();
  formData.append("from", from);
  formData.append("to", toFormatted);
  formData.append("subject", args.subject);
  formData.append("html", args.html);
  for (const tag of args.tags || []) formData.append("o:tag", tag);

  // Mailgun has two regions — default is US. If your Mailgun account is
  // on EU, set MAILGUN_API_BASE=https://api.eu.mailgun.net in Netlify.
  const apiBase = process.env.MAILGUN_API_BASE ?? "https://api.mailgun.net";

  try {
    const res = await fetch(`${apiBase}/v3/${domain}/messages`, {
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
