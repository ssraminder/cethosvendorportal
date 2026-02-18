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
  application_id: string;
  token: string;
  token_expires_at: string;
  status: string;
  created_at: string;
  reminder_day2_sent_at: string | null;
  reminder_day3_sent_at: string | null;
  reminder_day7_sent_at: string | null;
}

interface ApplicationRow {
  email: string;
  full_name: string;
  application_number: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * cvp-check-test-followups
 *
 * Cron job that runs every hour. Processes the test follow-up email sequence:
 *
 * | Timing                        | Template | Action                       |
 * |-------------------------------|----------|------------------------------|
 * | Day 1                         | V3       | Test invitation (already sent)|
 * | Day 2 (24hrs before expiry)   | V4       | Reminder email               |
 * | Day 3 (at expiry)             | V5       | Token expired notification   |
 * | Day 7                         | V6       | Final chance — request new link|
 * | Day 10                        | —        | Status → archived, no email  |
 *
 * Each token has its own sequence tracked independently.
 * Processes in batches of 50. Idempotent — safe to run multiple times.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Accept both POST (cron trigger) and GET (manual trigger)
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const appUrl = Deno.env.get("APP_URL") ?? "https://join.cethos.com";

    let day2Sent = 0;
    let day3Sent = 0;
    let day7Sent = 0;
    let archived = 0;
    let errors = 0;

