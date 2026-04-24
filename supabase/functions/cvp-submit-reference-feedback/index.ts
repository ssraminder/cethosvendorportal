/**
 * cvp-submit-reference-feedback
 *
 * Reference-facing endpoint. Validates a feedback_token, accepts the
 * reference's response (or decline), runs Opus analysis, fires V20
 * thank-you to the reference. V21 to the applicant is suppressed by
 * default per CLAUDE.md ("don't bombard applicants with auto-emails").
 *
 * Body modes:
 *   { feedbackToken, validateOnly: true }
 *     → returns the reference + applicant context for the public page.
 *
 *   { feedbackToken, action: "decline", reason? }
 *     → marks declined, no V20.
 *
 *   { feedbackToken, action: "submit", feedbackText, feedbackRating }
 *     → persists, runs Opus, fires V20.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunEmail } from "../_shared/mailgun.ts";
import { buildV20ReferenceAck } from "../_shared/email-templates.ts";
import { MODEL_QUALITY } from "../_shared/ai-models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ANALYSIS_SYSTEM_PROMPT = `You are analysing a professional reference's response about a translator applying to CETHOS. Output JSON ONLY in the structure below — no preamble, no markdown.

{
  "sentiment": "positive" | "neutral" | "mixed" | "negative",
  "strength_score": <integer 1-5; 5 = ringing endorsement, 1 = clear concerns>,
  "themes": [<short strings; 2-5 themes the reference highlighted, e.g. "domain expertise", "deadline reliability", "communication">],
  "red_flags": [<concrete concerns the reference raised; empty array if none>],
  "summary": <1-2 sentence neutral summary for staff to skim>,
  "verifies_relationship": true | false (does the response sound like someone who actually worked with the applicant in the way claimed)
}

Rules:
- Be calibrated. A reference who says "they were fine" is NOT positive — that's neutral / mildly positive at best.
- If the response is very short (<30 words), strength_score caps at 3 — minimal evidence.
- Red flags include: refusal to recommend, mentions of conflicts / professional issues, vague hedging, contradiction with the applicant's claims.
- Don't infer beyond the text. If the reference doesn't mention something, don't include it as a theme.`;

async function analyseWithOpus(args: {
  applicantName: string;
  referenceName: string;
  referenceCompany: string | null;
  referenceRelationship: string | null;
  feedbackText: string;
  feedbackRating: number | null;
}): Promise<{ ok: boolean; data: Record<string, unknown> | null; error: string | null }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return { ok: false, data: null, error: "ANTHROPIC_API_KEY not configured" };

  const userMessage = `Applicant: ${args.applicantName}
Reference: ${args.referenceName} (${args.referenceCompany ?? "company unspecified"} — ${args.referenceRelationship ?? "relationship unspecified"})
Reference's overall rating: ${args.feedbackRating ?? "not given"} / 5

Reference's free-text response:
---
${args.feedbackText}
---

Output the analysis JSON now.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_QUALITY,
        max_tokens: 800,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, data: null, error: `${resp.status}: ${body.slice(0, 400)}` };
    }
    const data = (await resp.json()) as { content: { type: string; text?: string }[] };
    const raw =
      (data.content ?? []).find((c) => c.type === "text")?.text?.trim() ?? "";
    // Strip optional code fences.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      return { ok: true, data: parsed, error: null };
    } catch {
      return { ok: false, data: null, error: `JSON parse failed: ${cleaned.slice(0, 200)}` };
    }
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: {
    feedbackToken?: string;
    action?: "submit" | "decline";
    validateOnly?: boolean;
    feedbackText?: string;
    feedbackRating?: number;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  if (!body.feedbackToken) {
    return json({ success: false, error: "feedbackToken_required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: refRow } = await supabase
    .from("cvp_application_references")
    .select(
      "id, application_id, reference_name, reference_email, reference_company, reference_relationship, feedback_token_expires_at, status",
    )
    .eq("feedback_token", body.feedbackToken)
    .maybeSingle();
  if (!refRow) return json({ success: false, error: "invalid_token" }, 404);
  if (new Date(refRow.feedback_token_expires_at).getTime() < Date.now()) {
    return json({ success: false, error: "token_expired" }, 410);
  }

  const { data: app } = await supabase
    .from("cvp_applications")
    .select("id, full_name, application_number")
    .eq("id", refRow.application_id)
    .single();
  if (!app) return json({ success: false, error: "application_not_found" }, 404);

  // ---- Validation-only ----
  if (body.validateOnly || !body.action) {
    return json({
      success: true,
      data: {
        referenceName: refRow.reference_name,
        applicantName: app.full_name,
        applicationNumber: app.application_number,
        alreadySubmitted: refRow.status === "received" || refRow.status === "declined",
        previousStatus: refRow.status,
      },
    });
  }

  if (refRow.status === "received" || refRow.status === "declined") {
    return json({ success: false, error: "already_submitted" }, 409);
  }

  // ---- Decline ----
  if (body.action === "decline") {
    await supabase
      .from("cvp_application_references")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
        decline_reason: (body.reason ?? "").trim() || null,
      })
      .eq("id", refRow.id);
    return json({ success: true, data: { declined: true } });
  }

  // ---- Submit ----
  if (body.action !== "submit") {
    return json({ success: false, error: "unknown_action" }, 400);
  }
  const feedbackText = (body.feedbackText ?? "").trim();
  if (feedbackText.length < 30) {
    return json(
      { success: false, error: "feedback_too_short", detail: "Please write at least a few sentences." },
      400,
    );
  }
  const rating =
    typeof body.feedbackRating === "number" &&
    body.feedbackRating >= 1 &&
    body.feedbackRating <= 5
      ? body.feedbackRating
      : null;

  // Persist immediately; AI runs after so a slow / failing AI doesn't
  // make the reference think their submission failed.
  await supabase
    .from("cvp_application_references")
    .update({
      status: "received",
      feedback_text: feedbackText,
      feedback_rating: rating,
      feedback_received_at: new Date().toISOString(),
    })
    .eq("id", refRow.id);

  // V20 ack to the reference.
  const ackTpl = buildV20ReferenceAck({
    referenceName: refRow.reference_name,
    applicantName: app.full_name,
  });
  await sendMailgunEmail({
    to: { email: refRow.reference_email, name: refRow.reference_name },
    subject: ackTpl.subject,
    html: ackTpl.html,
    text: ackTpl.text,
    tags: ["v20-reference-ack", String(refRow.application_id)],
    trackContext: {
      applicationId: String(refRow.application_id),
      templateTag: "v20-reference-ack",
    },
  });

  // Run Opus analysis (best-effort; AI fallback rule applies).
  const analysis = await analyseWithOpus({
    applicantName: app.full_name,
    referenceName: refRow.reference_name,
    referenceCompany: refRow.reference_company,
    referenceRelationship: refRow.reference_relationship,
    feedbackText,
    feedbackRating: rating,
  });
  if (analysis.ok && analysis.data) {
    await supabase
      .from("cvp_application_references")
      .update({
        ai_analysis: analysis.data,
        ai_analysis_at: new Date().toISOString(),
        ai_analysis_error: null,
      })
      .eq("id", refRow.id);
  } else {
    await supabase
      .from("cvp_application_references")
      .update({
        ai_analysis_error: analysis.error,
        ai_analysis_at: new Date().toISOString(),
      })
      .eq("id", refRow.id);
  }

  return json({
    success: true,
    data: { received: true, aiAnalysed: analysis.ok },
  });
});
