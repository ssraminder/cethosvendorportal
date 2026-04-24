// Approve a CVP application → create vendor + cvp_translator rows, issue a
// password-setup token, and send the V11 welcome email.
//
// Invoked by the CETHOS portal's RecruitmentDetail page via POST with body
// { applicationId, combinationIds? (optional; defaults to all pending), staffId? }.
//
// Idempotent: re-calling on an already-approved application is a no-op.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunEmail } from "../_shared/mailgun.ts";
import { buildV11ApprovedWelcome } from "../_shared/email-templates.ts";
import {
  claudeRewrite,
  logDecision,
  APPROVE_NOTE_SYSTEM_PROMPT,
} from "../_shared/decision-ai.ts";

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

interface ApprovePayload {
  applicationId: string;
  combinationIds?: string[];
  staffId?: string;
  /** Optional staff notes — captured + AI-rephrased for inclusion in V11. */
  staffNotes?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let body: ApprovePayload;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  if (!body.applicationId) return json({ success: false, error: "applicationId_required" }, 400);

  const { data: app, error: appErr } = await supabase
    .from("cvp_applications")
    .select("*")
    .eq("id", body.applicationId)
    .single();
  if (appErr || !app) return json({ success: false, error: "application_not_found" }, 404);

  if (app.status === "approved" && app.translator_id) {
    return json({
      success: true,
      idempotent: true,
      data: { applicationId: app.id, translatorId: app.translator_id },
    });
  }

  const comboQuery = supabase
    .from("cvp_test_combinations")
    .select("id, source_language_id, target_language_id, domain, service_type, approved_rate")
    .eq("application_id", body.applicationId);

  const { data: combos, error: comboErr } = body.combinationIds && body.combinationIds.length > 0
    ? await comboQuery.in("id", body.combinationIds)
    : await comboQuery;
  if (comboErr) return json({ success: false, error: "combination_lookup_failed", detail: comboErr.message }, 500);

  const approveIds = (combos ?? []).map((c) => c.id);
  if (approveIds.length === 0) {
    return json({ success: false, error: "no_combinations_to_approve" }, 400);
  }

