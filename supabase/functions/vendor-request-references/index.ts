/**
 * vendor-request-references
 *
 * Admin invokes from the vendor-detail Documents tab to ask an
 * already-onboarded vendor for fresh references. Parallel to
 * cvp-request-references but writes to vendor_reference_requests.
 *
 * Body: {
 *   vendor_id: string,         // required
 *   staff_message?: string,    // optional plain-text body for the email
 *   staff_id?: string,
 *   expiry_days?: number,      // default 14
 *   dry_run?: boolean          // if true, return preview without sending
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunEmail } from "../_shared/mailgun.ts";
import { buildVendorReferencesRequest } from "../_shared/vendor-reference-emails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const VENDOR_URL_FALLBACK = "https://vendor.cethos.com";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: {
    vendor_id?: string;
    staff_message?: string;
    staff_id?: string;
    expiry_days?: number;
    dry_run?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  if (!body.vendor_id) return json({ success: false, error: "vendor_id_required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: vendor, error: vErr } = await supabase
    .from("vendors")
    .select("id, full_name, email")
    .eq("id", body.vendor_id)
    .maybeSingle();
  if (vErr || !vendor) return json({ success: false, error: "vendor_not_found" }, 404);

  const expiryDays = Math.min(Math.max(Number(body.expiry_days ?? 14), 1), 60);
  const staffMessage = (body.staff_message ?? "").trim() || null;
  const vendorUrl = Deno.env.get("VENDOR_PORTAL_URL") ?? VENDOR_URL_FALLBACK;

  if (body.dry_run) {
    const tpl = buildVendorReferencesRequest({
      vendorFullName: vendor.full_name,
      staffMessage,
      contactsLinkUrl: `${vendorUrl}/vendor-references/PREVIEW-TOKEN`,
      expiryDays,
    });
    return json({
      success: true,
      data: {
        dry_run: true,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      },
    });
  }

  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: requestRow, error: insErr } = await supabase
    .from("vendor_reference_requests")
    .insert({
      vendor_id: body.vendor_id,
      request_token_expires_at: expiresAt,
      staff_id: body.staff_id ?? null,
      staff_message: staffMessage,
      status: "sent",
    })
    .select("id, request_token")
    .single();
  if (insErr || !requestRow) {
    return json({ success: false, error: "request_create_failed", detail: insErr?.message }, 500);
  }

  const tpl = buildVendorReferencesRequest({
    vendorFullName: vendor.full_name,
    staffMessage,
    contactsLinkUrl: `${vendorUrl}/vendor-references/${requestRow.request_token}`,
    expiryDays,
  });

  const sendResult = await sendMailgunEmail({
    to: { email: vendor.email, name: vendor.full_name },
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    respectDoNotContactFor: vendor.email,
    tags: ["vendor-references-request", body.vendor_id],
    trackContext: {
      vendorId: body.vendor_id,
      templateTag: "vendor-references-request",
      staffUserId: body.staff_id,
    },
  });

  return json({
    success: true,
    data: {
      request_id: requestRow.id,
      request_token: requestRow.request_token,
      email_sent: sendResult.sent,
      suppressed: sendResult.suppressed,
      mailgun_id: sendResult.mailgunId,
    },
  });
});
