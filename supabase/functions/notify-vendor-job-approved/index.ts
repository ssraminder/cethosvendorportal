import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendBrevoEmail } from "../_shared/brevo.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Brevo template ID for job approved notification — update when template is created
const TEMPLATE_JOB_APPROVED = 22;

interface JobApprovedRequest {
  job_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { job_id } = (await req.json()) as JobApprovedRequest;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch job with vendor
    const { data: job, error: jobErr } = await supabase
      .from("cvp_jobs")
      .select("id, vendor_id, job_reference, domain, service_type, quality_score, reviewer_notes, rate, currency, rate_unit, estimated_total, source_language_id, target_language_id")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, full_name, email")
      .eq("id", job.vendor_id)
      .single();

    if (!vendor) {
      return new Response(
        JSON.stringify({ error: "Vendor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch language names
    const langIds = [job.source_language_id, job.target_language_id].filter(Boolean);
    let sourceLang = "Unknown";
    let targetLang = "Unknown";
    if (langIds.length > 0) {
      const { data: langs } = await supabase
        .from("languages")
        .select("id, name")
        .in("id", langIds);
      if (langs) {
        sourceLang = langs.find((l: { id: string; name: string }) => l.id === job.source_language_id)?.name || "Unknown";
        targetLang = langs.find((l: { id: string; name: string }) => l.id === job.target_language_id)?.name || "Unknown";
      }
    }

    const sent = await sendBrevoEmail({
      to: { email: vendor.email, name: vendor.full_name },
      templateId: TEMPLATE_JOB_APPROVED,
      params: {
        vendor_name: vendor.full_name,
        job_reference: job.job_reference || "",
        source_language: sourceLang,
        target_language: targetLang,
        quality_score: job.quality_score ?? "N/A",
        reviewer_notes: job.reviewer_notes || "No additional notes.",
        estimated_total: job.estimated_total
          ? `${job.estimated_total} ${job.currency}`
          : "TBD",
        portal_url: Deno.env.get("VENDOR_PORTAL_URL") || "https://vendor.cethos.com",
      },
    });

    return new Response(
      JSON.stringify({ success: true, email_sent: sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-vendor-job-approved error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
