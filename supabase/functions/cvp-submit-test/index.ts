import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendBrevoEmail, BREVO_TEMPLATES } from "../_shared/brevo.ts";

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
  token: string;
  token_expires_at: string;
  status: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * cvp-submit-test
 *
 * Handles the final test submission from the applicant.
 * Stores the submitted file/content, marks the submission as submitted,
 * sends V7 confirmation email, and triggers AI assessment.
 *
 * Payload: { token: string, submittedContent: string, submittedNotes?: string }
 *
 * For file uploads, the frontend uploads to Supabase Storage first,
 * then passes the storage path in submittedContent.
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

    const { token, submittedContent, submittedNotes } = await req.json();
    if (!token) {
      return jsonResponse(
        { success: false, error: "Token is required" },
        400
      );
    }

    if (!submittedContent || typeof submittedContent !== "string" || submittedContent.trim() === "") {
      return jsonResponse(
        { success: false, error: "Submitted content is required" },
        400
      );
    }

    // Fetch submission by token
    const { data: submission, error: subError } = await supabase
      .from("cvp_test_submissions")
      .select("*")
      .eq("token", token)
      .single();

    if (subError || !submission) {
      return jsonResponse(
        { success: false, error: "Invalid test link." },
        404
      );
    }

    const sub = submission as unknown as TestSubmissionRow;

    // One submission per token — enforce strictly
    if (sub.status === "submitted" || sub.status === "assessed") {
      return jsonResponse(
        {
          success: false,
          error: "already_submitted",
          message: "This test has already been submitted.",
        },
        400
      );
    }

    // Check token expiry
    const now = new Date();
    if (now > new Date(sub.token_expires_at)) {
      await supabase
        .from("cvp_test_submissions")
        .update({ status: "expired", updated_at: now.toISOString() })
        .eq("id", sub.id);

      return jsonResponse(
        {
          success: false,
          error: "token_expired",
          message: "This test link has expired.",
        },
        400
      );
    }

    // Determine file path for the submission
    const storagePath = `vendor/tests/${sub.application_id}/${sub.token}`;

    // Update submission record
    const { error: updateError } = await supabase
      .from("cvp_test_submissions")
      .update({
        status: "submitted",
        submitted_file_path: submittedContent.startsWith("vendor/")
          ? submittedContent
          : storagePath,
        submitted_notes: submittedNotes ?? null,
        submitted_at: now.toISOString(),
        // Keep draft content for reference
        draft_content: submittedContent.startsWith("vendor/")
          ? (submission as Record<string, unknown>).draft_content
          : submittedContent,
        updated_at: now.toISOString(),
      })
      .eq("id", sub.id);

    if (updateError) {
      console.error("Error updating test submission:", updateError);
      return jsonResponse(
        { success: false, error: "Failed to submit test. Please try again." },
        500
      );
    }

    // Update the combination status
    await supabase
      .from("cvp_test_combinations")
      .update({
        status: "test_submitted",
        updated_at: now.toISOString(),
      })
      .eq("id", sub.combination_id);

    // Check if all combinations for this application have been submitted
    const { data: allCombinations } = await supabase
      .from("cvp_test_combinations")
      .select("id, status")
      .eq("application_id", sub.application_id);

    const allSubmitted = (allCombinations ?? []).every(
      (c: Record<string, unknown>) =>
        c.status === "test_submitted" ||
        c.status === "assessed" ||
        c.status === "approved" ||
        c.status === "rejected" ||
        c.status === "skipped" ||
        c.status === "no_test_available"
    );

    if (allSubmitted) {
      await supabase
        .from("cvp_applications")
        .update({
          status: "test_submitted",
          updated_at: now.toISOString(),
        })
        .eq("id", sub.application_id);
    } else {
      // At least one test is in progress
      await supabase
        .from("cvp_applications")
        .update({
          status: "test_in_progress",
          updated_at: now.toISOString(),
        })
        .eq("id", sub.application_id);
    }

    // Send V7 — Test Received confirmation email
    const { data: appData } = await supabase
      .from("cvp_applications")
      .select("email, full_name, application_number")
      .eq("id", sub.application_id)
      .single();

    if (appData) {
      const app = appData as Record<string, unknown>;
      await sendBrevoEmail({
        to: {
          email: app.email as string,
          name: app.full_name as string,
        },
        templateId: BREVO_TEMPLATES.V7_TEST_RECEIVED,
        params: {
          fullName: app.full_name as string,
          applicationNumber: app.application_number as string,
        },
      });
    }

    // Trigger AI assessment (fire and forget)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      fetch(`${supabaseUrl}/functions/v1/cvp-assess-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          submissionId: sub.id,
          combinationId: sub.combination_id,
        }),
      }).catch((err) => {
        console.error("Error triggering test assessment:", err);
      });
    } catch (assessError) {
      console.error("Error triggering test assessment:", assessError);
    }

    return jsonResponse({
      success: true,
      data: {
        submissionId: sub.id,
        submittedAt: now.toISOString(),
      },
    });
  } catch (err) {
    console.error("Unhandled error in cvp-submit-test:", err);
    return jsonResponse(
      { success: false, error: "An unexpected error occurred." },
      500
    );
  }
});
