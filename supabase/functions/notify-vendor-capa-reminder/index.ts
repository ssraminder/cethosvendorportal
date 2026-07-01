// notify-vendor-capa-reminder — daily digest that chases vendors with an open
// CAPA/NC escalation whose response is overdue or due soon. Sibling of the
// admin-side qms-capa-reminder-daily cron (which chases STAFF about open CAPA
// actions); this one chases the VENDOR about their escalation response, via
// Brevo (per the 2026-05-12 decision: operational vendor sends go through
// Brevo, not Mailgun).
//
// Cron-only: authenticated with the shared cron secret (x-cron-secret), never
// a vendor session. Reads public.qms_vendor_escalation_reminders(days) — a
// SECURITY DEFINER RPC that returns overdue/awaiting escalations (status in
// awaiting_ack | acknowledged | returned, response_due <= today + days) with
// the vendor's name + email. One email per vendor, listing all their due items.
//
// POST application/json { "days"?: number }   // default 2

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireCronSecret } from "../_shared/require-cron-secret.ts";
import { sendBrevoRawEmail } from "../_shared/brevo.ts";

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const auth = await requireCronSecret(req);
  if (!auth.ok) return json({ success: false, error: auth.error }, auth.status);

  try {
    const body = await req.json().catch(() => ({}));
    const days = Number.isFinite(body?.days) ? Number(body.days) : 2;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await sb.rpc("qms_vendor_escalation_reminders", { p_days: days });
    if (error) {
      console.error("qms_vendor_escalation_reminders error:", error.message);
      return json({ success: false, error: "Failed to read escalation reminders" }, 500);
    }

    const items: ReminderItem[] = Array.isArray(data) ? data : [];

    // Group by vendor so a vendor with several due escalations gets one email.
    const byVendor = new Map<string, ReminderItem[]>();
    for (const it of items) {
      if (!it.vendor_email) continue; // can't email without an address
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
        to: [{ email: first.vendor_email as string, name: first.vendor_name || first.vendor_email as string }],
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
