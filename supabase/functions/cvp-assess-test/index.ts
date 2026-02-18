import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TestSubmissionRow {
  id: string;
  combination_id: string;
  test_id: string;
  application_id: string;
  submitted_file_path: string | null;
  submitted_notes: string | null;
  draft_content: string | null;
}

interface TestLibraryRow {
  id: string;
  title: string;
  source_language_id: string;
  target_language_id: string;
  domain: string;
  service_type: string;
  difficulty: string;
  source_text: string | null;
  reference_translation: string | null;
  lqa_source_translation: string | null;
  lqa_answer_key: Record<string, unknown>[] | null;
  mqm_dimensions_enabled: string[];
  ai_assessment_rubric: string | null;
}

interface LanguageRow {
  name: string;
}

interface TranslationAssessment {
  test_type: string;
  language_pair: string;
  domain: string;
  overall_score: number;
  pass: boolean;
  dimension_scores: {
    accuracy: number;
    fluency: number;
    terminology: number;
    formatting: number;
    certification_readiness: number;
  };
  errors: {
    category: string;
    severity: string;
    location: string;
    note: string;
  }[];
  strengths: string[];
  feedback_draft: string;
  suggested_tier: string;
  confidence: string;
}

interface LqaAssessment {
  test_type: string;
  language_pair: string;
  domain: string;
  overall_score: number;
  pass: boolean;
  errors_identified_correctly: number;
  errors_missed: number;
  false_positives: number;
  category_accuracy: number;
  severity_accuracy: number;
  comment_quality: number;
  detailed_feedback: string;
  strengths: string[];
  weaknesses: string[];
  confidence: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const textBlock = result.content?.find(
    (block: { type: string }) => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("No text block in Claude response");
  }

  return textBlock.text;
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

const TRANSLATION_SYSTEM_PROMPT = `You are an expert translation quality assessor for CETHOS, a Canadian certified translation company.

You evaluate translation test submissions against a reference translation and the source document. Return ONLY valid JSON — no preamble, no markdown.

Score on a 0-100 scale using MQM Core dimensions with these weights:
- Accuracy (35%): Faithfulness to source, no omissions, no additions, correct meaning transfer
- Fluency (25%): Natural target language, proper grammar, readability
- Terminology (20%): Domain-specific terms used correctly, consistency
- Formatting (10%): Layout, punctuation, number formatting, date formats
- Certification-readiness (10%): Meets Canadian certified translation standards

Output JSON schema:
{
  "test_type": "translation" | "translation_review",
  "language_pair": string (e.g. "ES→EN"),
  "domain": string,
  "overall_score": number (0-100),
  "pass": boolean,
  "dimension_scores": {
    "accuracy": number (0-100),
    "fluency": number (0-100),
    "terminology": number (0-100),
    "formatting": number (0-100),
    "certification_readiness": number (0-100)
  },
  "errors": [
    {
      "category": "accuracy" | "fluency" | "terminology" | "formatting" | "certification_readiness",
      "severity": "minor" | "major" | "critical",
      "location": string,
      "note": string
    }
  ],
  "strengths": string[],
  "feedback_draft": string,
  "suggested_tier": "standard" | "senior" | "expert",
  "confidence": "high" | "medium" | "low"
}

Scoring guidelines:
- >= 80: Pass — strong translation quality
- 65-79: Borderline — send to staff review
- < 65: Fail — below minimum quality

Tier suggestion:
- standard: Acceptable quality with some errors
- senior: Good quality, strong domain knowledge
- expert: Excellent quality, publication-ready`;

const LQA_SYSTEM_PROMPT = `You are an expert LQA (Linguistic Quality Assurance) assessor for CETHOS, a Canadian certified translation company.

You evaluate LQA review test submissions. The applicant was given a flawed translation and asked to identify errors using MQM Core categories. You compare their findings against the answer key.

Return ONLY valid JSON — no preamble, no markdown.

MQM Core categories: Accuracy, Fluency, Terminology, Style, Locale Conventions, Design, Non-translation.
Severity levels: Minor, Major, Critical.

Evaluate:
- Whether errors were correctly identified (vs answer key)
- Whether the MQM category assignment is accurate
- Whether severity ratings (Minor/Major/Critical) are correctly applied
- Comment quality: actionable, professional, specific
- Whether the reviewer missed critical errors (heavy penalty)
- False positives (identified non-existent errors — moderate penalty)

Output JSON schema:
{
  "test_type": "lqa_review",
  "language_pair": string,
  "domain": string,
  "overall_score": number (0-100),
  "pass": boolean,
  "errors_identified_correctly": number,
  "errors_missed": number,
  "false_positives": number,
  "category_accuracy": number (0-100),
  "severity_accuracy": number (0-100),
  "comment_quality": number (0-100),
  "detailed_feedback": string,
  "strengths": string[],
  "weaknesses": string[],
  "confidence": "high" | "medium" | "low"
}

Scoring guidelines:
- >= 80: Pass — competent reviewer
- 65-79: Borderline — staff review needed
- < 65: Fail — insufficient review skills`;

/**
 * cvp-assess-test
 *
 * AI-powered test assessment using Claude. Evaluates translation or LQA review submissions
 * against reference translations / answer keys using MQM Core dimensions.
 *
 * Triggered: automatically after test submission (fire-and-forget from cvp-submit-test).
 *
 * Payload: { submissionId: string, combinationId: string }
 */
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { submissionId, combinationId } = await req.json();
    if (!submissionId || !combinationId) {
      return jsonResponse(
        { success: false, error: "submissionId and combinationId are required" },
        400
      );
    }

