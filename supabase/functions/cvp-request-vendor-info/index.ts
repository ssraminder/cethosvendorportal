// cvp-request-vendor-info
//
// Vendor-management data-enrichment outreach to cognitive-debriefing (CD)
// applicants — individuals and CD-offering agencies. Asks the questions the
// application form never captured: rate STRUCTURE, participant recruitment
// capability (patients vs general population), focus-group experience,
// interview languages, capacity + turnaround.
//
// Transport: Mailgun (via _shared/mailgun.ts) with trackContext, so replies
// thread into cvp_inbound_emails and surface in the EXISTING vendor-management
// triage inbox. do_not_contact is gated per-recipient by the transport.
//
// From:     CETHOS Vendor Management <recruiting@vendors.cethos.com>
//           (on the Mailgun-verified sending domain for SPF/DKIM alignment)
// Reply-To: vm@cethos.com  (the existing, working vm triage — no new route)
//
// Auth: x-cron-secret shared secret (see _shared/require-cron-secret.ts).
// verify_jwt=false (invoked manually by staff via curl, not a browser JWT).
//
// Modes (POST body):
//   { dryRun: true }                 -> default. Returns recipient counts +
//                                       preview list + one rendered sample.
//                                       Sends NOTHING.
//   { testEmail: "you@x.com" }       -> sends ONE sample (individual variant)
//                                       to that address only. For the post-route
//                                       smoke test. Not tracked, not gated.
//   { confirm: "SEND", cohort? }     -> live batch. cohort =
//                                       'individuals' | 'agencies' | 'all'
//                                       (default 'all'). Skips anyone already
//                                       sent this tag (idempotent re-runs).
//   optional: { limit: N }           -> cap the batch (staged sends).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { requireCronSecret } from "../_shared/require-cron-secret.ts";
import { sendMailgunEmail } from "../_shared/mailgun.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = { email: "recruiting@vendors.cethos.com", name: "CETHOS Vendor Management" };
const REPLY_TO = "vm@cethos.com";
const TEMPLATE_TAG = "vendor-info-request";
const TEST_EMAIL_DOMAIN = "@cethos-test.invalid";

// Brand tokens — match _shared/email-templates.ts / cvp-tms-migration-send.
const BRAND_TEAL = "#0891B2";
const BRAND_TEXT = "#111827";
const BRAND_MUTED = "#6B7280";
const BRAND_BORDER = "#E5E7EB";
const BRAND_BG = "#F9FAFB";
const LOGO_URL =
  "https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/png_logo_cethos_light_bg.png";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || "there";
}

const THERAPY_LABELS: Record<string, string> = {
  oncology: "oncology",
  neurology: "neurology",
  cardiology: "cardiology",
  rheumatology: "rheumatology",
  rare_disease: "rare disease",
  general: "general medicine",
  other: "other areas",
};

