/**
 * cvp-prescreen-application — v2 (CV-aware)
 *
 * Reads the applicant's CV from cvp-applicant-cvs storage bucket, sends it to
 * Claude as a PDF document block alongside the form data, and uses both signals
 * to score the application. Falls back to form-only scoring on any CV read
 * failure (path missing, file missing, >32MB, non-PDF, download error).
 *
 * Prompt version: v2-cv-aware
 * Model: claude-sonnet-4-5 (vision-capable; required for PDF document input)
 *
 * Trigger: synchronous fire-and-forget from cvp-submit-application after insert.
 * Also re-invokable via cvp-reprocess-prescreens for back-fills.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunEmail } from "../_shared/mailgun.ts";
import {
  buildV2PrescreenPassed,
  buildV8UnderManualReview,
} from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-sonnet-4-5";
const PROMPT_VERSION = "v2-cv-aware";
const MAX_PDF_BYTES = 32 * 1024 * 1024; // Anthropic document input limit

interface PrescreenResult {
  overall_score: number;
  recommendation: "proceed" | "staff_review" | "reject";
  demand_match: "high" | "medium" | "low";
  certification_quality: "high" | "medium" | "low" | "none";
  experience_consistency: "high" | "medium" | "low";
  sample_quality: "high" | "medium" | "low" | "not_provided";
  rate_expectation_assessment: "within_band" | "above_band" | "below_band" | "not_provided";
  red_flags: string[];
  notes: string;
  suggested_test_difficulty: "beginner" | "intermediate" | "advanced";
  suggested_test_types: string[];
  suggested_tier: "standard" | "senior" | "expert";
  cv_quality?: "high" | "medium" | "low" | "not_readable";
  cv_corroborates_form?: "fully" | "partially" | "contradicts" | "not_readable";
  cv_unique_signals?: string[];
}

interface CogPrescreenResult {
  overall_score: number;
  recommendation: "staff_review";
  coa_instrument_experience: "strong" | "partial" | "weak";
  guideline_familiarity: "strong" | "partial" | "weak";
  interviewing_skills: "strong" | "partial" | "weak";
  language_fluency: "strong" | "partial" | "weak";
  report_writing_experience: "strong" | "partial" | "weak";
  red_flags: string[];
  notes: string;
  cv_quality?: "high" | "medium" | "low" | "not_readable";
  cv_corroborates_form?: "fully" | "partially" | "contradicts" | "not_readable";
  cv_unique_signals?: string[];
}

interface ApplicationRow {
  id: string;
  role_type: "translator" | "cognitive_debriefing";
  full_name: string;
  email: string;
  country: string;
  years_experience: number | null;
  education_level: string | null;
  certifications: { name: string; customName?: string; expiryDate?: string }[];
  cat_tools: string[];
  services_offered: string[];
  rate_expectation: number | null;
  notes: string | null;
  cog_years_experience: number | null;
  cog_degree_field: string | null;
  cog_credentials: string | null;
  cog_instrument_types: string[];
  cog_therapy_areas: string[];
  cog_pharma_clients: string | null;
  cog_ispor_familiarity: string | null;
  cog_fda_familiarity: string | null;
  cog_prior_debrief_reports: boolean;
  cv_storage_path: string | null;
}

interface TestCombination {
  id: string;
  source_language: { name: string };
  target_language: { name: string };
  domain: string;
  service_type: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- Prompt: Translator ----------

const TRANSLATOR_SYSTEM_PROMPT = `You are an expert recruitment screener for CETHOS, a Canadian certified translation company.

You evaluate freelance translator applications. Return ONLY valid JSON matching the schema below — no preamble, no markdown, no commentary outside the JSON object.

INPUTS YOU MAY RECEIVE
1. A structured form-data text block with the applicant's self-reported claims (always present).
2. A PDF attachment of the applicant's CV/resume (often present, sometimes absent).

WHEN A CV IS ATTACHED, IT IS A PRIMARY SIGNAL — NOT AN OPTIONAL EXTRA.
Read it carefully and weigh it heavily. Specifically:
- Cross-check claimed years of experience against employment dates in the CV. A claim of "10 years" backed by a CV showing 3 years of jobs is a strong negative signal.
- Cross-check claimed certifications. If the CV lists ATA / CTTIC / ISO 17100 / CIOL etc, that corroborates. If the form claims certs the CV doesn't mention, flag it.
- Look for past employers (translation agencies, enterprises, government, hospitals) that validate domain claims (legal, medical, technical etc).
- Look for past projects, clients, or publications that confirm specific language pairs.
- Note Canadian-market signals: Canadian clients, CTTIC/ATIO membership, Canadian residency history.
- Note CV-internal red flags: gaps in employment, typos, generic/template-filled content, mismatched language quality (a translator whose own CV English is poor is a red flag).
- Note CV unique signals — facts visible in the CV that the form does NOT capture (notable past employers, publications, niche specialisms, non-listed certifications).

SCORING GUIDELINES (0–100)
- Weight CV evidence HEAVILY when it corroborates strong form claims (boost the score).
- PENALIZE HEAVILY when the CV contradicts the form (e.g. claims of seniority not borne out by the CV).
- 70+ = strong candidate, proceed to testing
- 50–69 = uncertain, flag for staff review
- <50 = weak candidate, recommend rejection

CONSIDER
- Language-pair demand for the Canadian certified-translation market
- Certification quality (ATA/CTTIC/CIOL = high, ISO 17100 = high, none = low)
- Years of experience vs claimed domains — consistency check
- CAT tools proficiency (more tools = more flexible)
- Rate expectation vs market norms (CAD $12–20/page standard for certified translation)

OUTPUT JSON SCHEMA (return EXACTLY these keys; no extras)
{
  "overall_score": number (0–100),
  "recommendation": "proceed" | "staff_review" | "reject",
  "demand_match": "high" | "medium" | "low",
  "certification_quality": "high" | "medium" | "low" | "none",
  "experience_consistency": "high" | "medium" | "low",
  "sample_quality": "high" | "medium" | "low" | "not_provided",
  "rate_expectation_assessment": "within_band" | "above_band" | "below_band" | "not_provided",
  "red_flags": string[],
  "notes": string,
  "suggested_test_difficulty": "beginner" | "intermediate" | "advanced",
  "suggested_test_types": string[],
  "suggested_tier": "standard" | "senior" | "expert",
  "cv_quality": "high" | "medium" | "low" | "not_readable",
  "cv_corroborates_form": "fully" | "partially" | "contradicts" | "not_readable",
  "cv_unique_signals": string[]
}

NOTES ON FIELDS
- "sample_quality" now reflects whether the CV itself demonstrates sample-like quality (formatting, language, clarity). It is no longer about a separate work-sample upload. If no CV was attached, use "not_provided".
- "cv_quality": overall professionalism of the CV document.
- "cv_corroborates_form": "fully" if CV dates/certs/employers back the form claims; "partially" if some support but gaps; "contradicts" if material claims fail to be supported; "not_readable" if no CV was attached or it could not be parsed.
- "cv_unique_signals": short, factual bullet items visible only in the CV — past employers, projects, languages, niche specialties, clients, publications, memberships.

TIER ASSIGNMENT RULES
- standard: <3 years experience, basic or no certs
- senior: 3–7 years, ATA/CTTIC or equivalent
- expert: 7+ years, multiple recognised certs, specialist domains`;

// ---------- Prompt: Cognitive Debriefing ----------

const COG_DEBRIEF_SYSTEM_PROMPT = `You are an expert recruitment screener for CETHOS, evaluating cognitive debriefing consultant applications.

Cognitive debriefing consultants conduct qualitative interviews with patients/participants to assess whether translated clinical outcome assessments (COAs/PROs) are understood as intended.

Return ONLY valid JSON — no preamble, no markdown.

INPUTS
1. A structured form-data text block (always present).
2. A PDF attachment of the applicant's CV (often present).

When the CV is attached, weigh it heavily:
- Cross-check claimed years of debriefing/qualitative-research experience against the CV.
- Look for past work on COA/PRO instruments, ePRO platforms, or patient interview studies.
- Note ISPOR, FDA COA, EMA guideline familiarity if visible.
- Look for sponsor/CRO clients (validate the form's "pharma clients" claim).
- Note language fluency signals (degrees taken in target language, multi-lingual employment history).
- Flag CV-internal red flags: gaps, generic templates, language quality issues.

EVALUATE BASED ON THESE WEIGHTED CRITERIA
- COA/PRO instrument experience (30%)
- ISPOR/FDA COA guideline familiarity (20%)
- Interviewing/qualitative research skills (20%)
- Native/near-native target language fluency (20%)
- Prior debrief report writing experience (10%)

OUTPUT JSON SCHEMA
{
  "overall_score": number (0–100),
  "recommendation": "staff_review",
  "coa_instrument_experience": "strong" | "partial" | "weak",
  "guideline_familiarity": "strong" | "partial" | "weak",
  "interviewing_skills": "strong" | "partial" | "weak",
  "language_fluency": "strong" | "partial" | "weak",
  "report_writing_experience": "strong" | "partial" | "weak",
  "red_flags": string[],
  "notes": string,
  "cv_quality": "high" | "medium" | "low" | "not_readable",
  "cv_corroborates_form": "fully" | "partially" | "contradicts" | "not_readable",
  "cv_unique_signals": string[]
}

IMPORTANT: recommendation MUST always be "staff_review" for cognitive debriefing — AI is advisory only, staff always makes the final decision.`;

// ---------- CV download ----------

interface CvFetchResult {
  base64: string | null;
  mediaType: string;
  read: boolean;
  error: string | null;
}

async function fetchCv(
  supabase: SupabaseClient,
  cvPath: string | null,
): Promise<CvFetchResult> {
  if (!cvPath) {
    return { base64: null, mediaType: "", read: false, error: "no_cv_path" };
  }
  if (!cvPath.toLowerCase().endsWith(".pdf")) {
    return {
      base64: null,
      mediaType: "",
      read: false,
      error: `non_pdf_format (${cvPath.split(".").pop() ?? "unknown"})`,
    };
  }
  try {
    const { data, error } = await supabase.storage
      .from("cvp-applicant-cvs")
      .download(cvPath);
    if (error || !data) {
      return {
        base64: null,
        mediaType: "",
        read: false,
        error: `download_failed: ${error?.message ?? "unknown"}`,
      };
    }
    const buf = await data.arrayBuffer();
    if (buf.byteLength > MAX_PDF_BYTES) {
      return {
        base64: null,
        mediaType: "",
        read: false,
        error: `cv_too_large (${buf.byteLength} bytes, max ${MAX_PDF_BYTES})`,
      };
    }
    // Base64 in chunks to avoid stack overflow on large arrays
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + CHUNK)),
      );
    }
    return {
      base64: btoa(binary),
      mediaType: "application/pdf",
      read: true,
      error: null,
    };
  } catch (err) {
    return {
      base64: null,
      mediaType: "",
      read: false,
      error: `exception: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------- Claude call ----------

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  cv: CvFetchResult,
  maxTokens: number,
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const content: unknown[] = [];
  if (cv.read && cv.base64) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: cv.mediaType,
        data: cv.base64,
      },
    });
  }
  content.push({ type: "text", text: userMessage });

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const result = await response.json() as {
    content: { type: string; text?: string }[];
    usage?: Record<string, unknown>;
  };
  const textBlock = result.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("No text block in Claude response");
  return textBlock.text;
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  // Strip markdown code fences if present + extract first balanced JSON
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  // If preamble present, find first { and matching final }
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) throw new Error("No JSON object in response");
  const lastBrace = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

// Retry-once helper
async function callClaudeWithRetry(
  systemPrompt: string,
  userMessage: string,
  cv: CvFetchResult,
  maxTokens: number,
): Promise<Record<string, unknown>> {
  try {
    const raw = await callClaude(systemPrompt, userMessage, cv, maxTokens);
    return parseJsonResponse(raw);
  } catch (firstErr) {
    console.error("First Claude call failed, retrying once:", firstErr);
    await new Promise((r) => setTimeout(r, 1500));
    const raw = await callClaude(systemPrompt, userMessage, cv, maxTokens);
    return parseJsonResponse(raw);
  }
}

// ---------- Main handler ----------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { applicationId } = await req.json();
    if (!applicationId) {
      return jsonResponse({ success: false, error: "applicationId is required" }, 400);
    }

    await supabase
      .from("cvp_applications")
      .update({ status: "prescreening", updated_at: new Date().toISOString() })
      .eq("id", applicationId);

    const { data: application, error: fetchError } = await supabase
      .from("cvp_applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (fetchError || !application) {
      console.error("Error fetching application:", fetchError);
      return jsonResponse({ success: false, error: "Application not found" }, 404);
    }

    const app = application as unknown as ApplicationRow;

    // ---- Download CV (best-effort) ----
    const cv = await fetchCv(supabase, app.cv_storage_path);
    if (!cv.read) {
      console.warn(
        `CV not read for application ${applicationId}: ${cv.error}`,
      );
    }

    let aiResult: Record<string, unknown>;
    let aiScore: number;
    let newStatus: string;
    let assignedTier: string | null = null;

    try {
      if (app.role_type === "translator") {
        const { data: combinations } = await supabase
          .from("cvp_test_combinations")
          .select(
            "id, domain, service_type, source_language:source_language_id(name), target_language:target_language_id(name)",
          )
          .eq("application_id", applicationId);

        const pairsDescription =
          (combinations as unknown as TestCombination[] | null)
            ?.map(
              (c) =>
                `${c.source_language.name} → ${c.target_language.name} (${c.domain}, ${c.service_type})`,
            )
            .join("; ") ?? "No combinations";

        const cvNote = cv.read
          ? "CV is attached above. Read it carefully and cross-check the form claims below against the CV."
          : `No CV could be read (reason: ${cv.error}). Score on form data alone and set cv_quality / cv_corroborates_form to "not_readable".`;

        const userMessage = `${cvNote}

Form data:
Name: ${app.full_name}
Country: ${app.country}
Years of experience: ${app.years_experience ?? "Not specified"}
Education: ${app.education_level ?? "Not specified"}
Certifications: ${JSON.stringify(app.certifications ?? [])}
CAT tools: ${(app.cat_tools ?? []).join(", ") || "None"}
Services offered: ${(app.services_offered ?? []).join(", ")}
Language pairs and domains: ${pairsDescription}
Rate expectation (CAD/page): ${app.rate_expectation ?? "Not specified"}
Additional notes: ${app.notes ?? "None"}`;

        aiResult = await callClaudeWithRetry(
          TRANSLATOR_SYSTEM_PROMPT,
          userMessage,
          cv,
          4000,
        );

        const result = aiResult as unknown as PrescreenResult;
        aiScore = result.overall_score;
        assignedTier = result.suggested_tier ?? null;

        // Routing policy (per April 2026 decision):
        //   AI never auto-rejects. AI is recommendation-only for low scores —
        //   staff must explicitly approve a rejection from the admin UI before
        //   the V12 email is queued. AI's recommendation is preserved in
        //   ai_prescreening_result.recommendation for the admin to act on.
        //   Score >= 70 still auto-advances to "prescreened" so test invitations
        //   can be triggered by staff via the existing "Send Tests" button.
        if (aiScore >= 70) newStatus = "prescreened";
        else newStatus = "staff_review";
      } else {
        // Cognitive debriefing
        const cvNote = cv.read
          ? "CV is attached above. Read it carefully and cross-check the form claims below against the CV."
          : `No CV could be read (reason: ${cv.error}). Score on form data alone and set cv_quality / cv_corroborates_form to "not_readable".`;

        const userMessage = `${cvNote}

Form data:
Name: ${app.full_name}
Country: ${app.country}
Years of debriefing experience: ${app.cog_years_experience ?? "Not specified"}
Education: ${app.education_level ?? "Not specified"}
Degree field: ${app.cog_degree_field ?? "Not specified"}
Credentials: ${app.cog_credentials ?? "None"}
COA/PRO instrument types: ${(app.cog_instrument_types ?? []).join(", ")}
Therapy areas: ${(app.cog_therapy_areas ?? []).join(", ")}
Pharma/CRO clients: Confidential (provided: ${app.cog_pharma_clients ? "Yes" : "No"})
ISPOR familiarity: ${app.cog_ispor_familiarity ?? "Not specified"}
FDA COA familiarity: ${app.cog_fda_familiarity ?? "Not specified"}
Prior debrief report writing: ${app.cog_prior_debrief_reports ? "Yes" : "No"}`;

        aiResult = await callClaudeWithRetry(
          COG_DEBRIEF_SYSTEM_PROMPT,
          userMessage,
          cv,
          4000,
        );

        const result = aiResult as unknown as CogPrescreenResult;
        aiScore = result.overall_score;
        newStatus = "staff_review"; // always staff review for cog debrief
      }
    } catch (aiError) {
      console.error(
        "AI pre-screening failed, falling back to staff_review:",
        aiError,
      );
      aiResult = {
        error: "ai_fallback",
        reason: aiError instanceof Error ? aiError.message : "Unknown AI error",
      };
      aiScore = 0;
      newStatus = "staff_review";
      assignedTier = null;
    }

    // ---- Stamp observability fields onto every result ----
    aiResult.cv_read = cv.read;
    aiResult.cv_read_error = cv.error;
    aiResult.model_used = MODEL;
    aiResult.prompt_version = PROMPT_VERSION;

    const updateData: Record<string, unknown> = {
      status: newStatus,
      ai_prescreening_score: aiScore,
      ai_prescreening_result: aiResult,
      ai_prescreening_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (assignedTier) updateData.assigned_tier = assignedTier;

    // Belt-and-suspenders: if a previous prescreen run auto-queued a rejection
    // (legacy behaviour), clear it on every re-run so AI can never email the
    // applicant a rejection without admin sign-off.
    if (newStatus !== "rejected") {
      updateData.rejection_email_status = null;
      updateData.rejection_email_queued_at = null;
      updateData.rejection_reason = null;
      updateData.can_reapply_after = null;
    }

    const { error: updateError } = await supabase
      .from("cvp_applications")
      .update(updateData)
      .eq("id", applicationId);

    if (updateError) {
      console.error(
        "Error updating application with prescreen results:",
        updateError,
      );
    }

    // Send appropriate email based on routing (skip on AI fallback to avoid spam during outages)
    try {
      const aiFailed = aiResult.error === "ai_fallback";
      if (newStatus !== "rejected" && !aiFailed) {
        const appNumber = (application as Record<string, unknown>)
          .application_number as string;
        const roleTypeLabel =
          app.role_type === "translator"
            ? "Translator / Reviewer"
            : "Cognitive Debriefing Consultant";
        const tpl =
          newStatus === "prescreened"
            ? buildV2PrescreenPassed({
                fullName: app.full_name,
                applicationNumber: appNumber,
                roleType: roleTypeLabel,
              })
            : buildV8UnderManualReview({
                fullName: app.full_name,
                applicationNumber: appNumber,
                roleType: roleTypeLabel,
              });
        await sendMailgunEmail({
          to: { email: app.email, name: app.full_name },
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          respectDoNotContactFor: app.email,
          tags: [
            newStatus === "prescreened"
              ? "v2-prescreen-passed"
              : "v8-manual-review",
            applicationId,
          ],
        });
      }
    } catch (emailError) {
      console.error("Error sending prescreen result email:", emailError);
    }

    return jsonResponse({
      success: true,
      data: {
        applicationId,
        score: aiScore,
        status: newStatus,
        tier: assignedTier,
        cv_read: cv.read,
        cv_read_error: cv.error,
        prompt_version: PROMPT_VERSION,
        model_used: MODEL,
      },
    });
  } catch (err) {
    console.error("Unhandled error in cvp-prescreen-application:", err);
    return jsonResponse(
      { success: false, error: "An unexpected error occurred." },
      500,
    );
  }
});