  await supabase
    .from("cvp_test_combinations")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: body.staffId ?? null,
    })
    .in("id", approveIds);

  const approvedCombos = (combos ?? []).map((c) => ({
    source_language_id: c.source_language_id,
    target_language_id: c.target_language_id,
    domain: c.domain,
    service_type: c.service_type,
    approved_rate: c.approved_rate,
  }));

  let vendorId: string | null = null;
  const { data: existingVendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("email", app.email)
    .maybeSingle();

  if (existingVendor?.id) {
    vendorId = existingVendor.id;
  } else {
    const vendorRow = {
      full_name: app.full_name,
      email: app.email,
      phone: app.phone ?? null,
      country: app.country ?? null,
      city: app.city ?? null,
      vendor_type: app.role_type,
      rate_currency: app.rate_currency ?? "CAD",
      certifications: app.certifications ?? [],
      years_experience: app.years_experience ?? null,
      status: "active",
      availability_status: "available",
      total_projects: 0,
    };
    const { data: newVendor, error: vErr } = await supabase
      .from("vendors")
      .insert(vendorRow)
      .select("id")
      .single();
    if (vErr || !newVendor) {
      return json({ success: false, error: "vendor_create_failed", detail: vErr?.message }, 500);
    }
    vendorId = newVendor.id;
  }

  let translatorId: string | null = null;
  const { data: existingTranslator } = await supabase
    .from("cvp_translators")
    .select("id")
    .eq("email", app.email)
    .maybeSingle();

  if (existingTranslator?.id) {
    translatorId = existingTranslator.id;
    await supabase
      .from("cvp_translators")
      .update({
        approved_combinations: approvedCombos,
        application_id: body.applicationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", translatorId);
  } else {
    const trRow: Record<string, unknown> = {
      application_id: body.applicationId,
      email: app.email,
      full_name: app.full_name,
      phone: app.phone ?? null,
      country: app.country ?? null,
      linkedin_url: app.linkedin_url ?? null,
      role_type: app.role_type,
      tier: app.assigned_tier ?? "standard",
      approved_combinations: approvedCombos,
      certifications: app.certifications ?? [],
      cat_tools: app.cat_tools ?? [],
      default_rate_currency: app.rate_currency ?? "CAD",
      is_active: true,
      profile_completeness: 0,
      total_jobs_completed: 0,
      cog_instrument_types: app.cog_instrument_types ?? null,
      cog_therapy_areas: app.cog_therapy_areas ?? null,
      cog_ispor_familiarity: app.cog_ispor_familiarity ?? null,
      cog_fda_familiarity: app.cog_fda_familiarity ?? null,
    };
    const { data: newTr, error: trErr } = await supabase
      .from("cvp_translators")
      .insert(trRow)
      .select("id")
      .single();
    if (trErr || !newTr) {
      return json({ success: false, error: "translator_create_failed", detail: trErr?.message }, 500);
    }
    translatorId = newTr.id;
  }

  const setupToken = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 72 * 3600 * 1000);

  const { data: existingAuth } = await supabase
    .from("vendor_auth")
    .select("vendor_id")
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (existingAuth) {
    await supabase
      .from("vendor_auth")
      .update({
        password_setup_token: setupToken,
        password_setup_expires_at: expiresAt.toISOString(),
        must_reset: true,
        updated_at: now.toISOString(),
      })
      .eq("vendor_id", vendorId);
  } else {
    await supabase.from("vendor_auth").insert({
      vendor_id: vendorId,
      password_setup_token: setupToken,
      password_setup_expires_at: expiresAt.toISOString(),
      must_reset: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }

  const staffNotes = (body.staffNotes ?? "").trim();

  await supabase
    .from("cvp_applications")
    .update({
      status: "approved",
      translator_id: translatorId,
      staff_reviewed_by: body.staffId ?? null,
      staff_reviewed_at: now.toISOString(),
      staff_review_notes: staffNotes || null,
      updated_at: now.toISOString(),
    })
    .eq("id", body.applicationId);

  // Optional AI-rewrite of staff notes into a warm welcome line for V11.
  let aiInputPrompt: string | null = null;
  let aiOutput: string | null = null;
  let aiError: string | null = null;
  let staffMessageForEmail: string | null = null;
  if (staffNotes.length >= 5) {
    aiInputPrompt = `Applicant: ${app.full_name}\nApplication: ${app.application_number}\n\nStaff notes (internal):\n${staffNotes}`;
    const ai = await claudeRewrite({
      systemPrompt: APPROVE_NOTE_SYSTEM_PROMPT,
      userMessage: aiInputPrompt,
      maxTokens: 250,
    });
    if (ai.ok) {
      aiOutput = ai.text;
      staffMessageForEmail = ai.text && ai.text.trim().length > 0 ? ai.text : null;
    } else {
      aiError = ai.error;
    }
  }

  const vendorPortalUrl = Deno.env.get("VENDOR_PORTAL_URL") ?? "https://vendor.cethos.com";
  const passwordSetupLink = `${vendorPortalUrl}/setup-password?token=${setupToken}`;
  const approvedCombinationsListHtml = `<ul>${approvedCombos
    .map((c) => `<li>${c.service_type} — ${c.domain}</li>`)
    .join("")}</ul>`;

  const tpl = buildV11ApprovedWelcome({
    fullName: app.full_name,
    applicationNumber: app.application_number,
    vendorPortalUrl,
    passwordSetupLink,
    passwordSetupExpiryHours: 72,
    approvedCombinationsList: approvedCombinationsListHtml,
    staffMessage: staffMessageForEmail,
  });
  await sendMailgunEmail({
    to: { email: app.email, name: app.full_name },
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    respectDoNotContactFor: app.email,
    tags: ["v11-approved-welcome", body.applicationId],
  });

  await logDecision({
    supabase,
    applicationId: body.applicationId,
    action: "approved",
    staffNotes: staffNotes || null,
    aiInputPrompt,
    aiOutput,
    aiError,
    messageSentSubject: tpl.subject,
    messageSentBody: tpl.html,
    staffUserId: body.staffId ?? null,
  });

  return json({
    success: true,
    data: {
      applicationId: body.applicationId,
      translatorId,
      vendorId,
      approvedCount: approveIds.length,
      aiProcessed: Boolean(aiOutput),
    },
  });
});
