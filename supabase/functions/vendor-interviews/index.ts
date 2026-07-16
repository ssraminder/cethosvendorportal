// vendor-interviews — moderator console backend for the vendor portal.
//
// Lets a logged-in vendor who moderates research-panel interviews (linked via
// rp_interviewers.vendor_id) see their sessions, mark a session complete
// (attended / no-show), and rate each participant. Completion is delegated to
// the shared rp_complete_session RPC (same code path as staff completion), which
// creates the pending payments; that in turn lets the interview-schedule cron
// send participants the "confirm payment + feedback" email.
//
// v2 (2026-07-08, interview lifecycle Phase 6 — blinded respondent contact):
//   - "message" action: the moderator writes to some or all booked participants
//     of their session BEFORE it ends. Each recipient gets a localized email
//     relayed via Brevo from participants@cethosresearch.com with reply-to the
//     same staff mailbox — the moderator never sees participant contact info,
//     the participant never sees the moderator's address, and replies land with
//     Cethos staff who forward them. Every recipient is one row in
//     rp_moderator_messages (audit + idempotency), one compose = one batch_id.
//     Staff get a copy of every relayed batch (rp_config staff_notify_emails).
//   - "list" now returns the session meeting link (moderators previously only
//     got it in a one-shot email), canMessage, and the sent-message history.
//
// v3 (2026-07-09, Phase 6b — interview files, "translated documents only"):
//   - "list" also returns the interview's shared files (staff uploads to the
//     private interview-shares bucket via the admin "Send files" modal —
//     rp_interview_shares) with fresh 7-day signed URLs, so the moderator can
//     always re-download the translated documents from the portal after the
//     emailed links expire. Blinded: file names + dates only, never the
//     share's recipients or message.
//   - "message" accepts attachPaths (validated against the study's shares —
//     moderators cannot upload or link arbitrary paths, only re-share what
//     staff attached to this interview). Each participant email gets fresh
//     7-day signed links; the audit rows record file_names/file_paths.
//
// Auth: vendor_sessions bearer token (header) OR session_token in the body.
// All rp_* access is via service_role — the sanctioned cross-system boundary.
//
// POST { action: "list" | "complete" | "message", session_token?, ... }

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Max message batches one moderator can send per slot per 24h (abuse guard).
const MAX_BATCHES_PER_SLOT_PER_DAY = 20;
// Availability proposals: per-call and per-study pending caps (abuse guard).
const MAX_PROPOSALS_PER_CALL = 10;
const MAX_PENDING_PROPOSALS_PER_STUDY = 20;
// Moderators propose times at least this far out — staff still need to review
// and participants need runway to book.
const MIN_PROPOSAL_LEAD_MS = 24 * 3600 * 1000;

