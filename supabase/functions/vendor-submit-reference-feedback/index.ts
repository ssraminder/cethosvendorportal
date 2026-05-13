/**
 * vendor-submit-reference-feedback
 *
 * Token-authenticated, public endpoint. A reference lands on
 * /vendor-reference-feedback/<token> from their request email and
 * either submits feedback or declines.
 *
 * Body: {
 *   feedback_token: string,
 *   validate_only?: boolean      // GET-like preview
 *   feedback_text?: string,      // 50+ chars on submit
 *   feedback_rating?: 1..5,      // on submit
 *   decline?: boolean,
 *   decline_reason?: string
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: {
    feedback_token?: string;
    validate_only?: boolean;
    feedback_text?: string | null;
    feedback_rating?: number;
    decline?: boolean;
    decline_reason?: string;
    competence_responses?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  if (!body.feedback_token) return json({ success: false, error: "feedback_token_required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: refRow } = await supabase
    .from("vendor_references")
    .select(
      "id, vendor_id, reference_name, reference_email, feedback_token_expires_at, status, feedback_received_at, declined_at",
    )
    .eq("feedback_token", body.feedback_token)
    .maybeSingle();
  if (!refRow) return json({ success: false, error: "invalid_token" }, 404);
  if (new Date(refRow.feedback_token_expires_at).getTime() < Date.now()) {
    return json({ success: false, error: "token_expired" }, 410);
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, full_name")
    .eq("id", refRow.vendor_id)
    .single();
  if (!vendor) return json({ success: false, error: "vendor_not_found" }, 404);

  if (body.validate_only) {
    return json({
      success: true,
      data: {
        reference_name: refRow.reference_name,
        vendor_full_name: vendor.full_name,
        already_responded: refRow.status !== "requested",
        status: refRow.status,
      },
    });
  }

  if (refRow.status !== "requested") {
    return json({ success: false, error: "already_responded" }, 409);
  }

  const nowIso = new Date().toISOString();

  // Decline path
  if (body.decline) {
    const reason = (body.decline_reason ?? "").trim().slice(0, 500) || null;
    const { error } = await supabase
      .from("vendor_references")
      .update({
        status: "declined",
        declined_at: nowIso,
        decline_reason: reason,
      })
      .eq("id", refRow.id);
    if (error) return json({ success: false, error: "decline_failed", detail: error.message }, 500);
    return json({ success: true, data: { declined: true } });
  }

  // Submit path
  const text = (body.feedback_text ?? "").trim();
  const rating = Number(body.feedback_rating);
  if (!(rating >= 1 && rating <= 5)) {
    return json({ success: false, error: "rating_invalid", detail: "Rating must be 1-5." }, 400);
  }

  // Phase 5a — competence_responses is the primary signal now. Free
  // text is optional. Validate MCQ payload shape.
  const competence = validateCompetenceResponses(body.competence_responses);
  if (!competence.ok) {
    return json({ success: false, error: "competence_invalid", detail: competence.error }, 400);
  }

  const { error: updErr } = await supabase
    .from("vendor_references")
    .update({
      status: "received",
      feedback_text: text || null,
      feedback_rating: rating,
      competence_responses: competence.data,
      feedback_received_at: nowIso,
    })
    .eq("id", refRow.id);
  if (updErr) return json({ success: false, error: "submit_failed", detail: updErr.message }, 500);

  return json({ success: true, data: { received: true } });
});

// Inline MCQ validator — mirrors apps/vendor/src/data/referenceMcqs.ts.
const REQUIRED_SLUGS = [
  "translation_competence",
  "linguistic_textual_competence",
  "research_competence",
  "cultural_competence",
  "technical_competence",
  "domain_competence",
];

function validateCompetenceResponses(input: unknown):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "missing" };
  const obj = input as Record<string, unknown>;
  for (const slug of REQUIRED_SLUGS) {
    if (!["a", "b", "c", "d", "e"].includes(obj[slug] as string)) {
      return { ok: false, error: `missing or invalid: ${slug}` };
    }
  }
  if (!["yes", "probably", "probably_not", "no"].includes(obj.would_work_again as string)) {
    return { ok: false, error: "missing or invalid: would_work_again" };
  }
  if (obj.domain_specialty != null && typeof obj.domain_specialty !== "string") {
    return { ok: false, error: "domain_specialty must be string or null" };
  }
  const data: Record<string, unknown> = { would_work_again: obj.would_work_again, domain_specialty: obj.domain_specialty ? String(obj.domain_specialty).slice(0, 200) : null };
  for (const slug of REQUIRED_SLUGS) data[slug] = obj[slug];
  return { ok: true, data };
}
