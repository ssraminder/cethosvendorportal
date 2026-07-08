// vendor-interviews — moderator console backend for the vendor portal.
//
// Lets a logged-in vendor who moderates research-panel interviews (linked via
// rp_interviewers.vendor_id) see their sessions, mark a session complete
// (attended / no-show), and rate each participant. Completion is delegated to
// the shared rp_complete_session RPC (same code path as staff completion), which
// creates the pending payments; that in turn lets the interview-schedule cron
// send participants the "confirm payment + feedback" email.
//
// Auth: vendor_sessions bearer token (header) OR session_token in the body.
// All rp_* access is via service_role — the sanctioned cross-system boundary.
//
// POST { action: "list" | "complete", session_token?, ... }

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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

    // This vendor's interviewer record(s).
    const { data: ivs } = await sb.from("rp_interviewers").select("id").eq("vendor_id", vendorId);
    const interviewerIds = (ivs || []).map((i: any) => i.id);
    if (!interviewerIds.length) return json({ success: true, sessions: [] });

    const action = String(body.action || "list");
    if (action === "list") return await listSessions(sb, interviewerIds);
    if (action === "complete") return await completeSession(sb, interviewerIds, vendorId, body);
    return json({ success: false, error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("vendor-interviews error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

async function listSessions(sb: any, interviewerIds: string[]) {
  const { data: slots } = await sb
    .from("rp_availability_slots")
    .select("id,study_id,start_at,end_at,status")
    .in("interviewer_id", interviewerIds)
    .neq("status", "cancelled")
    .order("start_at", { ascending: false });
  const slotList = slots || [];
  if (!slotList.length) return json({ success: true, sessions: [] });

  const slotIds = slotList.map((s: any) => s.id);
  const studyIds = Array.from(new Set(slotList.map((s: any) => s.study_id).filter(Boolean)));
  const [bkRes, studyRes] = await Promise.all([
    sb.from("rp_bookings").select("id,slot_id,invitation_id,status").in("slot_id", slotIds).in("status", ["confirmed", "completed", "no_show"]),
    studyIds.length ? sb.from("rp_studies").select("id,code,duration_minutes").in("id", studyIds) : Promise.resolve({ data: [] }),
  ]);
  const bookings = bkRes.data || [];
  const studyMap = new Map((studyRes.data || []).map((s: any) => [s.id, s]));

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
  for (const b of bookings) {
    const inv: any = invMap.get(b.invitation_id);
    const sub: any = inv ? subMap.get(inv.submission_id) : null;
    const fb: any = fbMap.get(b.id);
    const arr = bySlot.get(b.slot_id) || [];
    arr.push({
      invitationId: b.invitation_id, bookingId: b.id, status: b.status,
      name: sub?.full_name || "Participant",
      rating: fb?.rating ?? null, attended: fb?.attended ?? null, comments: fb?.comments ?? null,
    });
    bySlot.set(b.slot_id, arr);
  }

  const sessions = slotList.map((s: any) => {
    const participants = bySlot.get(s.id) || [];
    const confirmed = participants.filter((p: any) => p.status === "confirmed").length;
    const st: any = studyMap.get(s.study_id);
    return {
      slotId: s.id, studyCode: st?.code || "Session", durationMinutes: st?.duration_minutes ?? null,
      startAt: s.start_at, endAt: s.end_at,
      isCompleted: confirmed === 0 && participants.length > 0,
      canComplete: confirmed > 0,
      participants,
    };
  }).filter((s: any) => s.participants.length > 0);

  return json({ success: true, sessions });
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