// ─────────── timezone helpers (ported verbatim from interview-admin) ───────────
function isValidTz(tz: unknown): boolean {
  if (!tz || typeof tz !== "string") return false;
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}
// Offset (minutes) of `tz` at a given instant, via the two-format trick.
function tzOffsetMinutes(date: Date, tz: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date).reduce((a: Record<string, string>, x) => { a[x.type] = x.value; return a; }, {});
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), p.hour === "24" ? 0 : Number(p.hour), Number(p.minute), Number(p.second));
  return (asUTC - date.getTime()) / 60000;
}
// Wall-clock "YYYY-MM-DD" + "HH:MM" entered in `tz` -> the UTC instant.
function wallToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = tzOffsetMinutes(new Date(guess), tz);
  return new Date(guess - off * 60000);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({} as any));
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || String(body.session_token || "");
    if (!token) return json({ success: false, error: "Authentication required" }, 401);

    const { data: session } = await sb
      .from("vendor_sessions").select("vendor_id").eq("session_token", token)
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!session) return json({ success: false, error: "Invalid or expired session" }, 401);
    const vendorId = session.vendor_id as string;
    await loadMonitorBcc(sb);

    // This vendor's interviewer record(s).
    const { data: ivs } = await sb.from("rp_interviewers").select("id,name").eq("vendor_id", vendorId);
    const interviewers = ivs || [];
    const interviewerIds = interviewers.map((i: any) => i.id);
    if (!interviewerIds.length) return json({ success: true, sessions: [], availabilityRequests: [] });

    const action = String(body.action || "list");
    if (action === "list") return await listSessions(sb, interviewerIds, vendorId);
    if (action === "complete") return await completeSession(sb, interviewerIds, vendorId, body);
    if (action === "message") return await sendModeratorMessage(sb, interviewers, vendorId, body);
    if (action === "propose_times") return await proposeTimes(sb, interviewers, vendorId, body);
    if (action === "withdraw_proposal") return await withdrawProposal(sb, interviewerIds, body);
    if (action === "decline_offer" || action === "decline_availability") return await declineOffer(sb, interviewers, body);
    return json({ success: false, error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("vendor-interviews error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

// Shared files of a set of studies (staff uploads from the admin "Send files"
// modal). Returns per-study file lists with FRESH 7-day signed URLs. Blinded:
// no recipient emails, no share message — file name + sent date only.
async function studyFiles(sb: any, studyIds: string[]): Promise<Map<string, any[]>> {
  const filesByStudy = new Map<string, any[]>();
  if (!studyIds.length) return filesByStudy;
  const { data: shares } = await sb
    .from("rp_interview_shares")
    .select("study_id,file_names,file_paths,sent_at")
    .in("study_id", studyIds)
    .order("sent_at", { ascending: false })
    .limit(50);
  const entries: { studyId: string; name: string; path: string; sentAt: string }[] = [];
  const seenPaths = new Set<string>();
  for (const sh of shares || []) {
    const names: string[] = Array.isArray(sh.file_names) ? sh.file_names : [];
    const paths: string[] = Array.isArray(sh.file_paths) ? sh.file_paths : [];
    for (let i = 0; i < paths.length; i++) {
      if (seenPaths.has(paths[i])) continue;
      seenPaths.add(paths[i]);
      entries.push({ studyId: sh.study_id, name: names[i] || paths[i].split("/").pop() || "file", path: paths[i], sentAt: sh.sent_at });
    }
  }
  // Cap the signing work; newest files first.
  const capped = entries.slice(0, 30);
  const signed = await Promise.all(capped.map(async (e) => {
    const { data } = await sb.storage.from("interview-shares").createSignedUrl(e.path, 604800);
    return { ...e, url: data?.signedUrl || null };
  }));
  for (const f of signed) {
    if (!f.url) continue;
    const arr = filesByStudy.get(f.studyId) || [];
    arr.push({ name: f.name, path: f.path, url: f.url, sentAt: f.sentAt });
    filesByStudy.set(f.studyId, arr);
  }
  return filesByStudy;
}

// Open availability requests for this moderator: studies where staff asked for
// timings (and the moderator hasn't declined), with the moderator's own
// proposals + review outcomes. A request stays visible after proposals are
// approved so the moderator can add more times if staff re-request.
async function availabilityRequestsFor(sb: any, interviewerIds: string[], vendorId?: string) {
  // Live offers (offered = not yet responded, accepted = accepted + proposing)
  // to any of this vendor's interviewer identities. Tolerates the offers table
  // not existing yet (pre-migration deploy).
  const { data: offers } = await sb.from("rp_study_moderator_offers")
    .select("id,study_id,interviewer_id,status,offered_at,expires_at,responded_at,proposed_rate,proposed_rate_currency")
    .in("interviewer_id", interviewerIds)
    .in("status", ["offered", "accepted"])
    .order("offered_at", { ascending: false });
  const offerList = offers || [];
  if (!offerList.length) return [];
  const studyIds = Array.from(new Set(offerList.map((o: any) => o.study_id)));
  const [{ data: studies }, { data: props }] = await Promise.all([
    sb.from("rp_studies")
      .select("id,code,duration_minutes,target_locale,meeting_platform,interview_type,availability_request_note,max_respondents")
      .in("id", studyIds).eq("active", true),
    sb.from("rp_moderator_slot_proposals")
      .select("id,study_id,interviewer_id,start_at,end_at,timezone,note,status,review_note,created_at")
      .in("study_id", studyIds).in("interviewer_id", interviewerIds).order("start_at"),
  ]);
  // The vendor's saved cognitive-debriefing rate — used to PREFILL the rate
  // field on offers they haven't priced yet, so returning moderators don't
  // retype it. Prefer the moderator-set interview rate, else any active CD
  // hourly rate on file.
  let profileRate: number | null = null;
  let profileRateCurrency: string | null = null;
  if (vendorId) {
    const { data: pr } = await sb.from("vendor_rates")
      .select("rate,currency,notes,updated_at")
      .eq("vendor_id", vendorId).eq("service_id", CD_SERVICE_ID)
      .eq("calculation_unit", "per_hour").eq("is_active", true)
      .order("updated_at", { ascending: false });
    const rows = pr || [];
    const pick = rows.find((r: any) => r.notes === "Moderator interview rate (set when proposing interview times)") || rows[0];
    if (pick && pick.rate != null) { profileRate = Number(pick.rate); profileRateCurrency = pick.currency || null; }
  }
  const studyById = new Map<string, any>((studies || []).map((s: any) => [s.id, s]));
  const propsByStudyIv = new Map<string, any[]>();
  for (const p of props || []) {
    const k = `${p.study_id}|${p.interviewer_id}`;
    const arr = propsByStudyIv.get(k) || [];
    arr.push({ id: p.id, startAt: p.start_at, endAt: p.end_at, timezone: p.timezone, note: p.note, status: p.status, reviewNote: p.review_note, createdAt: p.created_at });
    propsByStudyIv.set(k, arr);
  }
  const out: any[] = [];
  for (const o of offerList) {
    const s = studyById.get(o.study_id);
    if (!s) continue; // study inactive
    out.push({
      studyId: s.id, studyCode: s.code, durationMinutes: s.duration_minutes,
      targetLocale: s.target_locale, meetingPlatform: s.meeting_platform, interviewType: s.interview_type,
      maxRespondents: s.max_respondents,
      requestNote: s.availability_request_note,
      offerStatus: o.status, offeredAt: o.offered_at, expiresAt: o.expires_at,
      requestedAt: o.offered_at,
      proposedRate: o.proposed_rate != null ? Number(o.proposed_rate) : profileRate,
      proposedRateCurrency: o.proposed_rate_currency || profileRateCurrency,
      proposals: propsByStudyIv.get(`${o.study_id}|${o.interviewer_id}`) || [],
    });
  }
  return out;
}

async function listSessions(sb: any, interviewerIds: string[], vendorId: string) {
  // Availability requests are independent of slots — a fresh request has ZERO
  // slots by definition, so they're fetched before the slot early-return.
  const availabilityRequests = await availabilityRequestsFor(sb, interviewerIds, vendorId);
  const { data: slots } = await sb
    .from("rp_availability_slots")
    .select("id,study_id,start_at,end_at,status")
    .in("interviewer_id", interviewerIds)
    .neq("status", "cancelled")
    .order("start_at", { ascending: false });
  const slotList = slots || [];
  if (!slotList.length) return json({ success: true, sessions: [], availabilityRequests });

  const slotIds = slotList.map((s: any) => s.id);
  const studyIds = Array.from(new Set(slotList.map((s: any) => s.study_id).filter(Boolean))) as string[];
  const [bkRes, studyRes, msgRes, filesByStudy] = await Promise.all([
    sb.from("rp_bookings").select("id,slot_id,invitation_id,status,meeting_link,attendance_confirmed_at,attendance_confirm_sent_at,attendance_released_at").in("slot_id", slotIds).in("status", ["confirmed", "completed", "no_show"]),
    studyIds.length ? sb.from("rp_studies").select("id,code,duration_minutes").in("id", studyIds) : Promise.resolve({ data: [] }),
    // Sent-message history (one entry per batch). Tolerates the table not
    // existing yet (pre-migration deploy) — history just comes back empty.
    sb.from("rp_moderator_messages").select("batch_id,slot_id,body,created_at,relayed_at").in("slot_id", slotIds).order("created_at", { ascending: false }).limit(400),
    studyFiles(sb, studyIds),
  ]);
  const bookings = bkRes.data || [];
  const studyMap = new Map((studyRes.data || []).map((s: any) => [s.id, s]));

  // Group message rows (one per recipient) into batches for display.
  const msgBatches = new Map<string, { batchId: string; slotId: string; body: string; createdAt: string; recipients: number; relayed: number }>();
  for (const m of msgRes?.data || []) {
    const cur = msgBatches.get(m.batch_id) || { batchId: m.batch_id, slotId: m.slot_id, body: m.body, createdAt: m.created_at, recipients: 0, relayed: 0 };
    cur.recipients++;
    if (m.relayed_at) cur.relayed++;
    msgBatches.set(m.batch_id, cur);
  }
  const msgsBySlot = new Map<string, any[]>();
  for (const b of msgBatches.values()) {
    const arr = msgsBySlot.get(b.slotId) || [];
    arr.push({ batchId: b.batchId, body: b.body, createdAt: b.createdAt, recipients: b.recipients, relayed: b.relayed });
    msgsBySlot.set(b.slotId, arr);
  }

  const invIds = Array.from(new Set(bookings.map((b: any) => b.invitation_id)));
  const bookingIds = bookings.map((b: any) => b.id);
  const [invRes, fbRes] = await Promise.all([
    invIds.length ? sb.from("rp_invitations").select("id,submission_id").in("id", invIds) : Promise.resolve({ data: [] }),
    bookingIds.length ? sb.from("rp_moderator_feedback").select("booking_id,rating,attended,comments").in("booking_id", bookingIds) : Promise.resolve({ data: [] }),
  ]);
  const invMap = new Map((invRes.data || []).map((i: any) => [i.id, i]));
  const subIds = Array.from(new Set((invRes.data || []).map((i: any) => i.submission_id).filter(Boolean)));
  const { data: subs } = subIds.length ? await sb.from("research_panel_signups").select("id,full_name").in("id", subIds) : { data: [] };
  const subMap = new Map((subs || []).map((s: any) => [s.id, s]));
  const fbMap = new Map((fbRes.data || []).map((f: any) => [f.booking_id, f]));

  const bySlot = new Map<string, any[]>();
  const linkBySlot = new Map<string, string>();
  for (const b of bookings) {
    const inv: any = invMap.get(b.invitation_id);
    const sub: any = inv ? subMap.get(inv.submission_id) : null;
    const fb: any = fbMap.get(b.id);
    if (b.meeting_link && !linkBySlot.has(b.slot_id)) linkBySlot.set(b.slot_id, b.meeting_link);
    const arr = bySlot.get(b.slot_id) || [];
    arr.push({
      invitationId: b.invitation_id, bookingId: b.id, status: b.status,
      name: sub?.full_name || "Participant",
      // Attendance re-confirmation (email/SMS/phone) so the moderator can see who
      // has actually confirmed they'll attend vs. who is still pending / released.
      attendanceConfirmedAt: b.attendance_confirmed_at ?? null,
      attendanceConfirmSentAt: b.attendance_confirm_sent_at ?? null,
      attendanceReleasedAt: b.attendance_released_at ?? null,
      rating: fb?.rating ?? null, attended: fb?.attended ?? null, comments: fb?.comments ?? null,
    });
    bySlot.set(b.slot_id, arr);
  }

  const nowMs = Date.now();
  const sessions = slotList.map((s: any) => {
    const participants = bySlot.get(s.id) || [];
    const confirmed = participants.filter((p: any) => p.status === "confirmed").length;
    const st: any = studyMap.get(s.study_id);
    return {
      slotId: s.id, studyCode: st?.code || "Session", durationMinutes: st?.duration_minutes ?? null,
      startAt: s.start_at, endAt: s.end_at,
      meetingLink: linkBySlot.get(s.id) || null,
      files: filesByStudy.get(s.study_id) || [],
      isCompleted: confirmed === 0 && participants.length > 0,
      canComplete: confirmed > 0,
      // Messaging is for the run-up to the session (and during it): confirmed
      // participants exist and the session hasn't ended yet.
      canMessage: confirmed > 0 && new Date(s.end_at || s.start_at).getTime() > nowMs,
      messages: msgsBySlot.get(s.id) || [],
      participants,
    };
  }).filter((s: any) => s.participants.length > 0);

  return json({ success: true, sessions, availabilityRequests });
}

// ─────────────────────── moderator availability proposals ───────────────────────

// Staff notification for proposal activity — reuses the relay sender + the
// rp_config staff_notify_emails list (same oversight channel as message copies).
// Human study reference for emails: code + order number (if different) + language,
// so staff/moderators can identify exactly which interview an email is about.
function studyRefLabel(study: any): string {
  const parts = [String(study.code || "study")];
  if (study.order_number && study.order_number !== study.code) parts.push(`order ${study.order_number}`);
  if (study.target_locale) parts.push(String(study.target_locale).toUpperCase());
  return parts.join(" · ");
}

async function notifyStaff(sb: any, subject: string, html: string, tag: string) {
  try {
    const { data: cfg } = await sb.from("rp_config").select("value").eq("key", "staff_notify_emails").maybeSingle();
    const staff: string[] = Array.isArray(cfg?.value) ? cfg.value : [];
    for (const to of staff) await sendRelayEmail({ to, subject, html, tags: [tag] });
  } catch (e) {
    console.error("[vendor-interviews] staff notify failed", e instanceof Error ? e.message : e);
  }
}
const ADMIN_INTERVIEWS_URL = `${Deno.env.get("ADMIN_PORTAL_URL") || "https://portal.cethos.com"}/admin/research-panel/interviews`;

// The moderator proposes session timings for a study staff offered them.
// Times arrive as wall-clock date+time in the moderator's chosen IANA timezone;
// each proposal spans study.duration_minutes. Guards: lead time, overlap with
// their own pending/approved proposals AND their existing sessions (any study),
// per-call + per-study caps.
const CD_SERVICE_ID = "568599b9-e6b4-4be6-9fa9-805df929dcd2"; // cognitive_debriefing

async function proposeTimes(sb: any, interviewers: any[], vendorId: string, body: any) {
  const studyId = String(body.studyId || "");
  const tz = String(body.timezone || "");
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const slots: any[] = Array.isArray(body.slots) ? body.slots : [];
  if (!studyId || !slots.length) return json({ success: false, error: "studyId and slots required" }, 400);
  if (slots.length > MAX_PROPOSALS_PER_CALL) return json({ success: false, error: `Max ${MAX_PROPOSALS_PER_CALL} times per submission` }, 400);
  if (!isValidTz(tz)) return json({ success: false, error: "Invalid timezone" }, 400);

  // Hourly rate is REQUIRED — it's the moderator's rate for cognitive-debriefing
  // interviews, persisted to their vendor profile below.
  const n = Number(body.hourlyRate);
  if (body.hourlyRate === undefined || body.hourlyRate === null || body.hourlyRate === "" || !Number.isFinite(n) || n <= 0 || n > 1_000_000) {
    return json({ success: false, error: "Enter your hourly rate" }, 400);
  }
  const proposedRate = Math.round(n * 100) / 100;
  const proposedRateCurrency = String(body.rateCurrency || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(proposedRateCurrency)) return json({ success: false, error: "Choose a currency for your rate" }, 400);

  const interviewerIds = interviewers.map((i: any) => i.id);
  const { data: study } = await sb.from("rp_studies")
    .select("id,code,duration_minutes,active,order_number,target_locale,interview_type,max_respondents").eq("id", studyId).maybeSingle();
  if (!study) return json({ success: false, error: "Study not found" }, 404);
  if (!study.active) return json({ success: false, error: "This study is no longer active" }, 409);
  // Accepting = you must have a LIVE offer for this study. Proposing times is
  // how you accept: the first proposal flips the offer offered→accepted.
  const { data: offer } = await sb.from("rp_study_moderator_offers")
    .select("id,interviewer_id,status").eq("study_id", studyId).in("interviewer_id", interviewerIds)
    .in("status", ["offered", "accepted"]).maybeSingle();
  if (!offer) return json({ success: false, error: "You don't have an open offer for this study" }, 403);
  const ivId = offer.interviewer_id as string;
  const dur = Number(study.duration_minutes) || 45;

  // Validate + convert to UTC instants.
  const minStart = Date.now() + MIN_PROPOSAL_LEAD_MS;
  const candidates: { start: Date; end: Date; raw: any }[] = [];
  for (const s of slots) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.date)) || !/^\d{2}:\d{2}$/.test(String(s.time))) {
      return json({ success: false, error: "Bad date/time format (expected YYYY-MM-DD and HH:MM)" }, 400);
    }
    const start = wallToUtc(String(s.date), String(s.time), tz);
    if (start.getTime() < minStart) return json({ success: false, error: `Times must be at least 24 hours from now (${s.date} ${s.time})` }, 400);
    candidates.push({ start, end: new Date(start.getTime() + dur * 60000), raw: s });
  }
  // The submitted set must not overlap itself.
  const sorted = [...candidates].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) return json({ success: false, error: "Submitted times overlap each other" }, 400);
  }

  const { count: pendingCount } = await sb.from("rp_moderator_slot_proposals")
    .select("id", { count: "exact", head: true })
    .eq("study_id", studyId).eq("interviewer_id", ivId).eq("status", "pending");
  if ((pendingCount || 0) + candidates.length > MAX_PENDING_PROPOSALS_PER_STUDY) {
    return json({ success: false, error: `Too many pending proposals for this study (max ${MAX_PENDING_PROPOSALS_PER_STUDY})` }, 400);
  }

  // One-to-one interviews need one session per participant — the moderator must
  // offer at least max_respondents session times (existing live proposals count
  // toward it). Focus groups are one shared session, so this doesn't apply.
  // Only block while there's still room in THIS submission to add more, so a
  // target above the per-call cap can still be reached across submissions.
  if (study.interview_type !== "focus_group" && study.max_respondents != null) {
    const need = Number(study.max_respondents);
    const total = (pendingCount || 0) + candidates.length;
    if (total < need && candidates.length < MAX_PROPOSALS_PER_CALL) {
      return json({ success: false, error: `This is a 1-to-1 study for ${need} participants — please offer at least ${need} session times (one per participant). You'd have ${total}.` }, 400);
    }
  }

  // No double-booking: check against their own live proposals for this study
  // AND their real sessions across ALL studies.
  const [{ data: exProps }, { data: exSlots }] = await Promise.all([
    sb.from("rp_moderator_slot_proposals").select("start_at,end_at")
      .eq("study_id", studyId).eq("interviewer_id", ivId).in("status", ["pending", "approved"]),
    sb.from("rp_availability_slots").select("start_at,end_at")
      .in("interviewer_id", interviewerIds).neq("status", "cancelled"),
  ]);
  const busy = [...(exProps || []), ...(exSlots || [])].map((r: any) => ({ start: new Date(r.start_at), end: new Date(r.end_at) }));
  for (const c of candidates) {
    if (busy.some((b) => b.start < c.end && b.end > c.start)) {
      return json({ success: false, error: "A proposed time overlaps one of your existing sessions or proposals" }, 409);
    }
  }

  const rows = candidates.map((c) => ({
    study_id: studyId, interviewer_id: ivId,
    start_at: c.start.toISOString(), end_at: c.end.toISOString(),
    timezone: tz, note, status: "pending",
  }));
  const { data: inserted, error } = await sb.from("rp_moderator_slot_proposals").insert(rows).select("id");
  if (error) {
    // Unique pending index = double-submit backstop.
    if (/uniq_rp_pending_proposal|duplicate/i.test(String(error.message || ""))) {
      return json({ success: false, error: "You already proposed one of these times" }, 409);
    }
    console.error("[vendor-interviews] propose insert", error.message);
    return json({ success: false, error: "Failed to save proposals" }, 500);
  }
  // Proposing = applying for the offer: flip offered→accepted (first time only).
  // The rate is recorded on the offer AND on the vendor's profile (below).
  const ratePatch = { proposed_rate: proposedRate, proposed_rate_currency: proposedRateCurrency };
  let justAccepted = false;
  if (offer.status === "offered") {
    const { error: aErr } = await sb.from("rp_study_moderator_offers")
      .update({ status: "accepted", responded_at: new Date().toISOString(), ...ratePatch })
      .eq("id", offer.id).eq("status", "offered");
    if (!aErr) justAccepted = true;
  } else {
    await sb.from("rp_study_moderator_offers").update(ratePatch).eq("id", offer.id);
  }

  // Persist the rate to the vendor's profile as their cognitive-debriefing
  // interview rate (per-hour). Idempotent: update the moderator-set CD rate row
  // if one exists, else insert. Also strengthens their CD-qualified/"CD-rated"
  // signal in staff assignment. Best-effort — never fails the submission.
  // `notes` marks the moderator-set CD interview rate so we update it in place
  // rather than piling up rows. source/added_by must satisfy the table's CHECK
  // constraints (self_reported / vendor).
  const MOD_RATE_NOTE = "Moderator interview rate (set when proposing interview times)";
  try {
    const { data: existing } = await sb.from("vendor_rates")
      .select("id").eq("vendor_id", vendorId).eq("service_id", CD_SERVICE_ID)
      .eq("notes", MOD_RATE_NOTE).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.id) {
      const { error: uErr } = await sb.from("vendor_rates").update({
        rate: proposedRate, currency: proposedRateCurrency, calculation_unit: "per_hour",
        is_active: true, updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      if (uErr) throw uErr;
    } else {
      const { error: iErr } = await sb.from("vendor_rates").insert({
        vendor_id: vendorId, service_id: CD_SERVICE_ID, calculation_unit: "per_hour",
        rate: proposedRate, currency: proposedRateCurrency, source: "self_reported",
        is_active: true, added_by: "vendor", notes: MOD_RATE_NOTE,
      });
      if (iErr) throw iErr;
    }
  } catch (e) {
    console.error("[vendor-interviews] CD rate upsert failed", e instanceof Error ? e.message : e);
  }
  const moderatorName = interviewers.find((i: any) => i.id === ivId)?.name || "A moderator";
  await notifyStaff(sb,
    `Moderator ${justAccepted ? "accepted + proposed" : "proposed"} ${rows.length} time(s) — ${studyRefLabel(study)}`,
    `<p>${escapeHtml(moderatorName)} ${justAccepted ? "accepted the offer and proposed" : "proposed"} ${rows.length} session time(s) for <strong>${escapeHtml(studyRefLabel(study))}</strong> via the vendor portal${note ? ` with a note: “${escapeHtml(note)}”` : ""}.</p>`
      + (proposedRate != null ? `<p><strong>Hourly rate ask:</strong> ${proposedRate} ${escapeHtml(proposedRateCurrency || "")}</p>` : "")
      + `<ul>${candidates.map((c) => `<li>${escapeHtml(c.raw.date)} ${escapeHtml(c.raw.time)} (${escapeHtml(tz)})</li>`).join("")}</ul>`
      + `<p><a href="${escapeHtml(ADMIN_INTERVIEWS_URL)}">Review responses and assign in the admin portal</a>.</p>`,
    "moderator-offer-proposed");
  return json({ success: true, proposed: (inserted || []).length, accepted: justAccepted });
}

