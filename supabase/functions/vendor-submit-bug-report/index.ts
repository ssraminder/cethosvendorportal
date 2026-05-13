// ============================================================================
// vendor-submit-bug-report
//
// Accepts a multipart/form-data submission from the vendor-portal Bug
// Report modal:
//   session_token   string  (required) — vendor session UUID in body
//   title           string  (required)
//   description     string  (required)
//   url             string
//   user_agent      string
//   viewport        string  (JSON)
//   console_logs    string  (JSON array)
//   screenshot      File    (optional PNG)
//
// Inserts a bug_reports row, uploads the screenshot to the private
// bug-report-screenshots bucket, emails the staff support inbox.
//
// Auth: vendor session in the body (works regardless of verify_jwt at
// the gateway — same dual-auth pattern as cvp-get-my-domains).
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "bug-report-screenshots";
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const STAFF_SUPPORT_EMAIL = Deno.env.get("BUG_REPORT_TO_EMAIL") ?? "vm@cethos.com";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ success: false, error: "expected_multipart_form" }, 400);
  }

  const sessionToken = String(form.get("session_token") ?? "").trim();
  const title = String(form.get("title") ?? "").trim().slice(0, 250);
  const description = String(form.get("description") ?? "").trim().slice(0, 8000);
  const url = String(form.get("url") ?? "").slice(0, 1000) || null;
  const userAgent = String(form.get("user_agent") ?? "").slice(0, 500) || null;
  const viewportRaw = String(form.get("viewport") ?? "");
  const consoleLogsRaw = String(form.get("console_logs") ?? "");
  const screenshot = form.get("screenshot");

  if (!sessionToken) return json({ success: false, error: "session_token_required" }, 400);
  if (!title) return json({ success: false, error: "title_required" }, 400);
  if (description.length < 10) return json({ success: false, error: "description_too_short" }, 400);

  let viewport: Record<string, unknown> | null = null;
  try { viewport = viewportRaw ? JSON.parse(viewportRaw) : null; } catch { viewport = null; }
  let consoleLogs: unknown = null;
  try { consoleLogs = consoleLogsRaw ? JSON.parse(consoleLogsRaw) : null; } catch { consoleLogs = null; }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Resolve the vendor from session_token. We persist anonymous reports
  // too — if the session is invalid we still record the report (helps
  // if a vendor is hitting an auth bug); just leave vendor_id null.
  let vendorId: string | null = null;
  let vendorEmail: string | null = null;
  let vendorName: string | null = null;
  if (sessionToken) {
    const { data: sess } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", sessionToken)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sess?.vendor_id) {
      vendorId = sess.vendor_id as string;
      const { data: v } = await supabase
        .from("vendors")
        .select("email, full_name")
        .eq("id", vendorId)
        .maybeSingle();
      vendorEmail = (v?.email as string | undefined) ?? null;
      vendorName = (v?.full_name as string | undefined) ?? null;
    }
  }

  // Insert the row first so we have an id for the storage path.
  const { data: inserted, error: insErr } = await supabase
    .from("bug_reports")
    .insert({
      vendor_id: vendorId,
      reporter_email: vendorEmail,
      title,
      description,
      url,
      user_agent: userAgent,
      viewport,
      console_logs: consoleLogs,
    })
    .select("id, created_at")
    .single();
  if (insErr || !inserted) {
    return json({ success: false, error: "insert_failed", detail: insErr?.message }, 500);
  }

  let storagePath: string | null = null;
  if (screenshot instanceof File && screenshot.size > 0) {
    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      // Don't fail the whole submission — just skip the screenshot.
      console.warn(`bug-report ${inserted.id}: screenshot too large (${screenshot.size}), skipped.`);
    } else {
      const path = `${vendorId ?? "anonymous"}/${inserted.id}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, screenshot, { contentType: "image/png", upsert: false });
      if (!upErr) {
        storagePath = path;
        await supabase
          .from("bug_reports")
          .update({ screenshot_storage_path: storagePath })
          .eq("id", inserted.id);
      } else {
        console.warn(`bug-report ${inserted.id}: screenshot upload failed`, upErr);
      }
    }
  }

  // Mint a short-lived signed URL for staff to view the screenshot
  // straight from the email. Hour is plenty for the first read; staff
  // can re-mint from the admin DB if needed.
  let signedUrl: string | null = null;
  if (storagePath) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    signedUrl = signed?.signedUrl ?? null;
  }

  // Fire-and-forget staff notification email.
  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (BREVO_API_KEY) {
      const consolePreview = Array.isArray(consoleLogs)
        ? (consoleLogs as Array<Record<string, unknown>>)
            .slice(-15)
            .map((e) => `[${e.level}] ${e.ts} — ${String(e.message).slice(0, 300)}`)
            .join("\n")
        : "(none)";
      const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:20px;">
<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
  <h1 style="font-size:16px;color:#0f766e;margin:0 0 12px;">Bug report — ${escapeHtml(title)}</h1>
  <p style="margin:0 0 8px;font-size:13px;color:#374151;">
    From: <strong>${escapeHtml(vendorName ?? vendorEmail ?? "anonymous")}</strong>
    ${vendorEmail ? ` &lt;${escapeHtml(vendorEmail)}&gt;` : ""}
  </p>
  <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">
    ${url ? `Page: ${escapeHtml(url)}<br/>` : ""}
    ${userAgent ? `UA: ${escapeHtml(userAgent)}<br/>` : ""}
    Bug ID: <code>${inserted.id}</code> · ${new Date(inserted.created_at).toLocaleString()}
  </p>
  <hr/>
  <h2 style="font-size:13px;color:#111827;">Description</h2>
  <pre style="white-space:pre-wrap;font-family:inherit;color:#1f2937;font-size:13px;">${escapeHtml(description)}</pre>
  ${signedUrl ? `<p><a href="${escapeHtml(signedUrl)}" style="color:#0891B2;">📷 View screenshot</a> (link valid 7 days)</p>` : "<p style=\"color:#9ca3af;font-size:12px;\">(no screenshot)</p>"}
  <h2 style="font-size:13px;color:#111827;">Recent console output (last 15)</h2>
  <pre style="white-space:pre-wrap;font-family:Consolas,monospace;font-size:11px;color:#374151;background:#f9fafb;padding:8px;border:1px solid #e5e7eb;border-radius:4px;">${escapeHtml(consolePreview)}</pre>
</div></body></html>`;
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: [{ email: STAFF_SUPPORT_EMAIL }],
          sender: { name: "Cethos Vendor Bug Reports", email: "donotreply@cethos.com" },
          replyTo: vendorEmail ? { email: vendorEmail, name: vendorName || vendorEmail } : undefined,
          subject: `[Vendor Bug] ${title.slice(0, 80)}`,
          htmlContent: html,
          tags: ["vendor-bug-report"],
        }),
      });
    }
  } catch (e) {
    console.error("bug-report email failed", e);
  }

  return json({ success: true, data: { id: inserted.id } });
});
