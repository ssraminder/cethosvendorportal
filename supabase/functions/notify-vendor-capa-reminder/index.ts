// notify-vendor-capa-reminder — daily digest that chases vendors with an open
// CAPA/NC escalation whose response is overdue or due soon. Sibling of the
// admin-side qms-capa-reminder-daily cron (which chases STAFF about open CAPA
// actions); this one chases the VENDOR about their escalation response, via
// Brevo (per the 2026-05-12 decision: operational vendor sends go through
// Brevo, not Mailgun).
//
// OFF BY DEFAULT — gated on the app setting `vendor_escalation_reminders_enabled`
// (public.app_settings, staff-editable in the admin Settings UI). When it is not
// exactly 'true' the function verifies auth and then no-ops (sends nothing). The
// pg_cron job runs daily regardless; flipping the setting is the single on/off
// control, so no cron/infra change is needed to turn reminders on or off.
//
// Cron-only: authenticated with the shared cron secret (x-cron-secret), never a
// vendor session. Self-contained (no _shared imports) so it deploys cleanly via
// either the CLI or the Supabase MCP. Deploy with --no-verify-jwt / verify_jwt
// false — it authenticates by cron secret, not a JWT.
//
// POST application/json { "days"?: number }   // default 2

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const SETTING_KEY = "vendor_escalation_reminders_enabled";
const VENDOR_URL = "https://vendor.cethos.com/quality-actions";

interface ReminderItem {
  escalation_id: string;
  nc_id: string;
  nc_number: string;
  nc_title: string;
  vendor_id: string;
  vendor_name: string | null;
  vendor_email: string | null;
  status: string;
  response_due: string | null;
  days_to_due: number | null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function dueLabel(days: number | null): string {
  if (days == null) return "";
  if (days < 0) return `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "due today";
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}

// Minimal Brevo raw-email send (mirrors _shared/brevo.ts sendBrevoRawEmail).
// Inlined so this function has no relative deps and stays MCP-deploy-safe.
async function sendBrevoRawEmail(opts: {
  to: { email: string; name: string }[];
  subject: string;
  htmlContent: string;
  tags?: string[];
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    console.error("BREVO_API_KEY not configured — skipping send");
    return { sent: false, reason: "config_missing" };
  }
  const sender = {
    email: Deno.env.get("BREVO_SENDER_EMAIL") ?? "noreply@cethos.com",
    name: Deno.env.get("BREVO_SENDER_NAME") ?? "CETHOS Vendor Portal",
  };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender,
        to: opts.to,
        subject: opts.subject,
        htmlContent: opts.htmlContent,
        ...(opts.tags?.length ? { tags: opts.tags.slice(0, 10) } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Brevo send failed (${res.status}): ${body}`);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("Brevo send error:", err);
    return { sent: false, reason: "exception" };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return json({ success: false, error: "service_env_missing" }, 503);
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Cron-secret auth (shared secret in vault, fetched via RPC) ────────────
    const provided = req.headers.get("x-cron-secret") ?? "";
    if (!provided) return json({ success: false, error: "missing_cron_secret" }, 401);
    const { data: secret, error: secretErr } = await sb.rpc("get_cron_shared_secret");
    if (secretErr || typeof secret !== "string" || !secret) {
      return json({ success: false, error: "cron_secret_unavailable" }, 503);
    }
    if (!timingSafeEqual(provided, secret)) {
      return json({ success: false, error: "invalid_cron_secret" }, 401);
    }

    // ── Feature flag — OFF by default, staff-toggleable in app_settings ───────
    const { data: setting } = await sb
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle();
    const enabled = String(setting?.setting_value ?? "false").toLowerCase() === "true";
    if (!enabled) {
      return json({ success: true, enabled: false, skipped: "setting_disabled" });
    }

    const body = await req.json().catch(() => ({}));
    const days = Number.isFinite(body?.days) ? Number(body.days) : 2;

    const { data, error } = await sb.rpc("qms_vendor_escalation_reminders", { p_days: days });
    if (error) {
      console.error("qms_vendor_escalation_reminders error:", error.message);
      return json({ success: false, error: "Failed to read escalation reminders" }, 500);
    }

    const items: ReminderItem[] = Array.isArray(data) ? data : [];

    // Group by vendor so a vendor with several due escalations gets one email.
    const byVendor = new Map<string, ReminderItem[]>();
    for (const it of items) {
      if (!it.vendor_email) continue;
      const list = byVendor.get(it.vendor_id) ?? [];
      list.push(it);
      byVendor.set(it.vendor_id, list);
    }

    let sent = 0;
    let skipped = 0;
    for (const [, list] of byVendor) {
      const first = list[0];
      const name = first.vendor_name || "there";
      const anyOverdue = list.some((i) => (i.days_to_due ?? 0) < 0);

      const rows = list
        .map(
          (i) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#111;">
            <strong>${esc(i.nc_number)}</strong> — ${esc(i.nc_title || "Quality action")}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:${(i.days_to_due ?? 0) < 0 ? "#b91c1c" : "#92400e"};white-space:nowrap;">
            ${esc(dueLabel(i.days_to_due))}
          </td>
        </tr>`,
        )
        .join("");

      const subject = anyOverdue
        ? "Action needed: overdue quality (CAPA) response"
        : "Reminder: quality (CAPA) response due soon";

      const htmlContent = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111;">
          <p style="font-size:15px;">Hi ${esc(name)},</p>
          <p style="font-size:14px;line-height:1.5;">
            Cethos has raised the following quality action${list.length === 1 ? "" : "s"} to you and
            ${list.length === 1 ? "it still needs" : "they still need"} your response
            (root cause + corrective/preventive action). Please respond in the vendor portal.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #eee;">
            ${rows}
          </table>
          <p style="margin:20px 0;">
            <a href="${VENDOR_URL}" style="background:#0F9DA0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">
              Open Quality Actions
            </a>
          </p>
          <p style="font-size:12px;color:#666;line-height:1.5;">
            This is a required corrective-action step under our ISO 17100 quality process. If you have
            already responded outside the portal, please let your Cethos contact know so we can record it.
          </p>
        </div>`;

      const res = await sendBrevoRawEmail({
        to: [{ email: first.vendor_email as string, name: first.vendor_name || (first.vendor_email as string) }],
        subject,
        htmlContent,
        tags: ["capa-escalation-reminder"],
      });
      if (res.sent) sent++;
      else {
        skipped++;
        console.error(`capa reminder not sent to vendor ${first.vendor_id}: ${res.reason}`);
      }
    }

    return json({
      success: true,
      enabled: true,
      days,
      due_items: items.length,
      vendors_notified: sent,
      vendors_skipped: skipped,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("notify-vendor-capa-reminder error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