async function withdrawProposal(sb: any, interviewerIds: string[], body: any) {
  const proposalId = String(body.proposalId || "");
  if (!proposalId) return json({ success: false, error: "proposalId required" }, 400);
  const { data: p } = await sb.from("rp_moderator_slot_proposals")
    .select("id,interviewer_id,status").eq("id", proposalId).maybeSingle();
  if (!p || !interviewerIds.includes(p.interviewer_id)) return json({ success: false, error: "Not your proposal" }, 403);
  if (p.status !== "pending") return json({ success: false, error: "Only pending proposals can be withdrawn" }, 409);
  const { error } = await sb.from("rp_moderator_slot_proposals")
    .update({ status: "withdrawn" }).eq("id", proposalId).eq("status", "pending");
  if (error) { console.error("[vendor-interviews] withdraw", error.message); return json({ success: false, error: "Failed to withdraw" }, 500); }
  return json({ success: true });
}

// "I can't take this" — declines the OFFER (sets it declined) and withdraws
// the moderator's own pending proposals. Other candidates' offers are
// untouched; staff may still assign one of them.
async function declineOffer(sb: any, interviewers: any[], body: any) {
  const studyId = String(body.studyId || "");
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  if (!studyId) return json({ success: false, error: "studyId required" }, 400);
  const interviewerIds = interviewers.map((i: any) => i.id);
  const { data: study } = await sb.from("rp_studies").select("id,code,order_number,target_locale").eq("id", studyId).maybeSingle();
  if (!study) return json({ success: false, error: "Study not found" }, 404);
  const { data: offer } = await sb.from("rp_study_moderator_offers")
    .select("id,interviewer_id,status").eq("study_id", studyId).in("interviewer_id", interviewerIds)
    .in("status", ["offered", "accepted"]).maybeSingle();
  if (!offer) return json({ success: false, error: "You don't have an open offer for this study" }, 403);
  const { error } = await sb.from("rp_study_moderator_offers")
    .update({ status: "declined", responded_at: new Date().toISOString(), decline_note: note })
    .eq("id", offer.id);
  if (error) { console.error("[vendor-interviews] decline", error.message); return json({ success: false, error: "Failed to decline" }, 500); }
  await sb.from("rp_moderator_slot_proposals")
    .update({ status: "withdrawn" })
    .eq("study_id", studyId).eq("interviewer_id", offer.interviewer_id).eq("status", "pending");
  const moderatorName = interviewers.find((i: any) => i.id === offer.interviewer_id)?.name || "The moderator";
  await notifyStaff(sb,
    `Moderator declined the offer — ${studyRefLabel(study)}`,
    `<p>${escapeHtml(moderatorName)} declined the interview offer for <strong>${escapeHtml(studyRefLabel(study))}</strong>${note ? `: “${escapeHtml(note)}”` : "."}</p>`
      + `<p><a href="${escapeHtml(ADMIN_INTERVIEWS_URL)}">Review the other candidates in the admin portal</a>.</p>`,
    "moderator-offer-declined");
  return json({ success: true });
}

