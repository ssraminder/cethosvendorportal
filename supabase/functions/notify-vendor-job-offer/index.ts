import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunOperationalEmail } from "../_shared/mailgun.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function renderJobOfferEmail(params: {
  vendor_name: string;
  job_reference: string;
  source_language: string;
  target_language: string;
  domain: string;
  service_type: string;
  word_count: number;
  deadline: string;
  rate: string;
  portal_url: string;
}): { subject: string; html: string } {
  const subject = `New job offer — ${params.source_language} → ${params.target_language} · ${params.job_reference}`;
  const html = `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;padding:24px;">
  <h2 style="color:#0891B2;font-size:18px;">New job offer</h2>
  <p>Hi ${params.vendor_name},</p>
  <p>You have a new job offer from CETHOS:</p>
  <table style="border-collapse:collapse;font-size:14px;margin:12px 0;">
    <tr><td style="padding:4px 12px 4px 0;color:#6B7280;">Reference</td><td style="padding:4px 0;font-weight:600;">${params.job_reference}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6B7280;">Language pair</td><td style="padding:4px 0;font-weight:600;">${params.source_language} → ${params.target_language}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6B7280;">Domain</td><td style="padding:4px 0;">${params.domain}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6B7280;">Service</td><td style="padding:4px 0;">${params.service_type}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6B7280;">Word count</td><td style="padding:4px 0;">${params.word_count}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6B7280;">Deadline</td><td style="padding:4px 0;font-weight:600;">${params.deadline}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6B7280;">Rate</td><td style="padding:4px 0;">${params.rate}</td></tr>
  </table>
  <p><a href="${params.portal_url}/jobs" style="display:inline-block;background:#0891B2;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600;font-size:14px;">View in portal</a></p>
</div>`;
  return { subject, html };
}

interface JobOfferRequest {
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

    const { job_id } = (await req.json()) as JobOfferRequest;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch job details with vendor info
    const { data: job, error: jobErr } = await supabase
      .from("cvp_jobs")
      .select("id, vendor_id, job_reference, domain, service_type, word_count, deadline, rate, rate_unit, currency, source_language_id, target_language_id")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch vendor
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

    // Send email
    const rendered = renderJobOfferEmail({
      vendor_name: vendor.full_name,
      job_reference: job.job_reference || "",
      source_language: sourceLang,
      target_language: targetLang,
      domain: job.domain || "",
      service_type: job.service_type || "",
      word_count: job.word_count || 0,
      deadline: job.deadline ? new Date(job.deadline).toLocaleDateString("en-CA") : "TBD",
      rate: `${job.rate} ${job.currency}/${job.rate_unit}`,
      portal_url: Deno.env.get("VENDOR_PORTAL_URL") || "https://vendor.cethos.com",
    });
    const result = await sendMailgunOperationalEmail({
      to: { email: vendor.email, name: vendor.full_name },
      subject: rendered.subject,
      html: rendered.html,
      tags: ["job-offer", job_id],
    });

    return new Response(
      JSON.stringify({ success: true, email_sent: result.sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-vendor-job-offer error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
