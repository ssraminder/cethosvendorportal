// ============================================================================
// vendor-iso-quiz-submit
//
// Vendor submits answers to an ISO competence MCQ quiz. Auto-graded
// against iso_competence_quizzes.correct_option. Persists a submission
// row regardless of pass/fail (audit trail), then — if passed — marks
// the matching requested_items[] entry's completed_at. Auto-reassess
// fires when the last request item resolves.
//
// POST /functions/v1/vendor-iso-quiz-submit
// Body: { token: string, slug: string, answers: { [question_id]: 'a' | 'b' | ... } }
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

const THRESHOLD_PCT = 80;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: { token?: string; slug?: string; answers?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  const token = (body.token ?? "").trim();
  const slug = (body.slug ?? "").trim();
  const answers = body.answers ?? {};
  if (!token || !slug) return json({ success: false, error: "token_and_slug_required" }, 400);
  if (!answers || typeof answers !== "object") return json({ success: false, error: "answers_required" }, 400);
  const questionIds = Object.keys(answers);
  if (questionIds.length === 0) return json({ success: false, error: "no_answers" }, 400);

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
  if (item.completed_at) return json({ success: false, error: "slug_already_completed" }, 409);

  const competence = String(item.quiz_competence ?? "");
  const domain = item.quiz_domain ? String(item.quiz_domain) : null;

  // Re-fetch the questions server-side; never trust the client to send
  // the correct answers along with their submission.
  const { data: questions, error: qErr } = await supabase
    .from("iso_competence_quizzes")
    .select("id, competence_slug, domain, correct_option")
    .in("id", questionIds);
  if (qErr) return json({ success: false, error: "question_lookup_failed", detail: qErr.message }, 500);
  if (!questions || questions.length === 0) return json({ success: false, error: "no_questions_found" }, 404);

  // Sanity: every question the vendor answered must belong to the
  // claimed competence + domain. Defends against a client substituting
  // easier questions from another competence.
  for (const q of questions) {
    if (q.competence_slug !== competence) {
      return json({ success: false, error: "question_competence_mismatch", question_id: q.id }, 400);
    }
    if (domain && q.domain !== domain) {
      return json({ success: false, error: "question_domain_mismatch", question_id: q.id }, 400);
    }
  }

  let correctCount = 0;
  for (const q of questions) {
    const chosen = answers[q.id as string];
    if (chosen && chosen === q.correct_option) correctCount++;
  }
  const total = questions.length;
  const scorePct = Math.round((correctCount / total) * 10000) / 100; // 2dp
  const passed = scorePct >= THRESHOLD_PCT;

  // Count prior attempts on this request+slug so the audit log shows attempt order.
  const { count: priorAttempts } = await supabase
    .from("iso_competence_quiz_submissions")
    .select("id", { count: "exact", head: true })
    .eq("request_id", request.id)
    .eq("request_slug", slug);

  const { error: subErr } = await supabase
    .from("iso_competence_quiz_submissions")
    .insert({
      vendor_id: request.vendor_id,
      request_id: request.id,
      request_slug: slug,
      competence_slug: competence,
      domain,
      questions_asked: questionIds,
      answers,
      correct_count: correctCount,
      total_count: total,
      score_pct: scorePct,
      threshold_pct: THRESHOLD_PCT,
      passed,
      attempt_number: (priorAttempts ?? 0) + 1,
    });
  if (subErr) return json({ success: false, error: "submission_insert_failed", detail: subErr.message }, 500);

  let allDone = false;
  let nextStatus: string = request.status;

  if (passed) {
    // Mark the request item complete with the score recorded inline.
    const nowIso = new Date().toISOString();
    const updatedItems = items.map((it) =>
      it.slug === slug && !it.completed_at
        ? { ...it, completed_at: nowIso, quiz_score_pct: scorePct, quiz_passed: true }
        : it,
    );
    const resolvedCount = updatedItems.filter(
      (it) => !!it.completed_at || !!it.declined_at,
    ).length;
    allDone = resolvedCount === updatedItems.length;
    nextStatus = allDone ? "completed" : "partial";
    await supabase
      .from("vendor_document_requests")
      .update({
        requested_items: updatedItems,
        status: nextStatus,
        completed_at: allDone ? nowIso : null,
      })
      .eq("id", request.id);

    // Fire-and-forget assessment re-run on full completion (Phase 3 pattern).
    if (allDone) {
      try {
        const url = Deno.env.get("SUPABASE_URL");
        const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (url && sr) {
          fetch(`${url}/functions/v1/vendor-iso17100-assess`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sr}`,
              apikey: sr,
            },
            body: JSON.stringify({ vendor_id: request.vendor_id }),
          }).catch((e) => console.error("auto-reassess fetch failed:", e));
        }
      } catch (e) {
        console.error("auto-reassess setup failed:", e);
      }
    }
  }

  return json({
    success: true,
    data: {
      score_pct: scorePct,
      correct_count: correctCount,
      total_count: total,
      threshold_pct: THRESHOLD_PCT,
      passed,
      attempt_number: (priorAttempts ?? 0) + 1,
      all_done: allDone,
      status: nextStatus,
    },
  });
});