async function completeSession(sb: any, interviewerIds: string[], vendorId: string, body: any) {
  const slotId = String(body.slotId || "");
  const results: any[] = Array.isArray(body.participants) ? body.participants : [];
  if (!slotId) return json({ success: false, error: "slotId required" }, 400);

  // Ownership: the slot's interviewer must be one of this vendor's interviewers.
  const { data: slot } = await sb.from("rp_availability_slots").select("id,interviewer_id,study_id").eq("id", slotId).maybeSingle();
  if (!slot || !interviewerIds.includes(slot.interviewer_id)) return json({ success: false, error: "Not your session" }, 403);

  // Map invitation -> booking for feedback (all statuses, in case of re-submit).
  const { data: bks } = await sb.from("rp_bookings").select("id,invitation_id,slot_id").eq("slot_id", slotId);
  const bkByInv = new Map((bks || []).map((b: any) => [b.invitation_id, b]));

  const noShow = results.filter((r) => r && r.attended === false && r.invitationId).map((r) => r.invitationId);
  const { data: rpc, error } = await sb.rpc("rp_complete_session", { p_slot_id: slotId, p_no_show: noShow, p_by: `moderator:${vendorId}` });
  if (error) { console.error("[vendor-interviews] complete", error.message); return json({ success: false, error: "Failed to complete session" }, 500); }
  const row = Array.isArray(rpc) ? rpc[0] : rpc;

  // Save the moderator's per-participant ratings (idempotent per booking).
  let rated = 0;
  const invSubMap = new Map<string, string | null>();
  if (results.length) {
    const invIds = results.map((r) => r.invitationId).filter(Boolean);
    const { data: invs } = invIds.length ? await sb.from("rp_invitations").select("id,submission_id").in("id", invIds) : { data: [] };
    for (const i of invs || []) invSubMap.set(i.id, i.submission_id);
  }
  for (const r of results) {
    const bk: any = bkByInv.get(r.invitationId);
    if (!bk) continue;
    const hasRating = r.rating != null && Number(r.rating) >= 1 && Number(r.rating) <= 5;
    const hasComment = typeof r.comments === "string" && r.comments.trim();
    if (!hasRating && !hasComment && r.attended == null) continue;
    const { error: fbErr } = await sb.from("rp_moderator_feedback").upsert({
      booking_id: bk.id, interviewer_id: slot.interviewer_id, submission_id: invSubMap.get(r.invitationId) ?? null,
      study_id: slot.study_id, rating: hasRating ? Number(r.rating) : null,
      attended: typeof r.attended === "boolean" ? r.attended : null,
      comments: hasComment ? String(r.comments).trim().slice(0, 2000) : null,
      created_by: `moderator:${vendorId}`,
    }, { onConflict: "booking_id" });
    if (!fbErr) rated++;
  }

  return json({ success: true, completed: row?.completed ?? 0, noShow: row?.no_show ?? 0, rated });
}

