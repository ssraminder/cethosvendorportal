/**
 * Shared Mailgun transport for CVP edge functions.
 *
 * Replaces the older Brevo transport (_shared/brevo.ts). All outbound CVP email
 * now routes through Mailgun EU. Templates live in _shared/email-templates.ts;
 * this module only handles the HTTP POST to Mailgun + the do_not_contact gate.
 *
 * Required env vars (Supabase → Edge Functions → Secrets):
 *   MAILGUN_API_KEY
 *   MAILGUN_DOMAIN              e.g. vendors.cethos.com
 *   MAILGUN_REGION              'eu' (this project) or 'us'
 *   MAILGUN_FROM_EMAIL          e.g. noreply@vendors.cethos.com
 *   MAILGUN_FROM_NAME           e.g. CETHOS Vendor Portal
 *   MAILGUN_REPLY_TO            e.g. recruiting@vendors.cethos.com
 *   MAILGUN_WEBHOOK_SIGNING_KEY (inbound — used by cvp-inbound-email, not here)
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface MailgunSendOptions {
  to: { email: string; name?: string } | { email: string; name?: string }[];
  subject: string;
  html: string;
  text?: string;
  /**
   * Override the default Reply-To (MAILGUN_REPLY_TO). Rarely needed.
   */
  replyTo?: string;
  /**
   * Mailgun tags (o:tag) for analytics / log filtering. Max 3 per send.
   */
  tags?: string[];
  /**
   * When provided, skip the send if cvp_applications.do_not_contact=true for this email.
   * Pass the normalized recipient email you want gated (useful when `to` is a list).
   */
  respectDoNotContactFor?: string;
}

export interface MailgunSendResult {
  sent: boolean;
  suppressed: boolean;
  reason?: string;
  mailgunId?: string;
}

function apiBase(): string {
  const region = (Deno.env.get("MAILGUN_REGION") ?? "us").toLowerCase();
  return region === "eu"
    ? "https://api.eu.mailgun.net/v3"
    : "https://api.mailgun.net/v3";
}

function formatAddress(r: { email: string; name?: string }): string {
  return r.name ? `${r.name} <${r.email}>` : r.email;
}

async function isDoNotContact(
  supabase: SupabaseClient,
  email: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cvp_applications")
    .select("do_not_contact")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`do_not_contact lookup failed for ${email}:`, error.message);
    return false; // fail-open — don't block delivery on an infra hiccup
  }
  return Boolean(data?.do_not_contact);
}

/**
 * Send a fully-rendered email via Mailgun.
 * Non-throwing: returns `{ sent: false, reason }` on failure and logs.
 */
export async function sendMailgunEmail(
  options: MailgunSendOptions,
): Promise<MailgunSendResult> {
  const apiKey = Deno.env.get("MAILGUN_API_KEY");
  const domain = Deno.env.get("MAILGUN_DOMAIN");
  if (!apiKey || !domain) {
    console.error("MAILGUN_API_KEY or MAILGUN_DOMAIN missing — skipping send");
    return { sent: false, suppressed: false, reason: "config_missing" };
  }

  const fromEmail = Deno.env.get("MAILGUN_FROM_EMAIL") ?? `noreply@${domain}`;
  const fromName = Deno.env.get("MAILGUN_FROM_NAME") ?? "CETHOS";
  const replyTo = options.replyTo ?? Deno.env.get("MAILGUN_REPLY_TO");

  // do_not_contact gate
  if (options.respectDoNotContactFor) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const blocked = await isDoNotContact(
        supabase,
        options.respectDoNotContactFor,
      );
      if (blocked) {
        console.log(
          `Mailgun: suppressed (do_not_contact) for ${options.respectDoNotContactFor}`,
        );
        return { sent: false, suppressed: true, reason: "do_not_contact" };
      }
    } catch (err) {
      console.error("do_not_contact check errored — proceeding with send:", err);
    }
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const form = new FormData();
  form.append("from", `${fromName} <${fromEmail}>`);
  for (const r of recipients) form.append("to", formatAddress(r));
  if (replyTo) form.append("h:Reply-To", replyTo);
  form.append("subject", options.subject);
  form.append("html", options.html);
  if (options.text) form.append("text", options.text);
  if (options.tags?.length) {
    for (const tag of options.tags.slice(0, 3)) form.append("o:tag", tag);
  }

  const url = `${apiBase()}/${domain}/messages`;
  const auth = `Basic ${btoa(`api:${apiKey}`)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth },
      body: form,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Mailgun send failed (${options.subject}): ${response.status} — ${errorBody}`,
      );
      return {
        sent: false,
        suppressed: false,
        reason: `http_${response.status}`,
      };
    }
    const json = (await response.json()) as { id?: string };
    return { sent: true, suppressed: false, mailgunId: json.id };
  } catch (err) {
    console.error(`Mailgun send error (${options.subject}):`, err);
    return { sent: false, suppressed: false, reason: "exception" };
  }
}

/**
 * Convenience: send without the gate. Equivalent to sendMailgunEmail without
 * respectDoNotContactFor — used for operational emails (daily-status digest,
 * staff-facing notifications) that should not be suppressed by applicant opt-outs.
 */
export async function sendMailgunOperationalEmail(
  options: Omit<MailgunSendOptions, "respectDoNotContactFor">,
): Promise<MailgunSendResult> {
  return sendMailgunEmail(options);
}
