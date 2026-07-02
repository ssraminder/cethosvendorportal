/**
 * Vendor-portal email sender with provider failover.
 *
 * Two failure modes this guards against:
 *
 *  1. Synchronous provider failure — Brevo (or Mailgun) returns a non-2xx
 *     at the API call. We immediately retry with the other provider.
 *
 *  2. Recipient ISPs that blocklist a provider's shared sending IPs at the
 *     SMTP handshake. Brevo returns HTTP 201 (accepted) and then the mail
 *     *soft-bounces asynchronously* minutes later at the receiving MTA, so
 *     the send call never sees the failure. We can't fail over on a bounce
 *     we never observe — instead we route recipients on known-blocked
 *     domains to Mailgun (different IP reputation) *first*.
 *
 *     Confirmed 2026-07-01: fibertel.com.ar (Telecom Argentina) rejects
 *     Brevo's IPs (77.32.148.20 / 185.41.28.128) with
 *       554-5.7.1 <gt.d.sender-sib.com>: Helo command rejected: spam!!
 *     One applicant requested 15 OTP codes in 24h and received none while
 *     the portal reported "code sent". See admin repo memory
 *     feature_email_brevo_mailgun_failover_2026_06_29 for the sibling fix.
 *
 * The blocked-domain list is seeded in code (always available, even if the
 * DB is unreachable) and *unioned* with an ops-editable app_settings row
 * `email_brevo_blocked_domains` (JSON array or comma/newline list) so new
 * blocking ISPs can be added without a redeploy.
 */

import { sendBrevo } from "./brevo";
import { sendMailgun } from "./mailgun";
import { query } from "./db";

export interface VendorEmailArgs {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  tags?: string[];
  /**
   * Login-critical mail (sign-in / NDA verification codes). Forces Mailgun
   * first for EVERY recipient, not just the blocked-domain list. Brevo
   * accepts with HTTP 201 and then soft-bounces asynchronously at some
   * recipient MTAs, so a code sent Brevo-first can silently vanish and the
   * user is simply locked out. Mailgun (dedicated domain reply.cethos.com,
   * different IP reputation) is our most deliverable path, so we lead with
   * it for anything that gates access. Brevo stays as the fallback.
   */
  loginCritical?: boolean;
}

export interface VendorEmailResult {
  sent: boolean;
  /** Provider that actually delivered (when sent). */
  provider?: "brevo" | "mailgun";
  /** Combined failure reason when every provider failed. */
  reason?: string;
  /** Per-provider outcome, in the order attempted. */
  attempts: Array<{ provider: "brevo" | "mailgun"; sent: boolean; reason?: string }>;
}

// Recipient domains whose mail operators reject Brevo's shared sending IPs.
// Route these to Mailgun first. Keep lowercase, bare domain (no @).
const BREVO_BLOCKED_DOMAINS_SEED: readonly string[] = [
  "fibertel.com.ar", // Telecom Argentina — confirmed 2026-07-01
  "arnet.com.ar", // Telecom Argentina (same infra) — precautionary
];

const BLOCKLIST_TTL_MS = 60_000;
let blocklistCache: { at: number; domains: Set<string> } | null = null;

function nowMs(): number {
  return Date.now();
}

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() ?? "";
}

/**
 * Load the effective blocked-domain set: the code seed unioned with the
 * ops-editable app_settings row. Cached briefly to avoid a DB round-trip on
 * every send. A settings-lookup failure never breaks sending — we fall back
 * to the seed.
 */
async function loadBlockedDomains(): Promise<Set<string>> {
  if (blocklistCache && nowMs() - blocklistCache.at < BLOCKLIST_TTL_MS) {
    return blocklistCache.domains;
  }
  const domains = new Set<string>(BREVO_BLOCKED_DOMAINS_SEED);
  try {
    const rows = await query<{ setting_value: string | null }>(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'email_brevo_blocked_domains' LIMIT 1",
    );
    const raw = rows[0]?.setting_value?.trim();
    if (raw) {
      let extra: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) extra = parsed.map((d) => String(d));
      } catch {
        extra = raw.split(/[,\n]/);
      }
      for (const d of extra) {
        const norm = d.trim().toLowerCase().replace(/^@/, "");
        if (norm) domains.add(norm);
      }
    }
  } catch (e) {
    console.warn(
      "[email-send] blocked-domains lookup failed; using code seed:",
      e instanceof Error ? e.message : String(e),
    );
  }
  blocklistCache = { at: nowMs(), domains };
  return domains;
}

/**
 * Send a vendor email with automatic provider failover.
 *
 * - Login-critical mail (args.loginCritical) → Mailgun first for everyone,
 *   Brevo fallback. Access-gating codes can't afford Brevo's silent async
 *   soft-bounce, so we always lead with our most deliverable provider.
 * - Recipients on known Brevo-blocked domains → Mailgun first, Brevo fallback.
 * - Everyone else → Brevo first (portal's standard provider), Mailgun fallback
 *   on synchronous failure.
 *
 * Returns which provider succeeded, or a combined reason if all failed.
 */
export async function sendVendorEmail(args: VendorEmailArgs): Promise<VendorEmailResult> {
  const blocked = await loadBlockedDomains();
  const mailgunFirst = args.loginCritical === true || blocked.has(domainOf(args.to.email));
  const order: Array<"brevo" | "mailgun"> = mailgunFirst
    ? ["mailgun", "brevo"]
    : ["brevo", "mailgun"];

  const attempts: VendorEmailResult["attempts"] = [];
  for (const provider of order) {
    const r = provider === "brevo" ? await sendBrevo(args) : await sendMailgun(args);
    attempts.push({ provider, sent: r.sent, reason: r.reason });
    if (r.sent) return { sent: true, provider, attempts };
  }

  return {
    sent: false,
    reason: attempts.map((a) => `${a.provider}:${a.reason ?? "unknown"}`).join(" | "),
    attempts,
  };
}