// ─────────────────────────── moderator → participant relay (v2) ───────────────────────────

// Localized email chrome. The moderator's message itself is relayed verbatim
// (they write in the session language); only the surrounding template is
// localized, keyed by the participant's invitation locale. Mirrors the locale
// set of interview-schedule/emailStrings.ts; falls back to English.
interface RelayStrings { subject: string; hello: string; intro: string; filesLabel: string; replyNote: string; signoff: string }
const RELAY_STRINGS: Record<string, RelayStrings> = {
  en: {
    subject: "A message from your interviewer — {code}",
    hello: "Hello {name},",
    intro: "Your interviewer, {interviewer}, sent you a message about your upcoming research session ({code}, {when}):",
    filesLabel: "Files (links valid for 7 days):",
    replyNote: "You can reply directly to this email — the Cethos Research Panel team will pass your reply on to your interviewer.",
    signoff: "Cethos Research Panel",
  },
  de: {
    subject: "Eine Nachricht von Ihrer Interviewerin / Ihrem Interviewer — {code}",
    hello: "Guten Tag {name},",
    intro: "Ihre Interviewerin / Ihr Interviewer, {interviewer}, hat Ihnen eine Nachricht zu Ihrer bevorstehenden Studiensitzung ({code}, {when}) geschickt:",
    filesLabel: "Dateien (Links 7 Tage gültig):",
    replyNote: "Sie können direkt auf diese E-Mail antworten — das Cethos-Team leitet Ihre Antwort an Ihre Interviewerin / Ihren Interviewer weiter.",
    signoff: "Cethos Research Panel",
  },
  fr: {
    subject: "Un message de votre intervieweur — {code}",
    hello: "Bonjour {name},",
    intro: "Votre intervieweur, {interviewer}, vous a envoyé un message concernant votre prochaine session de recherche ({code}, {when}) :",
    filesLabel: "Fichiers (liens valables 7 jours) :",
    replyNote: "Vous pouvez répondre directement à cet e-mail — l'équipe du panel de recherche Cethos transmettra votre réponse à votre intervieweur.",
    signoff: "Cethos Research Panel",
  },
  it: {
    subject: "Un messaggio dal Suo intervistatore — {code}",
    hello: "Gentile {name},",
    intro: "Il Suo intervistatore, {interviewer}, Le ha inviato un messaggio riguardo alla Sua prossima sessione di ricerca ({code}, {when}):",
    filesLabel: "File (link validi per 7 giorni):",
    replyNote: "Può rispondere direttamente a questa e-mail — il team del panel di ricerca Cethos inoltrerà la Sua risposta all'intervistatore.",
    signoff: "Cethos Research Panel",
  },
  cs: {
    subject: "Zpráva od vašeho tazatele — {code}",
    hello: "Dobrý den, {name},",
    intro: "Váš tazatel {interviewer} vám poslal zprávu ohledně vaší nadcházející výzkumné schůzky ({code}, {when}):",
    filesLabel: "Soubory (odkazy platné 7 dní):",
    replyNote: "Na tento e-mail můžete přímo odpovědět — tým výzkumného panelu Cethos vaši odpověď předá tazateli.",
    signoff: "Cethos Research Panel",
  },
  pl: {
    subject: "Wiadomość od osoby prowadzącej wywiad — {code}",
    hello: "Dzień dobry, {name},",
    intro: "Osoba prowadząca Państwa wywiad, {interviewer}, przesłała wiadomość dotyczącą nadchodzącej sesji badawczej ({code}, {when}):",
    filesLabel: "Pliki (linki ważne przez 7 dni):",
    replyNote: "Mogą Państwo odpowiedzieć bezpośrednio na tę wiadomość — zespół panelu badawczego Cethos przekaże odpowiedź osobie prowadzącej.",
    signoff: "Cethos Research Panel",
  },
  ja: {
    subject: "面接担当者からのメッセージ — {code}",
    hello: "{name} 様",
    intro: "ご担当のインタビュアー {interviewer} より、今後のリサーチセッション（{code}、{when}）についてメッセージが届いています。",
    filesLabel: "ファイル（リンクの有効期間は7日間です）：",
    replyNote: "このメールにそのまま返信していただけます。Cethos リサーチパネル担当チームがインタビュアーにお伝えします。",
    signoff: "Cethos Research Panel",
  },
  th: {
    subject: "ข้อความจากผู้สัมภาษณ์ของคุณ — {code}",
    hello: "เรียน คุณ{name}",
    intro: "ผู้สัมภาษณ์ของคุณ {interviewer} ได้ส่งข้อความเกี่ยวกับเซสชันการวิจัยที่กำลังจะมาถึง ({code}, {when}):",
    filesLabel: "ไฟล์ (ลิงก์ใช้งานได้ 7 วัน):",
    replyNote: "คุณสามารถตอบกลับอีเมลนี้ได้โดยตรง ทีมงาน Cethos Research Panel จะส่งต่อคำตอบของคุณไปยังผู้สัมภาษณ์",
    signoff: "Cethos Research Panel",
  },
};

