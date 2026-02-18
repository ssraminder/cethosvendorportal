import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TranslatorPayload {
  roleType: "translator";
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  country: string;
  linkedinUrl?: string;
  yearsExperience: string;
  educationLevel: string;
  certifications?: { name: string; customName?: string; expiryDate?: string }[];
  catTools?: string[];
  languagePairs: {
    sourceLanguageId: string;
    targetLanguageId: string;
    domains: string[];
  }[];
  servicesOffered: string[];
  rateExpectation?: string;
  referralSource?: string;
  notes?: string;
}

interface CognitiveDebriefingPayload {
  roleType: "cognitive_debriefing";
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  country: string;
  linkedinUrl?: string;
  cogYearsExperience: string;
  educationLevel: string;
  cogDegreeField: string;
  cogCredentials?: string;
  cogNativeLanguageId: string;
  cogAdditionalLanguages?: string[];
  cogInstrumentTypes: string[];
  cogTherapyAreas: string[];
  cogPharmaClients?: string;
  cogIsporFamiliarity: string;
  cogFdaFamiliarity: string;
  cogPriorDebriefReports: boolean;
  cogAvailability: string;
  cogRateExpectation?: string;
  referralSource?: string;
  notes?: string;
}

type ApplicationPayload = TranslatorPayload | CognitiveDebriefingPayload;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateApplicationNumber(
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const { count, error } = await supabase
    .from("cvp_applications")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error counting applications:", error);
  }

  const nextNumber = ((count ?? 0) + 1).toString().padStart(4, "0");
  return `APP-${year}-${nextNumber}`;
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

    const payload: ApplicationPayload = await req.json();

    // Basic validation
    if (!payload.fullName || !payload.email || !payload.country) {
      return jsonResponse(
        { success: false, error: "Missing required fields: fullName, email, country" },
        400
      );
    }

    if (!payload.roleType || !["translator", "cognitive_debriefing"].includes(payload.roleType)) {
      return jsonResponse(
        { success: false, error: "Invalid role type" },
        400
      );
    }

    // Check reapplication cooldown
    const { data: existingApps } = await supabase
      .from("cvp_applications")
      .select("can_reapply_after, status")
      .eq("email", payload.email)
      .not("can_reapply_after", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingApps && existingApps.length > 0) {
      const cooldownDate = new Date(existingApps[0].can_reapply_after);
      if (cooldownDate > new Date()) {
        return jsonResponse(
          {
            success: false,
            error: `Thank you for your interest. You may reapply after ${cooldownDate.toLocaleDateString("en-CA")}.`,
          },
          400
        );
      }
    }

    // Generate application number
    const applicationNumber = await generateApplicationNumber(supabase);

    // Extract IP and user agent
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";

    // Build application row
    const applicationRow: Record<string, unknown> = {
      application_number: applicationNumber,
      role_type: payload.roleType,
      email: payload.email,
      full_name: payload.fullName,
      phone: payload.phone ?? null,
      city: payload.city ?? null,
      country: payload.country,
      linkedin_url: payload.linkedinUrl ?? null,
      referral_source: payload.referralSource ?? null,
      notes: payload.notes ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
      status: "submitted",
    };

    if (payload.roleType === "translator") {
      const tp = payload as TranslatorPayload;
      applicationRow.years_experience = parseInt(tp.yearsExperience, 10);
      applicationRow.education_level = tp.educationLevel;
      applicationRow.certifications = tp.certifications ?? [];
      applicationRow.cat_tools = tp.catTools ?? [];
      applicationRow.services_offered = tp.servicesOffered;
      applicationRow.rate_expectation = tp.rateExpectation
        ? parseFloat(tp.rateExpectation)
        : null;
    } else {
      const cp = payload as CognitiveDebriefingPayload;
      applicationRow.cog_years_experience = parseInt(cp.cogYearsExperience, 10);
      applicationRow.education_level = cp.educationLevel;
      applicationRow.cog_degree_field = cp.cogDegreeField;
      applicationRow.cog_credentials = cp.cogCredentials ?? null;
      applicationRow.cog_instrument_types = cp.cogInstrumentTypes;
      applicationRow.cog_therapy_areas = cp.cogTherapyAreas;
      applicationRow.cog_pharma_clients = cp.cogPharmaClients ?? null;
      applicationRow.cog_ispor_familiarity = cp.cogIsporFamiliarity;
      applicationRow.cog_fda_familiarity = cp.cogFdaFamiliarity;
      applicationRow.cog_prior_debrief_reports = cp.cogPriorDebriefReports;
      applicationRow.cog_availability = cp.cogAvailability;
      applicationRow.cog_rate_expectation = cp.cogRateExpectation
        ? parseFloat(cp.cogRateExpectation)
        : null;
    }

    // Insert application
    const { data: application, error: insertError } = await supabase
      .from("cvp_applications")
      .insert(applicationRow)
      .select("id, application_number")
      .single();

    if (insertError) {
      console.error("Error inserting application:", insertError);
      return jsonResponse(
        { success: false, error: "Failed to submit application. Please try again." },
        500
      );
    }

    // Create test combinations for translators
    if (payload.roleType === "translator") {
      const tp = payload as TranslatorPayload;
      const combinationRows: Record<string, unknown>[] = [];

      for (const pair of tp.languagePairs) {
        for (const domain of pair.domains) {
          for (const serviceType of tp.servicesOffered) {
            combinationRows.push({
              application_id: application.id,
              source_language_id: pair.sourceLanguageId,
              target_language_id: pair.targetLanguageId,
              domain,
              service_type: serviceType,
              status: "pending",
            });
          }
        }
      }

      if (combinationRows.length > 0) {
        const { error: combError } = await supabase
          .from("cvp_test_combinations")
          .insert(combinationRows);

        if (combError) {
          console.error("Error inserting test combinations:", combError);
          // Non-fatal — application is already created
        }
      }
    }

    // Send confirmation email (V1) via Brevo
    try {
      const brevoApiKey = Deno.env.get("BREVO_API_KEY");
      if (brevoApiKey) {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: [{ email: payload.email, name: payload.fullName }],
            templateId: 1, // V1 — Application Received (update when Brevo template created)
            params: {
              fullName: payload.fullName,
              applicationNumber,
              roleType: payload.roleType === "translator"
                ? "Translator / Reviewer"
                : "Cognitive Debriefing Consultant",
            },
          }),
        });
      }
    } catch (emailError) {
      // Non-fatal — log but don't fail the submission
      console.error("Error sending confirmation email:", emailError);
    }

    // Trigger pre-screening (fire and forget — calls the prescreen edge function)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      fetch(`${supabaseUrl}/functions/v1/cvp-prescreen-application`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ applicationId: application.id }),
      }).catch((err) => {
        console.error("Error triggering prescreen:", err);
      });
    } catch (prescreenError) {
      console.error("Error triggering prescreen:", prescreenError);
    }

    return jsonResponse({
      success: true,
      data: {
        applicationNumber: application.application_number,
        applicationId: application.id,
      },
    });
  } catch (err) {
    console.error("Unhandled error in cvp-submit-application:", err);
    return jsonResponse(
      { success: false, error: "An unexpected error occurred. Please try again." },
      500
    );
  }
});
