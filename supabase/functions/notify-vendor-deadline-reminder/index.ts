import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendBrevoEmail } from "../_shared/brevo.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Brevo template ID for deadline reminder — update when template is created
const TEMPLATE_DEADLINE_REMINDER = 21;

/**
 * Cron-compatible edge function: finds all active jobs with deadlines
 * within the next 24 hours and sends reminder emails to their vendors.
 *
 * Can also be called with a specific job_id for single-job reminders.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find active jobs with deadlines in the next 24 hours
    const { data: urgentJobs, error: jobsErr } = await supabase
      .from("cvp_jobs")
      .select("id, vendor_id, job_reference, domain, service_type, word_count, deadline, source_language_id, target_language_id")
      .in("status", ["accepted", "in_progress"])
      .gt("deadline", now.toISOString())
      .lte("deadline", in24h.toISOString());

    if (jobsErr) {
      console.error("Failed to query urgent jobs:", jobsErr);
      return new Response(
        JSON.stringify({ error: "Failed to query jobs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!urgentJobs || urgentJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0, message: "No urgent deadlines found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all vendor info
    const vendorIds = [...new Set(urgentJobs.map((j) => j.vendor_id))];
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, full_name, email")
      .in("id", vendorIds);

    const vendorMap = new Map((vendors || []).map((v: { id: string; full_name: string; email: string }) => [v.id, v]));

    // Fetch language names
    const langIds = [
      ...new Set(
        urgentJobs
          .flatMap((j) => [j.source_language_id, j.target_language_id])
          .filter(Boolean)
      ),
    ];
    let langMap = new Map<string, string>();
    if (langIds.length > 0) {
      const { data: langs } = await supabase
        .from("languages")
        .select("id, name")
        .in("id", langIds);
      langMap = new Map((langs || []).map((l: { id: string; name: string }) => [l.id, l.name]));
    }

    let sentCount = 0;
    for (const job of urgentJobs) {
      const vendor = vendorMap.get(job.vendor_id);
      if (!vendor) continue;

      const hoursLeft = Math.round(
        (new Date(job.deadline).getTime() - now.getTime()) / (60 * 60 * 1000)
      );

      const sent = await sendBrevoEmail({
        to: { email: vendor.email, name: vendor.full_name },
        templateId: TEMPLATE_DEADLINE_REMINDER,
        params: {
          vendor_name: vendor.full_name,
          job_reference: job.job_reference || "",
          source_language: langMap.get(job.source_language_id) || "Unknown",
          target_language: langMap.get(job.target_language_id) || "Unknown",
          deadline: new Date(job.deadline).toLocaleString("en-CA"),
          hours_remaining: hoursLeft,
          portal_url: Deno.env.get("VENDOR_PORTAL_URL") || "https://vendor.cethos.com",
        },
      });

      if (sent) sentCount++;
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sentCount, jobs_checked: urgentJobs.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-vendor-deadline-reminder error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