    // --- Day 2: 24hr reminder (24 hours after creation = 24 hours before expiry) ---
    // Submissions that are sent/viewed/draft_saved, created >= 24hrs ago, not yet reminded
    {
      const twentyFourHoursAgo = new Date(
        now.getTime() - 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: day2Submissions } = await supabase
        .from("cvp_test_submissions")
        .select("id, application_id, token, token_expires_at, status, created_at, reminder_day2_sent_at, reminder_day3_sent_at, reminder_day7_sent_at")
        .in("status", ["sent", "viewed", "draft_saved"])
        .is("reminder_day2_sent_at", null)
        .lt("created_at", twentyFourHoursAgo)
        .limit(50);

      for (const row of (day2Submissions ?? []) as unknown as TestSubmissionRow[]) {
        // Only send if token hasn't expired yet
        if (new Date(row.token_expires_at) <= now) continue;

        try {
          const { data: appData } = await supabase
            .from("cvp_applications")
            .select("email, full_name, application_number")
            .eq("id", row.application_id)
            .single();

          if (!appData) continue;
          const app = appData as unknown as ApplicationRow;

          const hoursLeft = Math.max(
            0,
            Math.floor(
              (new Date(row.token_expires_at).getTime() - now.getTime()) /
                (1000 * 60 * 60)
            )
          );

          await sendBrevoEmail({
            to: { email: app.email, name: app.full_name },
            templateId: BREVO_TEMPLATES.V4_TEST_REMINDER_24HR,
            params: {
              fullName: app.full_name,
              applicationNumber: app.application_number,
              testLink: `${appUrl}/test/${row.token}`,
              hoursRemaining: hoursLeft,
            },
          });

          await supabase
            .from("cvp_test_submissions")
            .update({
              reminder_day2_sent_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", row.id);

          day2Sent++;
        } catch (err) {
          console.error(`Error processing Day 2 reminder for submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    // --- Day 3: Token expired notification ---
    // Submissions whose token has expired, not yet notified
    {
      const { data: day3Submissions } = await supabase
        .from("cvp_test_submissions")
        .select("id, application_id, token, token_expires_at, status, created_at, reminder_day2_sent_at, reminder_day3_sent_at, reminder_day7_sent_at")
        .in("status", ["sent", "viewed", "draft_saved"])
        .is("reminder_day3_sent_at", null)
        .lt("token_expires_at", now.toISOString())
        .limit(50);

      for (const row of (day3Submissions ?? []) as unknown as TestSubmissionRow[]) {
        try {
          const { data: appData } = await supabase
            .from("cvp_applications")
            .select("email, full_name, application_number")
            .eq("id", row.application_id)
            .single();

          if (!appData) continue;
          const app = appData as unknown as ApplicationRow;

          await sendBrevoEmail({
            to: { email: app.email, name: app.full_name },
            templateId: BREVO_TEMPLATES.V5_TEST_EXPIRED,
            params: {
              fullName: app.full_name,
              applicationNumber: app.application_number,
            },
          });

          await supabase
            .from("cvp_test_submissions")
            .update({
              status: "expired",
              reminder_day3_sent_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", row.id);

          // Update combination status
          const { data: subData } = await supabase
            .from("cvp_test_submissions")
            .select("combination_id")
            .eq("id", row.id)
            .single();

          if (subData) {
            await supabase
              .from("cvp_test_combinations")
              .update({
                status: "test_sent", // Stays as test_sent but expired
                updated_at: now.toISOString(),
              })
              .eq("id", (subData as Record<string, unknown>).combination_id);
          }

          day3Sent++;
        } catch (err) {
          console.error(`Error processing Day 3 expiry for submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    // --- Day 7: Final chance email ---
    // Submissions expired >= 4 days ago (created >= 7 days ago), day3 sent but not day7
    {
      const sevenDaysAgo = new Date(
        now.getTime() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: day7Submissions } = await supabase
        .from("cvp_test_submissions")
        .select("id, application_id, token, token_expires_at, status, created_at, reminder_day2_sent_at, reminder_day3_sent_at, reminder_day7_sent_at")
        .eq("status", "expired")
        .not("reminder_day3_sent_at", "is", null)
        .is("reminder_day7_sent_at", null)
        .lt("created_at", sevenDaysAgo)
        .limit(50);

      for (const row of (day7Submissions ?? []) as unknown as TestSubmissionRow[]) {
        try {
          const { data: appData } = await supabase
            .from("cvp_applications")
            .select("email, full_name, application_number")
            .eq("id", row.application_id)
            .single();

          if (!appData) continue;
          const app = appData as unknown as ApplicationRow;

          await sendBrevoEmail({
            to: { email: app.email, name: app.full_name },
            templateId: BREVO_TEMPLATES.V6_FINAL_CHANCE_DAY7,
            params: {
              fullName: app.full_name,
              applicationNumber: app.application_number,
              // Applicant can reply to request a new link
            },
          });

          await supabase
            .from("cvp_test_submissions")
            .update({
              reminder_day7_sent_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", row.id);

          day7Sent++;
        } catch (err) {
          console.error(`Error processing Day 7 final chance for submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    // --- Day 10: Archive ---
    // Submissions expired, day7 sent, created >= 10 days ago → archive
    {
      const tenDaysAgo = new Date(
        now.getTime() - 10 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: archiveSubmissions } = await supabase
        .from("cvp_test_submissions")
        .select("id, application_id")
        .eq("status", "expired")
        .not("reminder_day7_sent_at", "is", null)
        .lt("created_at", tenDaysAgo)
        .limit(50);

      for (const row of (archiveSubmissions ?? []) as { id: string; application_id: string }[]) {
        try {
          // No email — just archive
          // Check if all submissions for this application are expired/archived
          const { data: allSubs } = await supabase
            .from("cvp_test_submissions")
            .select("id, status")
            .eq("application_id", row.application_id);

          const allExpiredOrDone = (allSubs ?? []).every(
            (s: Record<string, unknown>) =>
              s.status === "expired" ||
              s.status === "submitted" ||
              s.status === "assessed"
          );

          if (allExpiredOrDone) {
            // Check if any tests were actually submitted
            const anySubmitted = (allSubs ?? []).some(
              (s: Record<string, unknown>) =>
                s.status === "submitted" || s.status === "assessed"
            );

            if (!anySubmitted) {
              // No tests submitted at all — archive the application
              await supabase
                .from("cvp_applications")
                .update({
                  status: "archived",
                  updated_at: now.toISOString(),
                })
                .eq("id", row.application_id);
            }
          }

          archived++;
        } catch (err) {
          console.error(`Error archiving submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    console.log(
      `cvp-check-test-followups: Day2=${day2Sent}, Day3=${day3Sent}, Day7=${day7Sent}, Archived=${archived}, Errors=${errors}`
    );

    return jsonResponse({
      success: true,
      data: {
        day2Sent,
        day3Sent,
        day7Sent,
        archived,
        errors,
      },
    });
  } catch (err) {
    console.error("Unhandled error in cvp-check-test-followups:", err);
    return jsonResponse(
      { success: false, error: "An unexpected error occurred." },
      500
    );
  }
});
