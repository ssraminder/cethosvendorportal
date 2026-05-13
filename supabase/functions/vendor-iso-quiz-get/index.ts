// ============================================================================
// vendor-iso-quiz-get
//
// Given an iso-evidence request token + slug, returns 8 random active
// questions for the slug's competence. The slug must exist on the
// request's requested_items[] and be of kind='quiz' with a
// quiz_competence field naming a §6.1.2 competence.
//
// POST /functions/v1/vendor-iso-quiz-get
// Body: { token: string, slug: string }
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const QUIZ_LENGTH = 8;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: { token?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  const token = (body.token ?? "").trim();
  const slug = (body.slug ?? "").trim();
  if (!token || !slug) return json({ success: false, error: "token_and_slug_required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: request, error: reqErr } = await supabase
    .from("vendor_document_requests")
    .select("id, vendor_id, requested_items, request_token_expires_at, status")
    .eq("request_token", token)
    .maybeSingle();
  if (reqErr || !request) return json({ success: false, error: "request_not_found" }, 404);
  if (new Date(request.request_token_expires_at).getTime() < Date.now()) {
    return json({ success: false, error: "request_expired" }, 410);
  }
  if (["completed", "expired", "superseded"].includes(request.status)) {
    return json({ success: false, error: "request_closed", status: request.status }, 410);
  }

  const items = Array.isArray(request.requested_items) ? request.requested_items as Array<Record<string, unknown>> : [];
  const item = items.find((it) => it.slug === slug);
  if (!item) return json({ success: false, error: "slug_not_on_request" }, 404);
  if (item.kind !== "quiz") return json({ success: false, error: "slug_not_quiz" }, 400);
  if (item.completed_at || item.declined_at) {
    return json({ success: false, error: "slug_already_resolved" }, 409);
  }

  const competence = String(item.quiz_competence ?? "");
  const domain = item.quiz_domain ? String(item.quiz_domain) : null;
  if (!competence) return json({ success: false, error: "item_missing_quiz_competence" }, 500);

  // Pull active questions for this competence. Per-domain pools filter
  // by domain when provided; otherwise pull from the cross-domain pool.
  let q = supabase
    .from("iso_competence_quizzes")
    .select("id, question, options, difficulty")
    .eq("competence_slug", competence)
    .eq("active", true);
  if (domain) q = q.eq("domain", domain);
  else q = q.is("domain", null);

  const { data: pool, error: poolErr } = await q;
  if (poolErr) return json({ success: false, error: "quiz_lookup_failed", detail: poolErr.message }, 500);
  if (!pool || pool.length === 0) {
    return json({ success: false, error: "no_questions_available", competence, domain }, 404);
  }

  // Shuffle and pick QUIZ_LENGTH (or fewer if the pool is smaller).
  // Server-side shuffle so the client can't bias the selection.
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(QUIZ_LENGTH, pool.length));

  // Don't leak `correct_option` to the client — the submit endpoint
  // re-fetches it server-side at grading time.
  return json({
    success: true,
    data: {
      request_id: request.id,
      slug,
      competence,
      domain,
      threshold_pct: 80,
      total_questions: picked.length,
      questions: picked.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
      })),
    },
  });
});
