// cvp-extract-cd-capabilities
//
// Sweep worker. Finds applicant/agency replies to the vendor-info-request
// outreach (cvp-request-vendor-info) that haven't been processed yet, runs a
// schema-constrained Opus extraction over each, and MERGES the structured
// cognitive-debriefing capability data into cvp_cd_capabilities (one row per
// application, merged across replies). Then applies deterministic next-action
// rules and stamps the inbound reply as processed.
//
// DECOUPLED from cvp-inbound-email on purpose: that inbound function is
// prod-critical and currently ahead of the repo, so we never want a redeploy of
// it riding on this feature. This runs independently (cron or manual).
//
// Auth: x-cron-secret shared secret. verify_jwt=false.
//
// POST body:
//   { dryRun?: true }            -> extract + recommend, but write NOTHING and
//                                   don't stamp inbound rows. Returns the results.
//   { limit?: N }                -> cap replies processed this run (default 25).
//   { inboundEmailId?: "..." }   -> reprocess ONE specific reply (ignores the
//                                   processed marker). For re-runs after a fix.
//   { reextract?: true }         -> allow re-folding an already-verified row
//                                   (default false: verified rows are untouched).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireCronSecret } from "../_shared/require-cron-secret.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMPLATE_TAG = "vendor-info-request";
const MODEL = Deno.env.get("CVP_MODEL_QUALITY") ?? "claude-opus-4-7";
const DEFAULT_LIMIT = 25;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── The 5 questions the outreach asked (context for the extractor) ──
const QUESTION_CONTEXT = `The vendor was asked, in a cognitive-debriefing outreach email:
1. Rates — pricing model (per hour / per completed interview / per project / flat) and whether it varies by language, country or therapy area.
2. Participant recruitment — can they recruit interview participants themselves, or only interview once participants are provided? If they recruit: PATIENTS (clinical populations) vs GENERAL POPULATION, and which countries/languages.
3. Focus groups — experience moderating focus groups (group sessions) in addition to 1:1 cognitive interviews.
4. Interview languages — which languages they conduct interviews in.
5. Capacity & turnaround — interviews per week and typical debriefing-report turnaround. (Agencies: also interviewer bench size.)`;

const EXTRACT_SYSTEM_PROMPT = `You extract structured cognitive-debriefing (CD) capability data from a vendor's free-text email reply. The reply may be in any language, partial, or discuss only some questions. Extract ONLY what the vendor actually states — never invent. Use null for anything not addressed; put field names you couldn't determine into "unanswered".

${QUESTION_CONTEXT}

Return STRICT JSON only (no markdown, no prose) matching this shape:
{
  "rate_model": ["per_hour"|"per_interview"|"per_project"|"flat", ...],
  "rate_details": [{ "amount": number, "currency": "ISO-4217", "unit": "per_hour|per_interview|per_project|flat", "varies_by": "string or null" }],
  "recruits_participants": true|false|null,
  "recruits_patients": true|false|null,
  "recruits_general_population": true|false|null,
  "recruit_countries": ["ISO-3166 alpha-2 or country name", ...],
  "recruit_languages": ["ISO-639-1 or language name", ...],
  "focus_group_experience": true|false|null,
  "interview_languages": ["ISO-639-1 or language name", ...],
  "capacity_per_week": number|null,
  "report_turnaround_days": number|null,
  "interviewer_bench_count": number|null,
  "field_confidence": { "<field>": 0.0-1.0 },
  "overall_confidence": 0.0-1.0,
  "unanswered": ["<field names not addressed in the reply>"],
  "notes_for_staff": "one or two sentences: anything ambiguous, a request for a call, attachments referenced, or nuance worth a human eye"
}

Rules:
- If the vendor says they only interview once participants are supplied, set recruits_participants=false and leave patients/general_population null unless they clarify.
- "patients" means actual clinical/diagnosed populations; a general survey panel is general_population, not patients.
- Keep currencies/amounts exactly as stated. If a rate is a range, record the lower bound in amount and note the range in varies_by.
- Lower overall_confidence when the reply is vague, off-topic, or says "let's discuss on a call".`;

interface Extraction {
  rate_model: string[];
  rate_details: unknown[] | null;
  recruits_participants: boolean | null;
  recruits_patients: boolean | null;
  recruits_general_population: boolean | null;
  recruit_countries: string[];
  recruit_languages: string[];
  focus_group_experience: boolean | null;
  interview_languages: string[];
  capacity_per_week: number | null;
  report_turnaround_days: number | null;
  interviewer_bench_count: number | null;
  field_confidence: Record<string, number> | null;
  overall_confidence: number | null;
  unanswered: string[];
  notes_for_staff: string | null;
}

