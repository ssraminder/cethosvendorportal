import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
}

// Application row fetched from DB
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

const TRANSLATOR_SYSTEM_PROMPT = `You are an expert recruitment screener for CETHOS, a Canadian certified translation company.

You evaluate freelance translator applications. Return ONLY valid JSON matching the schema below — no preamble, no markdown.

Score on 0-100 scale. Consider:
- Language pair demand match (does the translation market need this pair?)
- Certification quality (ATA/CTTIC = high, ISO 17100 = high, none = low)
- Years of experience vs claimed domains — consistency check
- CAT tools proficiency (more tools = more flexible)
- Rate expectation vs market norms for Canadian certified translation ($12-20/page standard)
- Red flags: inconsistencies, implausible claims

Output JSON schema:
{
  "overall_score": number (0-100),
  "recommendation": "proceed" | "staff_review" | "reject",
  "demand_match": "high" | "medium" | "low",
  "certification_quality": "high" | "medium" | "low" | "none",
  "experience_consistency": "high" | "medium" | "low",
  "sample_quality": "not_provided",
  "rate_expectation_assessment": "within_band" | "above_band" | "below_band" | "not_provided",
  "red_flags": string[],
  "notes": string,
  "suggested_test_difficulty": "beginner" | "intermediate" | "advanced",
  "suggested_test_types": string[],
  "suggested_tier": "standard" | "senior" | "expert"
}

Tier assignment rules:
- standard: <3 years experience, basic or no certs
- senior: 3-7 years, ATA/CTTIC or equivalent
- expert: 7+ years, multiple recognised certs, specialist domains

Scoring guidelines:
- 70+ = strong candidate, proceed to testing
- 50-69 = uncertain, flag for staff review
- <50 = weak candidate, recommend rejection`;

