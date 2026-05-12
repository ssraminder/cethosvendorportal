/**
 * vendor-submit-reference-contacts
 *
 * Token-authenticated, public endpoint. The vendor lands on
 * /vendor-references/<token> from the request email, fills in 1-3
 * reference contacts, and submits here. We create one
 * vendor_references row per contact and email each reference with
 * their own feedback link.
 *
 * Body: {
 *   request_token: string,
 *   references: [{ name, email, company?, relationship? }] // 1-3
 *   validate_only?: boolean   // preview the request before submitting
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunEmail } from "../_shared/mailgun.ts";
import { buildVendorReferenceFeedbackRequest } from "../_shared/vendor-reference-emails.ts";

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

interface ContactInput {
  name?: string;
  email?: string;
  company?: string;
  relationship?: string;
}

const FEEDBACK_EXPIRY_DAYS = 21;
const VENDOR_URL_FALLBACK = "https://vendor.cethos.com";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: {
    request_token?: string;
    references?: ContactInput[];
    validate_only?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  if (!body.request_token) return json({ success: false, error: "request_token_required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: requestRow } = await supabase
    .from("vendor_reference_requests")
    .select("id, vendor_id, request_token_expires_at, status")
    .eq("request_token", body.request_token)
    .maybeSingle();
  if (!requestRow) return json({ success: false, error: "invalid_token" }, 404);
  if (new Date(requestRow.request_token_expires_at).getTime() < Date.now()) {
    return json({ success: false, error: "token_expired" }, 410);
  }
  if (requestRow.status === "cancelled") return json({ success: false, error: "request_cancelled" }, 410);

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, full_name, email")
    .eq("id", requestRow.vendor_id)
    .single();
  if (!vendor) return json({ success: false, error: "vendor_not_found" }, 404);

  // ---- Preview / validation path ----
  if (body.validate_only || !body.references) {
    const { data: existing } = await supabase
      .from("vendor_references")
      .select("id, reference_name, reference_email, status")
      .eq("request_id", requestRow.id);
    return json({
      success: true,
      data: {
        vendor_full_name: vendor.full_name,
        already_submitted: requestRow.status === "contacts_received",
        existing_references: existing ?? [],
      },
    });
  }

  // ---- Submit path ----
  if (requestRow.status === "contacts_received") {
    return json({ success: false, error: "contacts_already_submitted" }, 409);
  }

  const cleaned = (body.references ?? [])
    .map((r) => ({
      name: (r.name ?? "").trim(),
      email: (r.email ?? "").trim().toLowerCase(),
      company: (r.company ?? "").trim() || null,
      relationship: (r.relationship ?? "").trim() || null,
    }))
    .filter((r) => r.name.length >= 2 && /\S+@\S+\.\S+/.test(r.email));
  if (cleaned.length < 1 || cleaned.length > 3) {
    return json(
      { success: false, error: "reference_count_invalid", detail: "Submit 1-3 references with name + email." },
      400,
    );
  }

  const feedbackExpiresAt = new Date(Date.now() + FEEDBACK_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const rowsToInsert = cleaned.map((r) => ({
    request_id: requestRow.id,
    vendor_id: requestRow.vendor_id,
    reference_name: r.name,
    reference_email: r.email,
    reference_company: r.company,
    reference_relationship: r.relationship,
    feedback_token_expires_at: feedbackExpiresAt,
    status: "requested",
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("vendor_references")
    .insert(rowsToInsert)
    .select("id, reference_name, reference_email, feedback_token");
  if (insErr || !inserted) {
    return json({ success: false, error: "reference_create_failed", detail: insErr?.message }, 500);
  }

  await supabase
    .from("vendor_reference_requests")
    .update({ status: "contacts_received", contacts_submitted_at: new Date().toISOString() })
    .eq("id", requestRow.id);

  const vendorUrl = Deno.env.get("VENDOR_PORTAL_URL") ?? VENDOR_URL_FALLBACK;
  const sendResults: { reference_email: string; sent: boolean }[] = [];

  for (const r of inserted) {
    const tpl = buildVendorReferenceFeedbackRequest({
      referenceName: r.reference_name,
      vendorFullName: vendor.full_name,
      feedbackLinkUrl: `${vendorUrl}/vendor-reference-feedback/${r.feedback_token}`,
      expiryDays: FEEDBACK_EXPIRY_DAYS,
    });
    const result = await sendMailgunEmail({
      to: { email: r.reference_email, name: r.reference_name },
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: ["vendor-reference-feedback-request", String(requestRow.vendor_id)],
      trackContext: {
        vendorId: String(requestRow.vendor_id),
        templateTag: "vendor-reference-feedback-request",
      },
    });
    sendResults.push({ reference_email: r.reference_email, sent: result.sent });
  }

  return json({
    success: true,
    data: { references_created: inserted.length, send_results: sendResults },
  });
});