    // Fetch submission
    const { data: submission, error: subError } = await supabase
      .from("cvp_test_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      console.error("Error fetching submission:", subError);
      return jsonResponse(
        { success: false, error: "Submission not found" },
        404
      );
    }

    const sub = submission as unknown as TestSubmissionRow;

    // Fetch test from library (includes reference translation / answer key)
    const { data: test, error: testError } = await supabase
      .from("cvp_test_library")
      .select("*")
      .eq("id", sub.test_id)
      .single();

    if (testError || !test) {
      console.error("Error fetching test:", testError);
      return jsonResponse(
        { success: false, error: "Test not found" },
        404
      );
    }

    const testData = test as unknown as TestLibraryRow;

    // Fetch language names
    const { data: srcLang } = await supabase
      .from("languages")
      .select("name")
      .eq("id", testData.source_language_id)
      .single();
    const { data: tgtLang } = await supabase
      .from("languages")
      .select("name")
      .eq("id", testData.target_language_id)
      .single();

    const sourceLangName = (srcLang as unknown as LanguageRow | null)?.name ?? "Unknown";
    const targetLangName = (tgtLang as unknown as LanguageRow | null)?.name ?? "Unknown";
    const langPair = `${sourceLangName}→${targetLangName}`;

    // Get the applicant's submitted text
    const submittedText = sub.draft_content ?? "";

    let aiResult: Record<string, unknown>;
    let aiScore: number;

