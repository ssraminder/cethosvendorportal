/**
 * cvp-process-feedback-auto-send
 *
 * Cron job (every 5 minutes). Picks up cvp_test_feedback_rounds rows that
 * are due to send and fires V22 by delegating to
 * cvp-send-test-feedback-request. The send function already creates/refreshes
 * the row's token and updates status to 'sent'; this cron just nudges it.
 *
 * Idempotent: rows whose auto_sent_at is already set are skipped, and we
 * cap retries with auto_send_attempts.
 *
 * Triggered by:
 *   - pg_cron job set up alongside the migration (every 5 min)
 *   - Manual POST for testing
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireCronSecret } from "../_shared/require-cron-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const MAX_AUTO_SEND_ATTEMPTS = 3;
const BATCH_SIZE = 25;

interface FeedbackRoundRow {
  submission_id: string;
  status: string;
  auto_send_at: string | null;
  auto_sent_at: string | null;
  staff_skip: boolean;
  auto_send_attempts: number;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  const authed = await requireCronSecret(req);
  if (!authed.ok) return jsonResponse({ success: false, error: authed.error }, authed.status);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const nowIso = new Date().toISOString();

  const { data: dueRows, error: queryErr } = await supabase
    .from("cvp_test_feedback_rounds")
    .select("submission_id, status, auto_send_at, auto_sent_at, staff_skip, auto_send_attempts")
    .eq("status", "pending")
    .eq("staff_skip", false)
    .is("auto_sent_at", null)
    .lte("auto_send_at", nowIso)
    .lt("auto_send_attempts", MAX_AUTO_SEND_ATTEMPTS)
    .limit(BATCH_SIZE);

  if (queryErr) {
    console.error("cvp-process-feedback-auto-send query error:", queryErr);
    return jsonResponse({ success: false, error: queryErr.message }, 500);
  }

  const rows = (dueRows ?? []) as FeedbackRoundRow[];

  let sent = 0;
  let errored = 0;

  for (const row of rows) {
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/cvp-send-test-feedback-request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            submissionId: row.submission_id,
            // Don't force a new token — the row was created with one in
            // cvp-assess-test and any admin-shared smoke link should keep
            // working.
            forceResend: false,
          }),
        },
      );
      const body = (await res.json()) as { success?: boolean; error?: string };
      if (body.success) {
        await supabase
          .from("cvp_test_feedback_rounds")
          .update({
            status: "sent",
            auto_sent_at: new Date().toISOString(),
            auto_send_attempts: row.auto_send_attempts + 1,
            auto_send_last_error: null,
          })
          .eq("submission_id", row.submission_id);
        sent += 1;
      } else {
        await supabase
          .from("cvp_test_feedback_rounds")
          .update({
            auto_send_attempts: row.auto_send_attempts + 1,
            auto_send_last_error: body.error ?? "send_failed",
          })
          .eq("submission_id", row.submission_id);
        errored += 1;
      }
    } catch (err) {
      console.error(
        `cvp-process-feedback-auto-send: send failed for ${row.submission_id}:`,
        err,
      );
      await supabase
        .from("cvp_test_feedback_rounds")
        .update({
          auto_send_attempts: row.auto_send_attempts + 1,
          auto_send_last_error: err instanceof Error ? err.message : String(err),
        })
        .eq("submission_id", row.submission_id);
      errored += 1;
    }
  }

  return jsonResponse({
    success: true,
    data: {
      due: rows.length,
      sent,
      errored,
    },
  });
});
