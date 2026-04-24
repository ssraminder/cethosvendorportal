// Staff action: ask the applicant for additional information.
// Sets cvp_applications.status='info_requested', stores the request details,
// and sends V17 Request More Info email.
//
// POST body: { applicationId, requestDetails, staffId?, deadlineDays? (default 7) }

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunEmail } from "../_shared/mailgun.ts";
import { buildV17RequestMoreInfo } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let body: { applicationId?: string; requestDetails?: string; staffId?: string; deadlineDays?: number };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  if (!body.applicationId) return json({ success: false, error: "applicationId_required" }, 400);
  if (!body.requestDetails || body.requestDetails.trim().length < 10) {
    return json({ success: false, error: "requestDetails_too_short" }, 400);
  }

  const { data: app, error: appErr } = await supabase
    .from("cvp_applications")
    .select("id, email, full_name, application_number")
    .eq("id", body.applicationId)
    .single();
  if (appErr || !app) return json({ success: false, error: "application_not_found" }, 404);

  const now = new Date();
  const deadlineDays = body.deadlineDays ?? 7;
  const deadline = new Date(now.getTime() + deadlineDays * 24 * 3600 * 1000);
  const deadlineDate = deadline.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  await supabase
    .from("cvp_applications")
    .update({
      status: "info_requested",
      staff_review_notes: body.requestDetails,
      staff_reviewed_by: body.staffId ?? null,
      staff_reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", body.applicationId);

  const tpl = buildV17RequestMoreInfo({
    fullName: app.full_name as string,
    applicationNumber: app.application_number as string,
    requestDetails: body.requestDetails,
    infoDeadlineDate: deadlineDate,
  });
  const result = await sendMailgunEmail({
    to: { email: app.email as string, name: app.full_name as string },
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    respectDoNotContactFor: app.email as string,
    tags: ["v17-request-more-info", body.applicationId],
  });

  return json({ success: true, data: { applicationId: body.applicationId, emailSent: result.sent, suppressed: result.suppressed } });
});