function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function asBoolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function asNumOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function extract(replyText: string): Promise<Extraction | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  const body = replyText.slice(0, 6000);
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Vendor reply:\n\n${body}` }],
      }),
    });
    if (!resp.ok) {
      console.error(`extract: Anthropic ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
      return null;
    }
    const data = (await resp.json()) as { content: { type: string; text?: string }[] };
    const text = (data.content ?? []).find((c) => c.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const p = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      rate_model: asArr(p.rate_model),
      rate_details: Array.isArray(p.rate_details) ? p.rate_details : null,
      recruits_participants: asBoolOrNull(p.recruits_participants),
      recruits_patients: asBoolOrNull(p.recruits_patients),
      recruits_general_population: asBoolOrNull(p.recruits_general_population),
      recruit_countries: asArr(p.recruit_countries),
      recruit_languages: asArr(p.recruit_languages),
      focus_group_experience: asBoolOrNull(p.focus_group_experience),
      interview_languages: asArr(p.interview_languages),
      capacity_per_week: asNumOrNull(p.capacity_per_week),
      report_turnaround_days: asNumOrNull(p.report_turnaround_days),
      interviewer_bench_count: asNumOrNull(p.interviewer_bench_count),
      field_confidence: (p.field_confidence ?? null) as Record<string, number> | null,
      overall_confidence: asNumOrNull(p.overall_confidence),
      unanswered: asArr(p.unanswered),
      notes_for_staff: typeof p.notes_for_staff === "string" ? p.notes_for_staff : null,
    };
  } catch (err) {
    console.error("extract exception:", err);
    return null;
  }
}

const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

// Merge a fresh extraction into the existing row. Verified fields (row-level:
// needs_review=false) are left untouched unless reextract=true. For unverified
// rows, the latest reply fills nulls and unions arrays; a non-null scalar in the
// new reply wins over an older non-null (vendors correct themselves in follow-ups).
function mergeRow(
  existing: Record<string, unknown> | null,
  x: Extraction,
  allowOverwriteVerified: boolean,
): Record<string, unknown> {
  const verified = existing ? existing.needs_review === false : false;
  const keepScalar = (col: string, next: unknown) => {
    if (verified && !allowOverwriteVerified) return existing?.[col] ?? null;
    if (next === null || next === undefined) return existing?.[col] ?? null;
    return next;
  };
  const mergeArr = (col: string, next: string[]) => {
    if (verified && !allowOverwriteVerified) return (existing?.[col] as string[]) ?? [];
    return uniq([...((existing?.[col] as string[]) ?? []), ...next]);
  };

  return {
    rate_model: mergeArr("rate_model", x.rate_model),
    rate_details: verified && !allowOverwriteVerified
      ? (existing?.rate_details ?? null)
      : (x.rate_details ?? existing?.rate_details ?? null),
    recruits_participants: keepScalar("recruits_participants", x.recruits_participants),
    recruits_patients: keepScalar("recruits_patients", x.recruits_patients),
    recruits_general_population: keepScalar("recruits_general_population", x.recruits_general_population),
    recruit_countries: mergeArr("recruit_countries", x.recruit_countries),
    recruit_languages: mergeArr("recruit_languages", x.recruit_languages),
    focus_group_experience: keepScalar("focus_group_experience", x.focus_group_experience),
    interview_languages: mergeArr("interview_languages", x.interview_languages),
    capacity_per_week: keepScalar("capacity_per_week", x.capacity_per_week),
    report_turnaround_days: keepScalar("report_turnaround_days", x.report_turnaround_days),
    interviewer_bench_count: keepScalar("interviewer_bench_count", x.interviewer_bench_count),
    field_confidence: x.field_confidence ?? existing?.field_confidence ?? null,
    overall_confidence: x.overall_confidence ?? existing?.overall_confidence ?? null,
    raw_answers: x,
    notes_for_staff: x.notes_for_staff ?? existing?.notes_for_staff ?? null,
    extracted_by_model: MODEL,
  };
}

// Which key fields are still missing after merge — drives request_clarification.
function computeUnanswered(m: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (!(m.rate_model as string[])?.length && !m.rate_details) missing.push("rates");
  if (m.recruits_participants == null) missing.push("recruitment");
  else if (
    m.recruits_participants === true &&
    m.recruits_patients == null &&
    m.recruits_general_population == null
  ) missing.push("patients_vs_general");
  if (m.focus_group_experience == null) missing.push("focus_groups");
  // NOTE: interview languages are already captured by the application form
  // (cog_native_languages / cog_additional_languages), so their absence in a
  // reply is NOT a gap — we don't ask for them and don't flag them missing.
  if (m.capacity_per_week == null) missing.push("capacity");
  return missing;
}