    try {
      if (testData.service_type === "lqa_review") {
        // LQA Review assessment
        const userMessage = `Assess this LQA review test submission.

Language pair: ${langPair}
Domain: ${testData.domain}

=== SOURCE TEXT ===
${testData.source_text ?? "Not provided"}

=== FLAWED TRANSLATION (given to applicant to review) ===
${testData.lqa_source_translation ?? "Not provided"}

=== ANSWER KEY (expected errors) ===
${JSON.stringify(testData.lqa_answer_key ?? [], null, 2)}

=== MQM DIMENSIONS ENABLED ===
${(testData.mqm_dimensions_enabled ?? []).join(", ")}

=== APPLICANT'S REVIEW SUBMISSION ===
${submittedText}

${testData.ai_assessment_rubric ? `=== ADDITIONAL RUBRIC ===\n${testData.ai_assessment_rubric}` : ""}

Evaluate the applicant's error identification, categorisation, severity ratings, and comment quality against the answer key.`;

        let rawResponse: string;
        try {
          rawResponse = await callClaude(LQA_SYSTEM_PROMPT, userMessage, 2048);
          aiResult = parseJsonResponse(rawResponse);
        } catch (firstErr) {
          console.error("First Claude call failed, retrying:", firstErr);
          try {
            rawResponse = await callClaude(LQA_SYSTEM_PROMPT, userMessage, 2048);
            aiResult = parseJsonResponse(rawResponse);
          } catch (retryErr) {
            console.error("Retry also failed:", retryErr);
            throw retryErr;
          }
        }

        const result = aiResult as unknown as LqaAssessment;
        aiScore = result.overall_score;
      } else {
        // Translation or Translation+Review assessment
        const userMessage = `Assess this translation test submission.

Language pair: ${langPair}
Domain: ${testData.domain}
Test type: ${testData.service_type}
Difficulty: ${testData.difficulty}

=== SOURCE TEXT ===
${testData.source_text ?? "Not provided"}

=== REFERENCE TRANSLATION ===
${testData.reference_translation ?? "Not provided"}

=== APPLICANT'S TRANSLATION ===
${submittedText}

${testData.ai_assessment_rubric ? `=== ADDITIONAL RUBRIC ===\n${testData.ai_assessment_rubric}` : ""}

${sub.submitted_notes ? `=== APPLICANT'S NOTES ===\n${sub.submitted_notes}` : ""}

Evaluate the applicant's translation against the source text and reference translation. Score each MQM dimension and provide specific error annotations.`;

        let rawResponse: string;
        try {
          rawResponse = await callClaude(TRANSLATION_SYSTEM_PROMPT, userMessage, 2048);
          aiResult = parseJsonResponse(rawResponse);
        } catch (firstErr) {
          console.error("First Claude call failed, retrying:", firstErr);
          try {
            rawResponse = await callClaude(TRANSLATION_SYSTEM_PROMPT, userMessage, 2048);
            aiResult = parseJsonResponse(rawResponse);
          } catch (retryErr) {
            console.error("Retry also failed:", retryErr);
            throw retryErr;
          }
        }

        const result = aiResult as unknown as TranslationAssessment;
        aiScore = result.overall_score;
      }
    } catch (aiError) {
      // AI fallback — never block the pipeline
      console.error("AI test assessment failed, falling back to staff_review:", aiError);
      aiResult = {
        error: "ai_fallback",
        reason: aiError instanceof Error ? aiError.message : "Unknown AI error",
      };
      aiScore = 0;

      // Set status to staff review on the combination
      await supabase
        .from("cvp_test_combinations")
        .update({
          status: "assessed",
          ai_score: null,
          ai_assessment_result: aiResult,
          updated_at: new Date().toISOString(),
        })
        .eq("id", combinationId);

      // Update submission
      await supabase
        .from("cvp_test_submissions")
        .update({
          status: "assessed",
          ai_assessment_score: null,
          ai_assessment_result: aiResult,
          ai_assessed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      // Set application to staff review
      await supabase
        .from("cvp_applications")
        .update({
          status: "staff_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.application_id);

      return jsonResponse({
        success: true,
        data: {
          submissionId,
          combinationId,
          status: "staff_review",
          aiError: true,
        },
      });
    }

    // Determine routing based on score
    let combinationStatus: string;
    if (aiScore >= 80) {
      combinationStatus = "approved";
    } else if (aiScore >= 65) {
      combinationStatus = "assessed"; // Staff review needed
    } else {
      combinationStatus = "rejected";
    }

    const now = new Date().toISOString();

    // Update submission with AI results
    await supabase
      .from("cvp_test_submissions")
      .update({
        status: "assessed",
        ai_assessment_score: aiScore,
        ai_assessment_result: aiResult,
        ai_assessed_at: now,
        updated_at: now,
      })
      .eq("id", submissionId);

    // Update combination with score and status
    const comboUpdate: Record<string, unknown> = {
      status: combinationStatus,
      ai_score: aiScore,
      ai_assessment_result: aiResult,
      updated_at: now,
    };
    if (combinationStatus === "approved") {
      comboUpdate.approved_at = now;
      // approved_by is null for auto-approval
    }
    await supabase
      .from("cvp_test_combinations")
      .update(comboUpdate)
      .eq("id", combinationId);

    // Update test library pass/fail stats
    if (aiScore >= 80) {
      const { data: testRow } = await supabase
        .from("cvp_test_library")
        .select("total_pass_count")
        .eq("id", sub.test_id)
        .single();
      await supabase
        .from("cvp_test_library")
        .update({
          total_pass_count: ((testRow as Record<string, unknown> | null)?.total_pass_count as number ?? 0) + 1,
          updated_at: now,
        })
        .eq("id", sub.test_id);
    } else if (aiScore < 65) {
      const { data: testRow } = await supabase
        .from("cvp_test_library")
        .select("total_fail_count")
        .eq("id", sub.test_id)
        .single();
      await supabase
        .from("cvp_test_library")
        .update({
          total_fail_count: ((testRow as Record<string, unknown> | null)?.total_fail_count as number ?? 0) + 1,
          updated_at: now,
        })
        .eq("id", sub.test_id);
    }

    // Determine overall application status based on all combinations
    const { data: allCombos } = await supabase
      .from("cvp_test_combinations")
      .select("id, status, ai_score")
      .eq("application_id", sub.application_id);

    const combos = (allCombos ?? []) as { id: string; status: string; ai_score: number | null }[];
    const allAssessed = combos.every(
      (c) =>
        c.status === "approved" ||
        c.status === "rejected" ||
        c.status === "assessed" ||
        c.status === "skipped" ||
        c.status === "no_test_available"
    );

    if (allAssessed) {
      const hasApproved = combos.some((c) => c.status === "approved");
      const hasStaffReview = combos.some((c) => c.status === "assessed");
      const allRejected = combos
        .filter((c) => c.status !== "skipped" && c.status !== "no_test_available")
        .every((c) => c.status === "rejected");

      let appStatus: string;
      if (hasStaffReview) {
        appStatus = "staff_review";
      } else if (allRejected) {
        appStatus = "rejected";
      } else if (hasApproved) {
        appStatus = "test_assessed";
      } else {
        appStatus = "test_assessed";
      }

      const appUpdate: Record<string, unknown> = {
        status: appStatus,
        updated_at: now,
      };

      // Queue rejection email for full auto-reject
      if (appStatus === "rejected") {
        appUpdate.rejection_reason = `All test combinations scored below threshold. Highest score: ${Math.max(...combos.map((c) => c.ai_score ?? 0))}`;
        appUpdate.rejection_email_status = "queued";
        appUpdate.rejection_email_queued_at = now;
        appUpdate.can_reapply_after = new Date(
          Date.now() + 180 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0]; // 6 months
      }

      await supabase
        .from("cvp_applications")
        .update(appUpdate)
        .eq("id", sub.application_id);
    }

    return jsonResponse({
      success: true,
      data: {
        submissionId,
        combinationId,
        score: aiScore,
        status: combinationStatus,
        pass: aiScore >= 80,
      },
    });
  } catch (err) {
    console.error("Unhandled error in cvp-assess-test:", err);
    return jsonResponse(
      { success: false, error: "An unexpected error occurred." },
      500
    );
  }
});