function therapyPhrase(areas: string[] | null | undefined): string {
  if (!areas || areas.length === 0) return "";
  const labels = areas
    .map((a) => THERAPY_LABELS[a] ?? a.replace(/_/g, " "))
    .filter(Boolean);
  const top = labels.slice(0, 3);
  if (top.length === 0) return "";
  if (top.length === 1) return top[0];
  if (top.length === 2) return `${top[0]} and ${top[1]}`;
  return `${top[0]}, ${top[1]}, and ${top[2]}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface RenderArgs {
  variant: "individual" | "agency";
  greetName: string;
  therapy: string; // humanized phrase, may be ""
  interviewVolume: string | null; // bracket label, individuals only
  agencyName: string | null; // agencies only
}

function renderEmail(a: RenderArgs): { subject: string; html: string; text: string } {
  const subject =
    a.variant === "agency"
      ? "A few questions about your cognitive debriefing capabilities — CETHOS"
      : "A few questions about your cognitive debriefing services — CETHOS";

  // Intro line, lightly personalized off what we already hold.
  const introContext =
    a.variant === "agency"
      ? `Thank you for ${a.agencyName ? esc(a.agencyName) + "'s" : "your"} application to CETHOS.`
      : `Thank you again for applying to the CETHOS cognitive debriefing panel.`;

  let noted = "";
  if (a.therapy) {
    noted =
      a.variant === "agency"
        ? ` We can see you cover ${esc(a.therapy)}.`
        : ` You noted experience in ${esc(a.therapy)}${
            a.interviewVolume ? ` (${esc(a.interviewVolume)} interviews)` : ""
          }.`;
  }

  const questions: { t: string; sub?: string[] }[] =
    a.variant === "agency"
      ? [
          {
            t: "Rates — your pricing model for cognitive debriefing (per interview / per hour / per project), and whether it varies by language or country.",
          },
          {
            t: "Participant recruitment — can your agency recruit interview participants directly?",
            sub: [
              "Patients (clinical populations), general population, or both?",
              "Which countries and languages can you recruit in?",
            ],
          },
          {
            t: "Focus groups — can you run/moderate focus groups in addition to one-on-one cognitive interviews?",
          },
          {
            t: "Interviewer bench — roughly how many trained CD interviewers you have, and which languages/countries they cover.",
          },
          {
            t: "Capacity & turnaround — concurrent interviews you can support and typical report turnaround.",
          },
        ]
      : [
          {
            t: "Rate basis — your application recorded a rate, but not the basis. Is that figure per hour, per completed interview, or per project? If you price differently for different work, just tell us how.",
          },
          {
            t: "Participant recruitment — can you source/recruit interview participants yourself, or do you conduct interviews only once participants are provided to you?",
            sub: [
              "If you can recruit: can you reach actual patients (clinical populations), or general-population respondents only?",
              "Which countries can you recruit in?",
            ],
          },
          {
            t: "Focus groups — do you have experience moderating focus groups (group sessions), in addition to one-on-one cognitive interviews?",
          },
          {
            t: "Capacity & turnaround — roughly how many interviews can you handle per week, and your typical turnaround for a debriefing report?",
          },
        ];

  const framing =
    a.variant === "agency"
      ? `As we plan upcoming cognitive debriefing work, we'd like to understand your capabilities in more detail — especially recruitment reach and interviewer bench, which our application form didn't capture.`
      : `We already have your languages, therapy areas, availability and rate from your application — so this is short. Just a few things the form doesn't cover, mostly around participant recruitment and interview formats.`;

  const olHtml = questions
    .map((q) => {
      const subHtml = q.sub
        ? `<ul style="padding-left:20px;margin:6px 0 0;">${q.sub
            .map((s) => `<li style="margin:2px 0;">${esc(s)}</li>`)
            .join("")}</ul>`
        : "";
      return `<li style="margin:0 0 12px;">${esc(q.t)}${subHtml}</li>`;
    })
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:${BRAND_BG};padding:24px 12px;">
<div style="max-width:640px;margin:0 auto;background:#fff;padding:24px 28px 32px;border:1px solid ${BRAND_BORDER};border-radius:8px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND_TEXT};line-height:1.55;">
  <div style="margin:0 0 20px;padding-bottom:16px;border-bottom:1px solid ${BRAND_BORDER};">
    <img src="${LOGO_URL}" alt="Cethos" width="120" height="auto" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:120px;">
  </div>

  <p>Hi ${esc(a.greetName)},</p>

  <p>${introContext}${noted}</p>

  <p>${framing}</p>

  <p>If you could reply to this email with the following, it helps us route the right work to you:</p>

  <ol style="padding-left:20px;margin:8px 0 16px;">${olHtml}</ol>

  <p>Anything else about your cognitive debriefing experience is welcome. Just reply here — it reaches our vendor-management team directly.</p>

  <p style="margin-top:24px;">Warm regards,<br/>
  <strong>Vendor Management</strong><br/>
  Cethos Solutions Inc.<br/>
  <a href="mailto:${REPLY_TO}" style="color:${BRAND_TEAL};">${REPLY_TO}</a></p>

  <p style="color:${BRAND_MUTED};font-size:12px;margin-top:32px;border-top:1px solid ${BRAND_BORDER};padding-top:16px;">
    You're receiving this because you applied to CETHOS as a cognitive debriefing provider.
    If you'd prefer not to receive messages like this, just reply and let us know.
  </p>
</div>
</body></html>`;

  const textLines: string[] = [
    `Hi ${a.greetName},`,
    "",
    `${introContext.replace(/&#39;/g, "'")}${
      noted ? noted.replace(/&#39;/g, "'") : ""
    }`,
    "",
    framing,
    "",
    "If you could reply to this email with the following, it helps us route the right work to you:",
    "",
  ];
  questions.forEach((q, i) => {
    textLines.push(`${i + 1}. ${q.t}`);
    if (q.sub) q.sub.forEach((s) => textLines.push(`   - ${s}`));
    textLines.push("");
  });
  textLines.push(
    "Anything else about your cognitive debriefing experience is welcome. Just reply here — it reaches our vendor-management team directly.",
    "",
    "Warm regards,",
    "Vendor Management",
    "Cethos Solutions Inc.",
    REPLY_TO,
  );

  return { subject, html, text: textLines.join("\n") };
}

interface Recipient {
  applicationId: string;
  email: string;
  greetName: string;
  variant: "individual" | "agency";
  therapy: string;
  interviewVolume: string | null;
  agencyName: string | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const authed = await requireCronSecret(req);
  if (!authed.ok) return json({ success: false, error: authed.error }, authed.status);

  let body: {
    dryRun?: boolean;
    testEmail?: string;
    confirm?: string;
    cohort?: "individuals" | "agencies" | "all";
    limit?: number;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ---- testEmail: one sample send, no tracking, no gate ----
  if (body.testEmail) {
    const sample = renderEmail({
      variant: "individual",
      greetName: "there",
      therapy: "oncology, neurology, and rare disease",
      interviewVolume: "51-200",
      agencyName: null,
    });
    const r = await sendMailgunEmail({
      to: { email: body.testEmail },
      from: FROM,
      replyTo: REPLY_TO,
      subject: `[TEST] ${sample.subject}`,
      html: sample.html,
      text: sample.text,
      tags: [TEMPLATE_TAG, "test"],
    });
    return json({ success: r.sent, data: { testEmail: body.testEmail, ...r } });
  }

  // ---- Build recipient list ----
  const cohort = body.cohort ?? "all";
  const recipients: Recipient[] = [];

  if (cohort === "individuals" || cohort === "all") {
    const { data, error } = await supabase
      .from("cvp_applications")
      .select("id, email, full_name, cog_therapy_areas, cog_interviews_conducted, status, do_not_contact")
      .eq("role_type", "cognitive_debriefing")
      .neq("status", "archived");
    if (error) return json({ success: false, error: error.message }, 500);
    for (const row of data ?? []) {
      const email = String(row.email ?? "").trim();
      if (!email || email.endsWith(TEST_EMAIL_DOMAIN)) continue;
      if (row.do_not_contact) continue;
      recipients.push({
        applicationId: row.id as string,
        email,
        greetName: firstName(row.full_name as string | null),
        variant: "individual",
        therapy: therapyPhrase(row.cog_therapy_areas as string[] | null),
        interviewVolume: (row.cog_interviews_conducted as string | null) || null,
        agencyName: null,
      });
    }
  }

  if (cohort === "agencies" || cohort === "all") {
    const { data, error } = await supabase
      .from("cvp_applications")
      .select("id, email, agency_business_name, agency_primary_contact_name, cog_therapy_areas, agency_services_offered, status, do_not_contact")
      .eq("role_type", "agency")
      .contains("agency_services_offered", ["cognitive_debriefing"])
      .not("status", "in", "(archived,rejected)");
    if (error) return json({ success: false, error: error.message }, 500);
    for (const row of data ?? []) {
      const email = String(row.email ?? "").trim();
      if (!email || email.endsWith(TEST_EMAIL_DOMAIN)) continue;
      if (row.do_not_contact) continue;
      recipients.push({
        applicationId: row.id as string,
        email,
        greetName: firstName(row.agency_primary_contact_name as string | null),
        variant: "agency",
        therapy: therapyPhrase(row.cog_therapy_areas as string[] | null),
        interviewVolume: null,
        agencyName: (row.agency_business_name as string | null) || null,
      });
    }
  }

  // ---- Idempotency: drop anyone already sent this tag ----
  const appIds = recipients.map((r) => r.applicationId);
  const alreadySent = new Set<string>();
  if (appIds.length > 0) {
    const { data: sentRows } = await supabase
      .from("cvp_outbound_messages")
      .select("application_id")
      .eq("template_tag", TEMPLATE_TAG)
      .in("application_id", appIds);
    for (const s of sentRows ?? []) {
      if (s.application_id) alreadySent.add(s.application_id as string);
    }
  }
  let pending = recipients.filter((r) => !alreadySent.has(r.applicationId));
  if (typeof body.limit === "number" && body.limit > 0) {
    pending = pending.slice(0, body.limit);
  }

  const counts = {
    total_matched: recipients.length,
    individuals: recipients.filter((r) => r.variant === "individual").length,
    agencies: recipients.filter((r) => r.variant === "agency").length,
    already_sent: alreadySent.size,
    to_send: pending.length,
  };

  // ---- dryRun (default): preview only, no send ----
  const isLive = body.confirm === "SEND";
  if (!isLive) {
    const sample = pending[0]
      ? renderEmail({
          variant: pending[0].variant,
          greetName: pending[0].greetName,
          therapy: pending[0].therapy,
          interviewVolume: pending[0].interviewVolume,
          agencyName: pending[0].agencyName,
        })
      : null;
    return json({
      success: true,
      dryRun: true,
      data: {
        counts,
        preview: pending.slice(0, 60).map((r) => ({
          email: r.email,
          name: r.greetName,
          variant: r.variant,
        })),
        sample: sample
          ? { subject: sample.subject, html: sample.html, text: sample.text }
          : null,
        note: "No emails sent. POST { confirm: 'SEND' } to dispatch.",
      },
    });
  }

  // ---- Live send ----
  const results: { email: string; sent: boolean; suppressed?: boolean; reason?: string }[] = [];
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  for (const r of pending) {
    const tpl = renderEmail({
      variant: r.variant,
      greetName: r.greetName,
      therapy: r.therapy,
      interviewVolume: r.interviewVolume,
      agencyName: r.agencyName,
    });
    const res = await sendMailgunEmail({
      to: { email: r.email, name: r.greetName },
      from: FROM,
      replyTo: REPLY_TO,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [TEMPLATE_TAG, r.variant],
      respectDoNotContactFor: r.email,
      trackContext: {
        applicationId: r.applicationId,
        templateTag: TEMPLATE_TAG,
      },
    });
    if (res.sent) sent++;
    else if (res.suppressed) suppressed++;
    else failed++;
    results.push({
      email: r.email,
      sent: res.sent,
      suppressed: res.suppressed,
      reason: res.reason,
    });
  }

  return json({
    success: true,
    dryRun: false,
    data: { counts, dispatched: sent, suppressed, failed, results },
  });
});