const fill = (s: string, ctx: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? "");
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function formatWhen(startIso: string, locale: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat(locale || "en", { dateStyle: "full", timeStyle: "short", timeZone: tz || "UTC" }).format(new Date(startIso));
  } catch {
    return new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }).format(new Date(startIso)) + " (UTC)";
  }
}

// Brevo send — same sender convention as interview-schedule/interview-admin:
// ALL research-panel mail from participants@cethosresearch.com (RP_SENDER_EMAIL
// override only). Reply-to is the staff mailbox, NOT the moderator: replies
// land with Cethos staff, who forward — neither side sees the other's address.
// Rollout monitor: rp_config key 'monitor_bcc_emails' (jsonb array) BCCs every
// relayed email for tracking. BCC (not CC) so it's never exposed to
// participants/moderators. Loaded once per request; delete the row to stop.
let MONITOR_BCC: { email: string }[] = [];
async function loadMonitorBcc(sb: any) {
  try {
    const { data } = await sb.from("rp_config").select("value").eq("key", "monitor_bcc_emails").maybeSingle();
    const arr = Array.isArray(data?.value) ? data.value : [];
    MONITOR_BCC = arr.filter((e: unknown) => typeof e === "string" && (e as string).includes("@")).map((email: string) => ({ email }));
  } catch { MONITOR_BCC = []; }
}
function bccFromEnv(): { bcc?: { email: string }[] } {
  return MONITOR_BCC.length ? { bcc: MONITOR_BCC } : {};
}
async function sendRelayEmail(i: { to: string; toName?: string; subject: string; html: string; tags?: string[] }): Promise<boolean> {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) { console.log(`[vendor-interviews] (no BREVO_API_KEY) would send "${i.subject}" to ${i.to}`); return false; }
  try {
    const sender = Deno.env.get("RP_SENDER_EMAIL") || "participants@cethosresearch.com";
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: sender, name: Deno.env.get("BREVO_SENDER_NAME") || "Cethos Research Panel" },
        replyTo: { email: Deno.env.get("RP_REPLY_TO") || sender },
        to: [{ email: i.to, name: i.toName }], subject: i.subject, htmlContent: i.html, tags: i.tags,
        ...bccFromEnv(),
      }),
    });
    return res.ok;
  } catch { return false; }
}

