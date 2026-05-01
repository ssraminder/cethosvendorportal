import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunEmail } from "../_shared/mailgun.ts";
import {
  buildV4TestReminder24hr,
  buildV5TestExpired,
} from "../_shared/email-templates.ts";

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
  reminder_1_sent_at: string | null;
  reminder_2_sent_at: string | null;
  reminder_3_sent_at: string | null;
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
 * Cron job (hourly). Test invitation lifecycle:
 *
 * | Timing                                | Template | Action                |
 * |---------------------------------------|----------|-----------------------|
 * | Day 0                                 | V3       | Test invitation       |
 * | Day 3 (created_at <= now - 3d)        | V4       | Reminder #1           |
 * | Day 6 (reminder_1 sent + 3d)          | V4       | Reminder #2           |
 * | Day 9 (reminder_2 sent + 3d)          | V4       | Reminder #3 (final)   |
 * | Day 10 (token_expires_at)             | V5       | Token expired         |
 * | Day 12 (token expired + 2d)           | —        | Archive               |
 *
 * Idempotent. Processes batches of 50 per tier per tick.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const now = new Date();
    const appUrl = Deno.env.get("APP_URL") ?? "https://join.cethos.com";

    let reminder1Sent = 0;
    let reminder2Sent = 0;
    let reminder3Sent = 0;
    let expiredSent = 0;
    let archived = 0;
    let errors = 0;

    const dayMs = 24 * 60 * 60 * 1000;
    const isoMinus = (days: number): string =>
      new Date(now.getTime() - days * dayMs).toISOString();

    async function fetchApp(applicationId: string): Promise<ApplicationRow | null> {
      const { data } = await supabase
        .from("cvp_applications")
        .select("email, full_name, application_number")
        .eq("id", applicationId)
        .single();
      return data ? (data as unknown as ApplicationRow) : null;
    }

    function hoursLeft(row: TestSubmissionRow): number {
      return Math.max(
        0,
        Math.floor(
          (new Date(row.token_expires_at).getTime() - now.getTime()) / (1000 * 60 * 60),
        ),
      );
    }

    async function sendReminder(
      row: TestSubmissionRow,
      app: ApplicationRow,
      tag: string,
    ): Promise<void> {
      const tpl = buildV4TestReminder24hr({
        fullName: app.full_name,
        applicationNumber: app.application_number,
        testLink: `${appUrl}/test/${row.token}`,
        hoursRemaining: hoursLeft(row),
      });
      await sendMailgunEmail({
        to: { email: app.email, name: app.full_name },
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        respectDoNotContactFor: app.email,
        tags: [tag, row.application_id],
      });
    }

    // --- Reminder #1: Day 3 (created_at <= now - 3 days) ---
    {
      const { data: rows } = await supabase
        .from("cvp_test_submissions")
        .select(
          "id, application_id, token, token_expires_at, status, created_at, reminder_1_sent_at, reminder_2_sent_at, reminder_3_sent_at",
        )
        .in("status", ["sent", "viewed", "draft_saved"])
        .is("reminder_1_sent_at", null)
        .lt("created_at", isoMinus(3))
        .limit(50);

      for (const row of (rows ?? []) as unknown as TestSubmissionRow[]) {
        if (new Date(row.token_expires_at) <= now) continue;
        try {
          const app = await fetchApp(row.application_id);
          if (!app) continue;
          await sendReminder(row, app, "v4-test-reminder-1");
          await supabase
            .from("cvp_test_submissions")
            .update({
              reminder_1_sent_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", row.id);
          reminder1Sent++;
        } catch (err) {
          console.error(`Reminder #1 failed for submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    // --- Reminder #2: 3+ days after reminder #1 ---
    {
      const { data: rows } = await supabase
        .from("cvp_test_submissions")
        .select(
          "id, application_id, token, token_expires_at, status, created_at, reminder_1_sent_at, reminder_2_sent_at, reminder_3_sent_at",
        )
        .in("status", ["sent", "viewed", "draft_saved"])
        .not("reminder_1_sent_at", "is", null)
        .is("reminder_2_sent_at", null)
        .lt("reminder_1_sent_at", isoMinus(3))
        .limit(50);

      for (const row of (rows ?? []) as unknown as TestSubmissionRow[]) {
        if (new Date(row.token_expires_at) <= now) continue;
        try {
          const app = await fetchApp(row.application_id);
          if (!app) continue;
          await sendReminder(row, app, "v4-test-reminder-2");
          await supabase
            .from("cvp_test_submissions")
            .update({
              reminder_2_sent_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", row.id);
          reminder2Sent++;
        } catch (err) {
          console.error(`Reminder #2 failed for submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    // --- Reminder #3: 3+ days after reminder #2 ---
    {
      const { data: rows } = await supabase
        .from("cvp_test_submissions")
        .select(
          "id, application_id, token, token_expires_at, status, created_at, reminder_1_sent_at, reminder_2_sent_at, reminder_3_sent_at",
        )
        .in("status", ["sent", "viewed", "draft_saved"])
        .not("reminder_2_sent_at", "is", null)
        .is("reminder_3_sent_at", null)
        .lt("reminder_2_sent_at", isoMinus(3))
        .limit(50);

      for (const row of (rows ?? []) as unknown as TestSubmissionRow[]) {
        if (new Date(row.token_expires_at) <= now) continue;
        try {
          const app = await fetchApp(row.application_id);
          if (!app) continue;
          await sendReminder(row, app, "v4-test-reminder-3");
          await supabase
            .from("cvp_test_submissions")
            .update({
              reminder_3_sent_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", row.id);
          reminder3Sent++;
        } catch (err) {
          console.error(`Reminder #3 failed for submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    // --- Expired notification (token_expires_at passed) ---
    {
      const { data: rows } = await supabase
        .from("cvp_test_submissions")
        .select("id, application_id, token, token_expires_at, status, created_at, reminder_1_sent_at, reminder_2_sent_at, reminder_3_sent_at")
        .in("status", ["sent", "viewed", "draft_saved"])
        .lt("token_expires_at", now.toISOString())
        .limit(50);

      for (const row of (rows ?? []) as unknown as TestSubmissionRow[]) {
        try {
          const app = await fetchApp(row.application_id);
          if (!app) continue;
          const tpl = buildV5TestExpired({
            fullName: app.full_name,
            applicationNumber: app.application_number,
          });
          await sendMailgunEmail({
            to: { email: app.email, name: app.full_name },
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            respectDoNotContactFor: app.email,
            tags: ["v5-test-expired", row.application_id],
          });

          await supabase
            .from("cvp_test_submissions")
            .update({
              status: "expired",
              updated_at: now.toISOString(),
            })
            .eq("id", row.id);

          const { data: subData } = await supabase
            .from("cvp_test_submissions")
            .select("combination_id")
            .eq("id", row.id)
            .single();
          if (subData) {
            await supabase
              .from("cvp_test_combinations")
              .update({
                status: "test_sent",
                updated_at: now.toISOString(),
              })
              .eq("id", (subData as Record<string, unknown>).combination_id);
          }

          expiredSent++;
        } catch (err) {
          console.error(`Expiry notice failed for submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    // --- Archive: expired + 2 days, no submission ---
    {
      const { data: rows } = await supabase
        .from("cvp_test_submissions")
        .select("id, application_id")
        .eq("status", "expired")
        .lt("token_expires_at", isoMinus(2))
        .limit(50);

      for (const row of (rows ?? []) as { id: string; application_id: string }[]) {
        try {
          const { data: allSubs } = await supabase
            .from("cvp_test_submissions")
            .select("id, status")
            .eq("application_id", row.application_id);
          const subs = (allSubs ?? []) as { id: string; status: string }[];
          const allArchivable = subs.every(
            (s) => s.status === "expired" || s.status === "archived" || s.status === "submitted",
          );
          if (allArchivable) {
            await supabase
              .from("cvp_test_submissions")
              .update({ status: "archived", updated_at: now.toISOString() })
              .eq("id", row.id);
            archived++;
          }
        } catch (err) {
          console.error(`Archive failed for submission ${row.id}:`, err);
          errors++;
        }
      }
    }

    return jsonResponse({
      success: true,
      data: {
        reminder1Sent,
        reminder2Sent,
        reminder3Sent,
        expiredSent,
        archived,
        errors,
      },
    });
  } catch (err) {
    console.error("cvp-check-test-followups unhandled:", err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