const COG_DEBRIEF_SYSTEM_PROMPT = `You are an expert recruitment screener for CETHOS, evaluating cognitive debriefing consultant applications.

Cognitive debriefing consultants conduct qualitative interviews with patients/participants to assess whether translated clinical outcome assessments (COAs/PROs) are understood as intended.

Return ONLY valid JSON — no preamble, no markdown.

Evaluate based on these weighted criteria:
- COA/PRO instrument experience (30%)
- ISPOR/FDA COA guideline familiarity (20%)
- Interviewing/qualitative research skills (20%)
- Native/near-native target language fluency (20%)
- Prior debrief report writing experience (10%)

Output JSON schema:
{
  "overall_score": number (0-100),
  "recommendation": "staff_review",
  "coa_instrument_experience": "strong" | "partial" | "weak",
  "guideline_familiarity": "strong" | "partial" | "weak",
  "interviewing_skills": "strong" | "partial" | "weak",
  "language_fluency": "strong" | "partial" | "weak",
  "report_writing_experience": "strong" | "partial" | "weak",
  "red_flags": string[],
  "notes": string
}

IMPORTANT: recommendation MUST always be "staff_review" for cognitive debriefing — AI is advisory only, staff always makes the final decision.`;

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
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

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

    const { applicationId } = await req.json();
    if (!applicationId) {
      return jsonResponse(
        { success: false, error: "applicationId is required" },
        400
      );
    }

    // Update status to prescreening
    await supabase
      .from("cvp_applications")
      .update({ status: "prescreening", updated_at: new Date().toISOString() })
      .eq("id", applicationId);

    // Fetch application
    const { data: application, error: fetchError } = await supabase
      .from("cvp_applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (fetchError || !application) {
      console.error("Error fetching application:", fetchError);
      return jsonResponse(
        { success: false, error: "Application not found" },
        404
      );
    }

    const app = application as unknown as ApplicationRow;

    let aiResult: Record<string, unknown>;
    let aiScore: number;
    let newStatus: string;
    let assignedTier: string | null = null;

    try {
      if (app.role_type === "translator") {
        // Fetch test combinations for context
        const { data: combinations } = await supabase
          .from("cvp_test_combinations")
          .select(
            "id, domain, service_type, source_language:source_language_id(name), target_language:target_language_id(name)"
          )
          .eq("application_id", applicationId);

        const pairsDescription = (combinations as unknown as TestCombination[] | null)
          ?.map(
            (c) =>
              `${c.source_language.name} → ${c.target_language.name} (${c.domain}, ${c.service_type})`
          )
          .join("; ") ?? "No combinations";

        const userMessage = `Evaluate this translator application:

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

        let rawResponse: string;
        try {
          rawResponse = await callClaude(TRANSLATOR_SYSTEM_PROMPT, userMessage, 1024);
          aiResult = parseJsonResponse(rawResponse);
        } catch (firstErr) {
          console.error("First Claude call failed, retrying:", firstErr);
          // Retry once
          try {
            rawResponse = await callClaude(TRANSLATOR_SYSTEM_PROMPT, userMessage, 1024);
            aiResult = parseJsonResponse(rawResponse);
          } catch (retryErr) {
            console.error("Retry also failed:", retryErr);
            throw retryErr;
          }
        }

        const result = aiResult as unknown as PrescreenResult;
        aiScore = result.overall_score;
        assignedTier = result.suggested_tier ?? null;

        // Route by score
        if (aiScore >= 70) {
          newStatus = "prescreened"; // Ready for test assignment
        } else if (aiScore >= 50) {
          newStatus = "staff_review";
        } else {
          newStatus = "rejected";
        }
      } else {
        // Cognitive debriefing
        const userMessage = `Evaluate this cognitive debriefing consultant application:

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

        let rawResponse: string;
        try {
          rawResponse = await callClaude(COG_DEBRIEF_SYSTEM_PROMPT, userMessage, 1024);
          aiResult = parseJsonResponse(rawResponse);
        } catch (firstErr) {
          console.error("First Claude call failed, retrying:", firstErr);
          try {
            rawResponse = await callClaude(COG_DEBRIEF_SYSTEM_PROMPT, userMessage, 1024);
            aiResult = parseJsonResponse(rawResponse);
          } catch (retryErr) {
            console.error("Retry also failed:", retryErr);
            throw retryErr;
          }
        }

        const result = aiResult as unknown as CogPrescreenResult;
        aiScore = result.overall_score;
        // Cognitive debriefing ALWAYS goes to staff review
        newStatus = "staff_review";
      }
    } catch (aiError) {
      // AI fallback — never block the pipeline
      console.error("AI pre-screening failed, falling back to staff_review:", aiError);
      aiResult = {
        error: "ai_fallback",
        reason: aiError instanceof Error ? aiError.message : "Unknown AI error",
      };
      aiScore = 0;
      newStatus = "staff_review";
      assignedTier = null;
    }

    // Update application with results
    const updateData: Record<string, unknown> = {
      status: newStatus,
      ai_prescreening_score: aiScore,
      ai_prescreening_result: aiResult,
      ai_prescreening_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (assignedTier) {
      updateData.assigned_tier = assignedTier;
    }

    // For auto-reject, queue the rejection email with 48hr window
    if (newStatus === "rejected") {
      updateData.rejection_reason = `AI pre-screening score: ${aiScore}/100`;
      updateData.rejection_email_status = "queued";
      updateData.rejection_email_queued_at = new Date().toISOString();
      updateData.can_reapply_after = new Date(
        Date.now() + 180 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0]; // 6 months
    }

    const { error: updateError } = await supabase
      .from("cvp_applications")
      .update(updateData)
      .eq("id", applicationId);

    if (updateError) {
      console.error("Error updating application with prescreen results:", updateError);
    }

    // Send appropriate email based on routing
    try {
      const brevoApiKey = Deno.env.get("BREVO_API_KEY");
      if (brevoApiKey && newStatus !== "rejected") {
        let templateId: number;
        if (newStatus === "prescreened") {
          templateId = 2; // V2 — Pre-screen Passed
        } else {
          templateId = 8; // V8 — Under Manual Review
        }

        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: [{ email: app.email, name: app.full_name }],
            templateId,
            params: {
              fullName: app.full_name,
              applicationNumber:
                (application as Record<string, unknown>).application_number,
              roleType:
                app.role_type === "translator"
                  ? "Translator / Reviewer"
                  : "Cognitive Debriefing Consultant",
            },
          }),
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
      },
    });
  } catch (err) {
    console.error("Unhandled error in cvp-prescreen-application:", err);
    return jsonResponse(
      { success: false, error: "An unexpected error occurred." },
      500
    );
  }
});