async function sendModeratorMessage(sb: any, interviewers: any[], vendorId: string, body: any) {
  const slotId = String(body.slotId || "");
  const message = String(body.message || "").trim();
  const onlyInvitationIds: string[] | null = Array.isArray(body.invitationIds) && body.invitationIds.length
    ? body.invitationIds.map(String) : null;
  const attachPaths: string[] = Array.isArray(body.attachPaths) ? body.attachPaths.map(String).slice(0, 10) : [];
  if (!slotId) return json({ success: false, error: "slotId required" }, 400);
  if (!message && !attachPaths.length) return json({ success: false, error: "Message is empty" }, 400);
  if (message.length > 2000) return json({ success: false, error: "Message is too long (max 2000 characters)" }, 400);

  const interviewerIds = interviewers.map((i: any) => i.id);
  const { data: slot } = await sb.from("rp_availability_slots").select("id,interviewer_id,study_id,start_at,end_at,status").eq("id", slotId).maybeSingle();
  if (!slot || !interviewerIds.includes(slot.interviewer_id)) return json({ success: false, error: "Not your session" }, 403);
  if (slot.status === "cancelled") return json({ success: false, error: "Session is cancelled" }, 400);
  if (new Date(slot.end_at || slot.start_at).getTime() <= Date.now()) {
    return json({ success: false, error: "This session has already ended" }, 400);
  }

  // Abuse guard: cap compose batches per slot per 24h.
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recent } = await sb.from("rp_moderator_messages").select("batch_id").eq("slot_id", slotId).gte("created_at", dayAgo);
  const recentBatches = new Set((recent || []).map((r: any) => r.batch_id)).size;
  if (recentBatches >= MAX_BATCHES_PER_SLOT_PER_DAY) {
    return json({ success: false, error: "Daily message limit reached for this session" }, 429);
  }

  // Recipients: confirmed bookings on this slot (optionally narrowed by the
  // moderator's per-participant selection).
  let bkQuery = sb.from("rp_bookings").select("id,invitation_id,participant_timezone").eq("slot_id", slotId).eq("status", "confirmed");
  if (onlyInvitationIds) bkQuery = bkQuery.in("invitation_id", onlyInvitationIds);
  const { data: bks } = await bkQuery;
  const recipients = bks || [];
  if (!recipients.length) return json({ success: false, error: "No confirmed participants to message" }, 400);

  const invIds = recipients.map((b: any) => b.invitation_id);
  const [invRes, studyRes] = await Promise.all([
    sb.from("rp_invitations").select("id,submission_id,locale").in("id", invIds),
    sb.from("rp_studies").select("id,code").eq("id", slot.study_id).maybeSingle(),
  ]);
  const invMap = new Map((invRes.data || []).map((i: any) => [i.id, i]));
  const studyCode = studyRes.data?.code || "research session";
  const subIds = Array.from(new Set((invRes.data || []).map((i: any) => i.submission_id).filter(Boolean)));
  const { data: subs } = subIds.length ? await sb.from("research_panel_signups").select("id,full_name,email").in("id", subIds) : { data: [] };
  const subMap = new Map((subs || []).map((s: any) => [s.id, s]));

  // Attached interview files: only paths that staff actually shared for this
  // study are allowed (the moderator can re-share staff-approved translated
  // documents, never upload or reference arbitrary storage paths). Fresh
  // 7-day signed links, one set shared by every recipient of the batch.
  let attachedFiles: { name: string; url: string; path: string }[] = [];
  if (attachPaths.length) {
    const studyFileMap = await studyFiles(sb, [slot.study_id]);
    const allowed = new Map((studyFileMap.get(slot.study_id) || []).map((f: any) => [f.path, f]));
    const bad = attachPaths.filter((p) => !allowed.has(p));
    if (bad.length) return json({ success: false, error: "Attachment is not one of this interview's shared files" }, 400);
    attachedFiles = attachPaths.map((p) => allowed.get(p)!);
  }

  const interviewerName = interviewers.find((i: any) => i.id === slot.interviewer_id)?.name || "your interviewer";
  const batchId = crypto.randomUUID();
  const bodyHtml = escapeHtml(message).replace(/\n/g, "<br>");
  const filesHtml = (label: string) => attachedFiles.length
    ? `<p>${escapeHtml(label)}</p><ul>${attachedFiles.map((f) => `<li><a href="${escapeHtml(f.url)}">${escapeHtml(f.name)}</a></li>`).join("")}</ul>`
    : "";

  let sent = 0, failed = 0;
  for (const bk of recipients) {
    const inv: any = invMap.get(bk.invitation_id);
    const sub: any = inv ? subMap.get(inv.submission_id) : null;

    // Audit row first — a relay failure stays visible (relayed_at null + error).
    // file_* keys only included when files are attached, so a pre-migration
    // deploy still handles plain text messages.
    const { data: row, error: insErr } = await sb.from("rp_moderator_messages").insert({
      batch_id: batchId, slot_id: slotId, booking_id: bk.id,
      interviewer_id: slot.interviewer_id, vendor_id: vendorId,
      body: message || "(files only)",
      ...(attachedFiles.length ? {
        file_names: attachedFiles.map((f) => f.name),
        file_paths: attachedFiles.map((f) => f.path),
      } : {}),
    }).select("id").single();
    if (insErr) { console.error("[vendor-interviews] message insert", insErr.message); failed++; continue; }

    if (!sub?.email) {
      await sb.from("rp_moderator_messages").update({ relay_error: "participant email missing" }).eq("id", row.id);
      failed++; continue;
    }

    const locale = (inv?.locale || "en").toLowerCase();
    const s = RELAY_STRINGS[locale] || RELAY_STRINGS.en;
    const when = formatWhen(slot.start_at, locale, bk.participant_timezone || "UTC");
    const ctx = { name: sub.full_name || "", interviewer: interviewerName, code: studyCode, when };
    const html =
      `<p>${escapeHtml(fill(s.hello, ctx))}</p>` +
      `<p>${escapeHtml(fill(s.intro, ctx))}</p>` +
      (message ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #0d9488;background:#f0fdfa;color:#111">${bodyHtml}</blockquote>` : "") +
      filesHtml(s.filesLabel) +
      `<p>${escapeHtml(s.replyNote)}</p>` +
      `<p>${escapeHtml(s.signoff)}</p>`;
    const ok = await sendRelayEmail({
      to: sub.email, toName: sub.full_name || undefined,
      subject: fill(s.subject, ctx), html, tags: ["moderator-message"],
    });
    await sb.from("rp_moderator_messages").update(
      ok ? { relayed_at: new Date().toISOString() } : { relay_error: "brevo send failed" },
    ).eq("id", row.id);
    ok ? sent++ : failed++;
  }

  // Staff oversight copy — every relayed batch lands in the ops mailbox
  // (patient studies: staff must be able to see what moderators send).
  try {
    const { data: cfg } = await sb.from("rp_config").select("value").eq("key", "staff_notify_emails").maybeSingle();
    const staff: string[] = Array.isArray(cfg?.value) ? cfg.value : [];
    const whenUtc = formatWhen(slot.start_at, "en-GB", "UTC") + " (UTC)";
    for (const to of staff) {
      await sendRelayEmail({
        to,
        subject: `Moderator message relayed — ${studyCode}`,
        html:
          `<p>${escapeHtml(interviewerName)} messaged ${sent} participant(s) of ${escapeHtml(studyCode)} (session ${escapeHtml(whenUtc)}) via the vendor portal.${failed ? ` ${failed} relay(s) failed.` : ""}</p>` +
          (message ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #6366f1;background:#eef2ff;color:#111">${bodyHtml}</blockquote>` : "") +
          filesHtml("Attached interview files (7-day links):") +
          `<p>Replies from participants arrive at the research-panel mailbox — forward them to the moderator as needed.</p>`,
        tags: ["moderator-message-staff-copy"],
      });
    }
  } catch (e) {
    console.error("[vendor-interviews] staff copy failed", e instanceof Error ? e.message : e);
  }

  return json({ success: true, sent, failed, batchId });
}