function recommend(m: Record<string, unknown>, missing: string[]): {
  action: string;
  tags: string[];
} {
  const tags: string[] = [];
  if (m.recruits_patients === true) tags.push("patient_recruiter");
  if (m.focus_group_experience === true) tags.push("focus_group");
  if (m.recruits_participants === false) tags.push("interview_only");
  if (m.recruits_general_population === true && m.recruits_patients !== true) {
    tags.push("general_pop_only");
  }
  const conf = (m.overall_confidence as number | null) ?? 1;
  let action: string;
  if (conf < 0.5) action = "staff_review";
  else if (missing.length > 0) action = "request_clarification";
  else if (m.recruits_patients === true) action = "prioritize_patient_recruiter";
  else action = "advance_to_cd_pool";
  return { action, tags };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const authed = await requireCronSecret(req);
  if (!authed.ok) return json({ success: false, error: authed.error }, authed.status);

  let body: { dryRun?: boolean; limit?: number; inboundEmailId?: string; reextract?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const dryRun = body.dryRun === true;
  const reextract = body.reextract === true;
  const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : DEFAULT_LIMIT;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ── 1. Candidate inbound replies ──
  let inboundQuery = supabase
    .from("cvp_inbound_emails")
    .select("id, from_email, subject, stripped_text, body_plain, matched_application_id")
    .not("matched_application_id", "is", null)
    .order("received_at", { ascending: true })
    .limit(limit);
  if (body.inboundEmailId) {
    inboundQuery = supabase
      .from("cvp_inbound_emails")
      .select("id, from_email, subject, stripped_text, body_plain, matched_application_id")
      .eq("id", body.inboundEmailId);
  } else {
    inboundQuery = inboundQuery.is("cd_enrichment_processed_at", null);
  }

  const { data: inbound, error: inErr } = await inboundQuery;
  if (inErr) return json({ success: false, error: inErr.message }, 500);

  const candidates = inbound ?? [];
  if (candidates.length === 0) {
    return json({ success: true, data: { scanned: 0, processed: 0, reason: "nothing_pending" } });
  }

  // Only replies whose application actually received the vendor-info-request outreach.
  const appIds = uniq(candidates.map((c) => String(c.matched_application_id)));
  const { data: outbounds } = await supabase
    .from("cvp_outbound_messages")
    .select("application_id")
    .eq("template_tag", TEMPLATE_TAG)
    .in("application_id", appIds);
  const enrichmentApps = new Set((outbounds ?? []).map((o) => String(o.application_id)));

  const results: Record<string, unknown>[] = [];
  let processed = 0;

  for (const c of candidates) {
    const applicationId = String(c.matched_application_id);
    if (!enrichmentApps.has(applicationId)) continue; // not an enrichment reply — leave untouched

    const replyText = String(c.stripped_text || c.body_plain || "").trim();
    const x = replyText ? await extract(replyText) : null;

    if (!x) {
      // AI unavailable / parse fail: never block. Stamp processed + flag for staff.
      if (!dryRun) {
        await supabase
          .from("cvp_cd_capabilities")
          .upsert(
            {
              application_id: applicationId,
              needs_review: true,
              notes_for_staff: "Automated extraction failed — please read the reply manually.",
              recommended_next_action: "staff_review",
              source_inbound_email_ids: [c.id],
              last_extracted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "application_id", ignoreDuplicates: false },
          );
        await supabase
          .from("cvp_inbound_emails")
          .update({ cd_enrichment_processed_at: new Date().toISOString() })
          .eq("id", c.id);
      }
      results.push({ inboundEmailId: c.id, applicationId, extracted: false, action: "staff_review" });
      processed++;
      continue;
    }

    // Load existing row for merge.
    const { data: existing } = await supabase
      .from("cvp_cd_capabilities")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle();

    const merged = mergeRow(existing ?? null, x, reextract);
    const missing = computeUnanswered(merged);
    const { action, tags } = recommend(merged, missing);

    const priorSources = (existing?.source_inbound_email_ids as string[]) ?? [];
    const row = {
      application_id: applicationId,
      ...merged,
      unanswered: missing,
      capability_tags: tags,
      recommended_next_action: action,
      source_inbound_email_ids: uniq([...priorSources, String(c.id)]),
      // Verified rows stay verified; everything else needs a human pass.
      needs_review: existing?.needs_review === false && !reextract ? false : true,
      last_extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!dryRun) {
      const { error: upErr } = await supabase
        .from("cvp_cd_capabilities")
        .upsert(row, { onConflict: "application_id", ignoreDuplicates: false });
      if (upErr) {
        console.error(`upsert failed for ${applicationId}:`, upErr.message);
        results.push({ inboundEmailId: c.id, applicationId, extracted: true, error: upErr.message });
        continue;
      }
      await supabase
        .from("cvp_inbound_emails")
        .update({ cd_enrichment_processed_at: new Date().toISOString() })
        .eq("id", c.id);
    }

    results.push({
      inboundEmailId: c.id,
      applicationId,
      extracted: true,
      action,
      tags,
      missing,
      overall_confidence: merged.overall_confidence,
    });
    processed++;
  }

  return json({
    success: true,
    dryRun,
    data: { scanned: candidates.length, processed, results },
  });
});
