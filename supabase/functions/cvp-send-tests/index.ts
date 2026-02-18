import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendBrevoEmail, BREVO_TEMPLATES } from "../_shared/brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TestLibraryRow {
  id: string;
  title: string;
  source_language_id: string;
  target_language_id: string;
  domain: string;
  service_type: string;
  difficulty: string;
  source_text: string | null;
  source_file_path: string | null;
  instructions: string | null;
  times_used: number;
  last_used_at: string | null;
}

interface CombinationRow {
  id: string;
  application_id: string;
  source_language_id: string;
  target_language_id: string;
  domain: string;
  service_type: string;
  status: string;
}

interface ApplicationRow {
  id: string;
  email: string;
  full_name: string;
  application_number: string;
  ai_prescreening_result: {
    suggested_test_difficulty?: string;
  } | null;
}

interface LanguageJoin {
  id: string;
  name: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * cvp-send-tests
 *
 * Assigns tests from the test library to each pending combination for an application.
 * Creates cvp_test_submissions records with unique tokens (48hr expiry).
 * Sends batch test invitation email (Brevo V3).
 *
 * Triggered: automatically after pre-screen passes (score >= 70), or manually by staff.
 *
 * Payload: { applicationId: string }
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

    const { applicationId } = await req.json();
    if (!applicationId) {
      return jsonResponse(
        { success: false, error: "applicationId is required" },
        400
      );
    }

    // Fetch application
    const { data: application, error: appError } = await supabase
      .from("cvp_applications")
      .select("id, email, full_name, application_number, ai_prescreening_result")
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      console.error("Error fetching application:", appError);
      return jsonResponse(
        { success: false, error: "Application not found" },
        404
      );
    }

    const app = application as unknown as ApplicationRow;
    const suggestedDifficulty =
      app.ai_prescreening_result?.suggested_test_difficulty ?? "intermediate";

    // Fetch pending combinations for this application
    const { data: combinations, error: combError } = await supabase
      .from("cvp_test_combinations")
      .select("id, application_id, source_language_id, target_language_id, domain, service_type, status")
      .eq("application_id", applicationId)
      .eq("status", "pending");

    if (combError) {
      console.error("Error fetching combinations:", combError);
      return jsonResponse(
        { success: false, error: "Failed to fetch test combinations" },
        500
      );
    }

    const combs = (combinations ?? []) as unknown as CombinationRow[];
    if (combs.length === 0) {
      return jsonResponse(
        { success: false, error: "No pending test combinations found" },
        400
      );
    }

    const assigned: { combinationId: string; testId: string; token: string }[] = [];
    const noTestAvailable: string[] = [];

    for (const combo of combs) {
      // Find best matching test from library
      // Filter by language pair, domain, service type, difficulty; prefer least recently used
      const { data: tests } = await supabase
        .from("cvp_test_library")
        .select("id, title, source_language_id, target_language_id, domain, service_type, difficulty, source_text, source_file_path, instructions, times_used, last_used_at")
        .eq("source_language_id", combo.source_language_id)
        .eq("target_language_id", combo.target_language_id)
        .eq("domain", combo.domain)
        .eq("service_type", combo.service_type)
        .eq("is_active", true)
        .order("times_used", { ascending: true })
        .order("last_used_at", { ascending: true, nullsFirst: true });

      const availableTests = (tests ?? []) as unknown as TestLibraryRow[];

      // Prefer matching difficulty, fall back to any available
      let selectedTest = availableTests.find(
        (t) => t.difficulty === suggestedDifficulty
      );
      if (!selectedTest && availableTests.length > 0) {
        selectedTest = availableTests[0];
      }

      if (!selectedTest) {
        // No test available — flag for staff
        noTestAvailable.push(combo.id);
        await supabase
          .from("cvp_test_combinations")
          .update({
            status: "no_test_available",
            updated_at: new Date().toISOString(),
          })
          .eq("id", combo.id);
        continue;
      }

      // Create test submission with token (48hr expiry)
      const tokenExpiresAt = new Date(
        Date.now() + 48 * 60 * 60 * 1000
      ).toISOString();

      const { data: submission, error: subError } = await supabase
        .from("cvp_test_submissions")
        .insert({
          combination_id: combo.id,
          test_id: selectedTest.id,
          application_id: applicationId,
          token_expires_at: tokenExpiresAt,
          status: "sent",
        })
        .select("id, token")
        .single();

      if (subError || !submission) {
        console.error(
          `Error creating test submission for combination ${combo.id}:`,
          subError
        );
        continue;
      }

      // Update the combination with test assignment
      await supabase
        .from("cvp_test_combinations")
        .update({
          test_id: selectedTest.id,
          test_submission_id: submission.id,
          status: "test_sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", combo.id);

      // Update test library usage stats
      await supabase
        .from("cvp_test_library")
        .update({
          times_used: selectedTest.times_used + 1,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTest.id);

      assigned.push({
        combinationId: combo.id,
        testId: selectedTest.id,
        token: submission.token,
      });
    }

    // Update application status
    if (assigned.length > 0) {
      await supabase
        .from("cvp_applications")
        .update({
          status: "test_sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);
    }

    // Build test details for email
    const appUrl = Deno.env.get("APP_URL") ?? "https://join.cethos.com";
    const testLinks: string[] = [];

    for (const a of assigned) {
      // Fetch language names for the combination
      const combo = combs.find((c) => c.id === a.combinationId);
      if (combo) {
        const { data: srcLang } = await supabase
          .from("languages")
          .select("name")
          .eq("id", combo.source_language_id)
          .single();
        const { data: tgtLang } = await supabase
          .from("languages")
          .select("name")
          .eq("id", combo.target_language_id)
          .single();

        const src = (srcLang as unknown as LanguageJoin | null)?.name ?? "Unknown";
        const tgt = (tgtLang as unknown as LanguageJoin | null)?.name ?? "Unknown";

        testLinks.push(
          `${src} → ${tgt} (${combo.domain}, ${combo.service_type}): ${appUrl}/test/${a.token}`
        );
      }
    }

    // Send batch test invitation email (V3)
    if (assigned.length > 0) {
      await sendBrevoEmail({
        to: { email: app.email, name: app.full_name },
        templateId: BREVO_TEMPLATES.V3_TEST_INVITATION,
        params: {
          fullName: app.full_name,
          applicationNumber: app.application_number,
          testCount: assigned.length,
          testLinks: testLinks.join("\n"),
          expiryHours: 48,
        },
      });
    }

    return jsonResponse({
      success: true,
      data: {
        applicationId,
        testsAssigned: assigned.length,
        noTestAvailable: noTestAvailable.length,
        tokens: assigned.map((a) => a.token),
      },
    });
  } catch (err) {
    console.error("Unhandled error in cvp-send-tests:", err);
    return jsonResponse(
      { success: false, error: "An unexpected error occurred." },
      500
    );
  }
});
