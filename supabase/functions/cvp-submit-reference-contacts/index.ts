/**
 * cvp-submit-reference-contacts
 *
 * Applicant-facing endpoint: validates a request_token, accepts 1–3
 * reference contacts, creates per-reference rows + tokens, fires V19 to
 * each reference. No auth needed — token IS the auth.
 *
 * Body: {
 *   requestToken: string,
 *   references: [{
 *     name: string,
 *     email: string,
 *     company?: string,
 *     relationship?: string
 *   }]  // 1-3 entries
 * }
 *
 * Also supports GET-style preview via { requestToken } only — returns
 * the applicant's name + application_number so the public page can
 * confirm what they're being asked to do.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunEmail } from "../_shared/mailgun.ts";
import { buildV19ReferenceFeedbackRequest } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ContactInput {
  name?: string;
  email?: string;
  company?: string;
  relationship?: string;
  /** Approximate year the applicant began working with this reference.
   *  Optional — applicant may pick "I don't remember" instead. Stored
   *  for verification against what the reference says on the questionnaire. */
  startYear?: number | string | null;
  /** True when the applicant ticked "I don't remember the year". When true,
   *  startYear is ignored and the reference's questionnaire skips the
   *  year-verification block. */
  startYearUnknown?: boolean;
}

const YEAR_MIN = 1980;
const YEAR_MAX_FUTURE_OFFSET = 1; // accept current year + 1 for end-of-year edge

function normaliseStartYear(raw: unknown, unknown: boolean): {
  ok: true;
  year: number | null;
  yearUnknown: boolean;
} | { ok: false; error: string } {
  if (unknown) return { ok: true, year: null, yearUnknown: true };
  if (raw == null || raw === "") return { ok: true, year: null, yearUnknown: false };
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n)) return { ok: false, error: "startYear must be an integer" };
  const maxYear = new Date().getUTCFullYear() + YEAR_MAX_FUTURE_OFFSET;
  if (n < YEAR_MIN || n > maxYear) {
    return { ok: false, error: `startYear must be between ${YEAR_MIN} and ${maxYear}` };
  }
  return { ok: true, year: n, yearUnknown: false };
}

const REFERENCE_FEEDBACK_EXPIRY_DAYS = 21;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: {
    requestToken?: string;
    references?: ContactInput[];
    /** When true (or references absent), return token-validation info only. */
    validateOnly?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  if (!body.requestToken) {
    return json({ success: false, error: "requestToken_required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Validate token + load context.
  const { data: requestRow } = await supabase
    .from("cvp_application_reference_requests")
    .select("id, application_id, request_token_expires_at, status")
    .eq("request_token", body.requestToken)
    .maybeSingle();
  if (!requestRow) {
    return json({ success: false, error: "invalid_token" }, 404);
  }
  if (new Date(requestRow.request_token_expires_at).getTime() < Date.now()) {
    return json({ success: false, error: "token_expired" }, 410);
  }
  if (requestRow.status === "cancelled") {
    return json({ success: false, error: "request_cancelled" }, 410);
  }

  const { data: app } = await supabase
    .from("cvp_applications")
    .select("id, full_name, application_number, email")
    .eq("id", requestRow.application_id)
    .single();
  if (!app) return json({ success: false, error: "application_not_found" }, 404);

  // ---- Validation-only / preview path ----
  if (body.validateOnly || !body.references) {
    const { data: existing } = await supabase
      .from("cvp_application_references")
      .select("id, reference_name, reference_email, status, applicant_stated_start_year, applicant_year_unknown")
      .eq("request_id", requestRow.id);
    return json({
      success: true,
      data: {
        applicantName: app.full_name,
        applicationNumber: app.application_number,
        alreadyContactsSubmitted: requestRow.status === "contacts_received",
        existingReferences: existing ?? [],
      },
    });
  }

  // ---- Submit path ----
  if (requestRow.status === "contacts_received") {
    return json({ success: false, error: "contacts_already_submitted" }, 409);
  }

  // Validate inputs (incl. optional year-verification fields).
  const cleanedRefs: Array<{
    name: string;
    email: string;
    company: string | null;
    relationship: string | null;
    startYear: number | null;
    startYearUnknown: boolean;
  }> = [];
  for (const r of body.references ?? []) {
    const name = (r.name ?? "").trim();
    const email = (r.email ?? "").trim().toLowerCase();
    if (name.length < 2 || !/\S+@\S+\.\S+/.test(email)) continue;
    const yearResult = normaliseStartYear(r.startYear, r.startYearUnknown === true);
    if (!yearResult.ok) {
      return json(
        { success: false, error: "invalid_start_year", detail: yearResult.error },
        400,
      );
    }
    cleanedRefs.push({
      name,
      email,
      company: (r.company ?? "").trim() || null,
      relationship: (r.relationship ?? "").trim() || null,
      startYear: yearResult.year,
      startYearUnknown: yearResult.yearUnknown,
    });
  }
  if (cleanedRefs.length < 1 || cleanedRefs.length > 3) {
    return json(
      {
        success: false,
        error: "reference_count_invalid",
        detail: "Submit between 1 and 3 references with name + email.",
      },
      400,
    );
  }

  const feedbackExpiresAt = new Date(
    Date.now() + REFERENCE_FEEDBACK_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rowsToInsert = cleanedRefs.map((r) => ({
    request_id: requestRow.id,
    application_id: requestRow.application_id,
    reference_name: r.name,
    reference_email: r.email,
    reference_company: r.company,
    reference_relationship: r.relationship,
    feedback_token_expires_at: feedbackExpiresAt,
    status: "requested",
    applicant_stated_start_year: r.startYear,
    applicant_year_unknown: r.startYearUnknown,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("cvp_application_references")
    .insert(rowsToInsert)
    .select("id, reference_name, reference_email, feedback_token");
  if (insErr || !inserted) {
    return json(
      { success: false, error: "reference_create_failed", detail: insErr?.message },
      500,
    );
  }

  await supabase
    .from("cvp_application_reference_requests")
    .update({
      status: "contacts_received",
      contacts_submitted_at: new Date().toISOString(),
    })
    .eq("id", requestRow.id);

  // Fire V19 to each reference.
  const appUrl = Deno.env.get("APP_URL") ?? "https://join.cethos.com";
  const sendResults: { reference_email: string; sent: boolean }[] = [];

  for (const r of inserted) {
    const tpl = buildV19ReferenceFeedbackRequest({
      referenceName: r.reference_name,
      applicantName: app.full_name,
      applicantApplicationNumber: app.application_number,
      feedbackLinkUrl: `${appUrl}/reference-feedback/${r.feedback_token}`,
      expiryDays: REFERENCE_FEEDBACK_EXPIRY_DAYS,
    });
    const sendResult = await sendMailgunEmail({
      to: { email: r.reference_email, name: r.reference_name },
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: ["v19-reference-feedback-request", String(requestRow.application_id)],
      trackContext: {
        applicationId: String(requestRow.application_id),
        templateTag: "v19-reference-feedback-request",
      },
    });
    sendResults.push({
      reference_email: r.reference_email,
      sent: sendResult.sent,
    });
  }

  return json({
    success: true,
    data: {
      referencesCreated: inserted.length,
      sendResults,
    },
  });
});
