// Moderator console — a vendor who moderates research-panel interviews sees
// their sessions here, marks a session complete (attended / no-show), and rates
// each participant. Completing triggers the participant payment + feedback
// emails on the CETHOS side.
//
// Phase 6: the moderator can also message booked participants before the
// session (blinded relay — Cethos emails them; no contact info is shown here
// and replies go to Cethos staff), and sees the session's meeting link.
//
// Phase 6c: the moderator can place a masked click-to-call — Cethos rings the
// moderator first, then bridges to the participant, so neither side sees the
// other's number. The study's waitlist is callable the same way to backfill a
// no-show.
//
// Phase 6e: contact reaches the whole cohort, not just the confirmed — interested
// candidates (registered for this session, awaiting staff confirmation) and
// waitlisters are reachable by email, call, SMS and WhatsApp alike. A session now
// appears as soon as ANYONE is reachable, so studies with nobody confirmed yet —
// the ones most in need of chasing — are no longer invisible here.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, CalendarClock, CheckCircle2, Clock, Users, MessageSquare, Video, FileText, CalendarPlus, Trash2, XCircle, Phone, Send } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getMyInterviews,
  completeInterview,
  messageParticipants,
  callParticipant,
  textParticipant,
  confirmCandidate,
  removeFromSession,
  proposeTimes,
  withdrawProposal,
  declineOffer,
  type InterviewSession,
  type InterviewParticipant,
  type InterestedEntry,
  type WaitlistEntry,
  type ContactChannels,
  type ContactKind,
  type AvailabilityRequest,
} from "../../api/vendorInterviews";

// One reachable person, flattened out of whichever cohort they came from.
// bookingId is null for waitlisters — they hold a study-level invitation with no
// booking, which is why they can't be confirmed or removed from a session.
interface ContactTarget { invitationId: string; bookingId: string | null; name: string; kind: ContactKind }
interface Cohort { key: ContactKind; label: string; people: ContactTarget[] }

// The session's cohorts in contact order: confirmed first, then the people the
// moderator may need to chase. Empty cohorts are dropped by the callers.
function cohortsOf(session: InterviewSession, confirmed: InterviewParticipant[]): Cohort[] {
  const all: Cohort[] = [
    { key: "participant", label: "Confirmed participants",
      people: confirmed.map((p) => ({ invitationId: p.invitationId, bookingId: p.bookingId, name: p.name, kind: "participant" as const })) },
    { key: "interested", label: "Interested — awaiting confirmation",
      people: session.interested.map((x: InterestedEntry) => ({ invitationId: x.invitationId, bookingId: x.bookingId, name: x.name, kind: "interested" as const })) },
    { key: "waitlist", label: "Waitlist — to fill a no-show",
      people: session.waitlist.map((w: WaitlistEntry) => ({ invitationId: w.invitationId, bookingId: null, name: w.name, kind: "waitlist" as const })) },
  ];
  return all.filter((c) => c.people.length > 0);
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function MyInterviewsPage() {
  const { sessionToken } = useVendorAuth();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [availabilityRequests, setAvailabilityRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  // The moderator's callback number for click-to-call — seeded from the server's
  // remembered value, updated as they place calls so it prefills next time.
  const [callbackPhone, setCallbackPhone] = useState<string>("");
  const [channels, setChannels] = useState<ContactChannels>({ call: false, sms: false, whatsapp: false });

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    const data = await getMyInterviews(sessionToken);
    setSessions(data.sessions);
    setAvailabilityRequests(data.availabilityRequests);
    setCallbackPhone((cur) => cur || data.callbackPhone || "");
    setChannels(data.channels);
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  // Anything not yet completed is live work — including sessions with nobody
  // confirmed yet, which have people to chase but nothing to complete. Bucketing
  // on canComplete would drop those on the floor entirely.
  const upcoming = sessions.filter((s) => !s.isCompleted);
  const completed = sessions.filter((s) => s.isCompleted);

  if (loading)
    return <div className="flex items-center justify-center py-24 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your sessions…</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarClock className="w-6 h-6 text-teal-600" /> My interviews</h1>
        <p className="text-sm text-gray-500">Accept interview offers and propose your times, run your sessions, then mark them complete and rate each participant.</p>
      </div>

      {availabilityRequests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Interview offers</h2>
          <div className="space-y-3">
            {availabilityRequests.map((a) => (
              <AvailabilityRequestCard key={a.studyId} request={a} token={sessionToken!} onChanged={load} />
            ))}
          </div>
        </section>
      )}

      {sessions.length === 0 && availabilityRequests.length === 0 && (
        <div className="text-center py-16 text-gray-500 bg-white border border-gray-200 rounded-xl">You have no interview sessions assigned.</div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">To run / complete</h2>
          <div className="space-y-3">
            {upcoming.map((s) => (
              <SessionCard key={s.slotId} session={s} busy={completing === s.slotId}
                onComplete={async (results) => {
                  setCompleting(s.slotId);
                  const r = await completeInterview(sessionToken!, s.slotId, results);
                  setCompleting(null);
                  if (r.success) await load();
                  return r.success;
                }}
                onMessage={async (message, invitationIds, attachPaths) => {
                  const r = await messageParticipants(sessionToken!, s.slotId, message, invitationIds, attachPaths);
                  if (r.success) await load();
                  return r;
                }}
                callbackPhone={callbackPhone}
                channels={channels}
                onCall={async (invitationId, moderatorPhone, kind) => {
                  const r = await callParticipant(sessionToken!, s.slotId, invitationId, moderatorPhone, kind);
                  if (r.success) setCallbackPhone(moderatorPhone);
                  return r;
                }}
                onText={async (invitationId, channel, message, kind) => {
                  return textParticipant(sessionToken!, s.slotId, invitationId, channel, message, kind);
                }}
                onConfirm={async (bookingId) => {
                  const r = await confirmCandidate(sessionToken!, s.slotId, bookingId);
                  if (r.success) await load();
                  return r;
                }}
                onRemove={async (bookingId) => {
                  const r = await removeFromSession(sessionToken!, s.slotId, bookingId);
                  if (r.success) await load();
                  return r;
                }} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Completed</h2>
          <div className="space-y-3">
            {completed.map((s) => (
              <div key={s.slotId} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-900">{s.studyCode}</div>
                  <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="w-4 h-4" /> Completed</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">{fmt(s.startAt)}</div>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {s.participants.map((p) => (
                    <li key={p.bookingId} className="flex items-center gap-2">
                      <span className={p.status === "no_show" ? "text-gray-400 line-through" : ""}>{p.name}</span>
                      {p.status === "no_show" && <span className="text-xs text-gray-400">no-show</span>}
                      {p.rating != null && <span className="text-xs text-amber-600">★ {p.rating}/5</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SessionCard({ session, busy, onComplete, onMessage, callbackPhone, channels, onCall, onText, onConfirm, onRemove }: {
  session: InterviewSession;
  busy: boolean;
  onComplete: (results: { invitationId: string; attended: boolean; rating?: number | null; comments?: string | null }[]) => Promise<boolean>;
  onMessage: (message: string, invitationIds?: string[], attachPaths?: string[]) => Promise<{ success: boolean; sent?: number; error?: string }>;
  callbackPhone: string;
  channels: ContactChannels;
  onCall: (invitationId: string, moderatorPhone: string, kind: ContactKind) => Promise<{ success: boolean; error?: string }>;
  onText: (invitationId: string, channel: "sms" | "whatsapp", message: string, kind: ContactKind) => Promise<{ success: boolean; error?: string }>;
  onConfirm: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  onRemove: (bookingId: string) => Promise<{ success: boolean; promoted?: boolean; error?: string }>;
}) {
  const [panel, setPanel] = useState<null | "complete" | "message" | "call" | "group">(null);
  // Whether the session is live and at least one Twilio channel is configured.
  const canContact = session.canCall && (channels.call || channels.sms || channels.whatsapp);
  const confirmed = session.participants.filter((p) => p.status === "confirmed");
  const cohorts = cohortsOf(session, confirmed);
  const reachable = cohorts.reduce((n, c) => n + c.people.length, 0);
  const [state, setState] = useState<Record<string, { attended: boolean; rating: number; comments: string }>>(() =>
    Object.fromEntries(confirmed.map((p) => [p.invitationId, { attended: true, rating: 0, comments: "" }])));

  function upd(id: string, patch: Partial<{ attended: boolean; rating: number; comments: string }>) {
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  async function submit() {
    const results = confirmed.map((p) => ({
      invitationId: p.invitationId,
      attended: state[p.invitationId]?.attended ?? true,
      rating: state[p.invitationId]?.rating || null,
      comments: state[p.invitationId]?.comments || null,
    }));
    await onComplete(results);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">{session.studyCode}</div>
          <div className="text-xs text-gray-500">{fmt(session.startAt)}{session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}</div>
        </div>
        <div className="flex items-center gap-3">
          {session.meetingLink && (
            <a href={session.meetingLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-teal-700 border border-teal-300 rounded-lg px-2 py-1 hover:bg-teal-50">
              <Video className="w-3.5 h-3.5" /> Join meeting
            </a>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500" title={`${confirmed.length} confirmed participant${confirmed.length === 1 ? "" : "s"}`}>
            <Users className="w-4 h-4" /> {confirmed.length}
          </span>
          {session.interested.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600" title={`${session.interested.length} interested, awaiting Cethos confirmation`}>
              <Clock className="w-4 h-4" /> {session.interested.length}
            </span>
          )}
        </div>
      </div>
      {confirmed.length === 0 && session.interested.length > 0 && (
        <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Nobody is confirmed for this session yet — Cethos is still putting the group together.
          You can reach the interested candidates below in the meantime.
        </div>
      )}
      {session.files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" title="Interview documents shared by Cethos — links valid 7 days, refreshed on every visit">
          {session.files.map((f) => (
            <a key={f.path} href={f.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50">
              <FileText className="w-3.5 h-3.5 text-teal-600" /> {f.name}
            </a>
          ))}
        </div>
      )}
      {panel === null ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Only confirmed participants can be marked attended and rated, so this
              stays hidden until Cethos has confirmed someone. */}
          {session.canComplete && (
            <button onClick={() => setPanel("complete")} className="inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700">
              <CheckCircle2 className="w-4 h-4" /> Mark complete & rate
            </button>
          )}
          {session.canMessage && (
            <button onClick={() => setPanel("message")} className="inline-flex items-center gap-1.5 text-sm border border-teal-600 text-teal-700 rounded-lg px-3 py-2 font-medium hover:bg-teal-50">
              <MessageSquare className="w-4 h-4" /> Email
            </button>
          )}
          {canContact && (
            <button onClick={() => setPanel("call")} className="inline-flex items-center gap-1.5 text-sm border border-teal-600 text-teal-700 rounded-lg px-3 py-2 font-medium hover:bg-teal-50">
              <Phone className="w-4 h-4" /> Call / text
              {reachable > 0 && <span className="text-xs text-gray-400">· {reachable}</span>}
            </button>
          )}
          {/* Deliberately its own panel, not buttons on the Call rows: removing
              someone frees their seat and emails a replacement, and that must not
              be one stray click away from "Call". */}
          {session.canMessage && (confirmed.length > 0 || session.interested.length > 0) && (
            <button onClick={() => setPanel("group")} className="inline-flex items-center gap-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg px-3 py-2 font-medium hover:bg-gray-50">
              <Users className="w-4 h-4" /> Manage group
            </button>
          )}
        </div>
      ) : panel === "group" ? (
        <GroupPanel session={session} cohorts={cohorts} onCancel={() => setPanel(null)}
          onConfirm={onConfirm} onRemove={onRemove} />
      ) : panel === "message" ? (
        <MessageComposer cohorts={cohorts} messages={session.messages} files={session.files}
          onCancel={() => setPanel(null)}
          onSend={async (message, invitationIds, attachPaths) => {
            const r = await onMessage(message, invitationIds, attachPaths);
            if (r.success) setPanel(null);
            return r;
          }} />
      ) : panel === "call" ? (
        <ContactPanel cohorts={cohorts} initialPhone={callbackPhone}
          channels={channels} onCancel={() => setPanel(null)} onCall={onCall} onText={onText} />
      ) : (
        <div className="mt-3 space-y-3">
          {confirmed.map((p: InterviewParticipant) => {
            const st = state[p.invitationId];
            return (
              <div key={p.invitationId} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <label className="flex items-center gap-1.5 text-sm text-gray-600">
                    <input type="checkbox" checked={st?.attended ?? true} onChange={(e) => upd(p.invitationId, { attended: e.target.checked })} /> Attended
                  </label>
                </div>
                {(st?.attended ?? true) && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Rating:</span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => upd(p.invitationId, { rating: n })}
                          className={`w-7 h-7 rounded-full border text-sm ${(st?.rating ?? 0) >= n ? "bg-teal-600 text-white border-teal-600" : "border-gray-300 text-gray-400"}`}>{n}</button>
                      ))}
                    </div>
                    <input value={st?.comments ?? ""} onChange={(e) => upd(p.invitationId, { comments: e.target.value })}
                      placeholder="Notes on this participant (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex justify-end gap-2">
            <button onClick={() => setPanel(null)} disabled={busy} className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50">Cancel</button>
            <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700 disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Complete session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Manage group — confirm an interested candidate into a seat, or take someone
// off the session. Kept apart from Call / text on purpose: both actions here are
// irreversible and outward-facing (a confirm emails joining details, a removal
// hands the seat to someone else), so they shouldn't sit beside a Call button.
//
// Waitlisters aren't listed: they hold a study-level invitation with no booking
// on this session, so there's nothing to confirm or remove. Free a seat by
// removing a confirmed participant and Cethos promotes one of them automatically.
function GroupPanel({ session, cohorts, onCancel, onConfirm, onRemove }: {
  session: InterviewSession;
  cohorts: Cohort[];
  onCancel: () => void;
  onConfirm: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  onRemove: (bookingId: string) => Promise<{ success: boolean; promoted?: boolean; error?: string }>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const manageable = cohorts.filter((c) => c.key === "participant" || c.key === "interested");
  const cap = session.capacity;
  const seatsLeft = cap != null ? Math.max(0, cap - session.seatsTaken) : null;

  async function confirm(bookingId: string, name: string) {
    setBusyId(bookingId); setStatus(null);
    const r = await onConfirm(bookingId);
    setBusyId(null);
    setStatus({ ok: r.success, msg: r.success ? `${name} is confirmed — Cethos will send their joining details.` : (r.error || "Couldn't confirm them.") });
  }
  async function remove(bookingId: string, name: string, kind: ContactKind) {
    setBusyId(bookingId); setStatus(null);
    const r = await onRemove(bookingId);
    setBusyId(null); setConfirmingRemoval(null);
    setStatus({
      ok: r.success,
      msg: r.success
        ? `${name} removed.${kind === "participant" ? (r.promoted ? " Their seat went to the next person waiting." : " Their seat is now free — nobody was waiting to take it.") : ""}`
        : (r.error || "Couldn't remove them."),
    });
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
        Confirm the people who tell you they'll attend, and take off anyone who can't.
        Confirming sends them their joining details automatically.
        {cap != null && (
          <> This session seats <span className="font-medium">{cap}</span> — {session.seatsTaken} taken, <span className="font-medium">{seatsLeft}</span> free.</>
        )}
      </div>

      {status && (
        <div className={`text-sm rounded-lg px-3 py-2 border ${status.ok ? "text-green-800 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>
          {status.msg}
        </div>
      )}

      {manageable.map((c) => (
        <div key={c.key}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{c.label}</div>
          <div className="space-y-1.5">
            {c.people.map((p) => (
              <div key={p.invitationId} className="border border-gray-200 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-900">{p.name}</span>
                  <div className="flex items-center gap-2">
                    {p.kind === "interested" && (
                      <button
                        onClick={() => p.bookingId && confirm(p.bookingId, p.name)}
                        disabled={busyId !== null || seatsLeft === 0}
                        title={seatsLeft === 0 ? "The session is full — ask Cethos to raise the capacity" : undefined}
                        className="inline-flex items-center gap-1 text-xs bg-teal-600 text-white rounded-lg px-2.5 py-1.5 font-medium hover:bg-teal-700 disabled:opacity-50">
                        {busyId === p.bookingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Confirm
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmingRemoval(p.bookingId)}
                      disabled={busyId !== null}
                      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                </div>
                {confirmingRemoval === p.bookingId && (
                  <div className="mt-2 border border-red-200 bg-red-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-700 mb-2">
                      Remove <span className="font-medium">{p.name}</span> from this session? This can't be undone.
                      {p.kind === "participant" && " Their seat is freed and offered to the next person waiting."}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setConfirmingRemoval(null)} className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-50">Keep them</button>
                      <button onClick={() => p.bookingId && remove(p.bookingId, p.name, p.kind)} disabled={busyId !== null}
                        className="inline-flex items-center gap-1 text-xs bg-red-600 text-white rounded-lg px-2.5 py-1.5 font-medium hover:bg-red-700 disabled:opacity-50">
                        {busyId === p.bookingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Yes, remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {session.waitlist.length > 0 && (
        <p className="text-xs text-gray-400">
          {session.waitlist.length} {session.waitlist.length === 1 ? "person is" : "people are"} waitlisted for this study.
          Free a seat and Cethos offers it to them automatically — use Call / text if you want to check they're available first.
        </p>
      )}

      <div className="flex justify-end">
        <button onClick={onCancel} disabled={busyId !== null} className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50">Done</button>
      </div>
    </div>
  );
}

// Contact panel — one place to reach a participant or waitlister across Twilio
// channels, all blinded (nothing leaves the Cethos number):
//   • Call: Cethos rings the moderator first, then bridges the participant, so
//     neither sees the other's number.
//   • SMS / WhatsApp: a one-way outbound text from the Cethos line (replies
//     aren't routed back yet).
// Only the channels Cethos has configured are offered.
type ContactMode = "call" | "sms" | "whatsapp";
function ContactPanel({ cohorts, initialPhone, channels, onCancel, onCall, onText }: {
  cohorts: Cohort[];
  initialPhone: string;
  channels: ContactChannels;
  onCancel: () => void;
  onCall: (invitationId: string, moderatorPhone: string, kind: ContactKind) => Promise<{ success: boolean; error?: string }>;
  onText: (invitationId: string, channel: "sms" | "whatsapp", message: string, kind: ContactKind) => Promise<{ success: boolean; error?: string }>;
}) {
  const modes = ([
    { key: "call", label: "Call", on: channels.call },
    { key: "sms", label: "SMS", on: channels.sms },
    { key: "whatsapp", label: "WhatsApp", on: channels.whatsapp },
  ] as { key: ContactMode; label: string; on: boolean }[]).filter((m) => m.on);
  const [mode, setMode] = useState<ContactMode>(modes[0]?.key || "call");
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  // Loose E.164 check — the server normalizes + validates authoritatively.
  const phoneOk = /^\+?[\d\s()\-.]{7,}$/.test(phone.trim());
  const textMode = mode === "sms" || mode === "whatsapp";
  const ready = textMode ? message.trim().length > 0 : phoneOk;

  async function act(invitationId: string, kind: ContactKind, name: string) {
    if (!ready) {
      setStatus({ id: invitationId, ok: false, msg: textMode ? "Type a message first." : "Enter your callback number first." });
      return;
    }
    setBusyId(invitationId);
    setStatus(null);
    const r = textMode
      ? await onText(invitationId, mode as "sms" | "whatsapp", message.trim(), kind)
      : await onCall(invitationId, phone.trim(), kind);
    setBusyId(null);
    const okMsg = mode === "call"
      ? `Calling you now — pick up, then we'll connect ${name}.`
      : `${mode === "whatsapp" ? "WhatsApp" : "Text"} sent to ${name}.`;
    setStatus({ id: invitationId, ok: r.success, msg: r.success ? okMsg : (r.error || "Couldn't complete that.") });
  }

  const Row = ({ id, name, kind }: { id: string; name: string; kind: ContactKind }) => (
    <div className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2">
      <span className="text-sm text-gray-900">{name}</span>
      <div className="flex items-center gap-2">
        {status?.id === id && (
          <span className={`text-xs ${status.ok ? "text-green-600" : "text-red-600"}`}>{status.msg}</span>
        )}
        <button
          onClick={() => act(id, kind, name)}
          disabled={!ready || busyId !== null}
          className="inline-flex items-center gap-1 text-xs bg-teal-600 text-white rounded-lg px-2.5 py-1.5 font-medium hover:bg-teal-700 disabled:opacity-50">
          {busyId === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : mode === "call" ? <Phone className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          {mode === "call" ? "Call" : "Send"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-3 space-y-3">
      {modes.length > 1 && (
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {modes.map((m) => (
            <button key={m.key}
              onClick={() => { setMode(m.key); setStatus(null); }}
              className={`px-3 py-1.5 ${mode === m.key ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {mode === "call" ? (
        <>
          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
            We <span className="font-medium">call you first</span> on the number below, then connect the participant.
            Neither of you sees the other's number — they'll see the Cethos Research Panel line. International call rates may apply.
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Number to reach you</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="+1 415 555 0123 (include country code)"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-xs text-gray-400">Include your country code. Saved for next time.</span>
          </label>
        </>
      ) : (
        <>
          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
            Sent from the Cethos Research Panel number as {mode === "whatsapp" ? "a WhatsApp message" : "an SMS"} — the participant never sees your number.
            Replies come back to Cethos, not to you. Messaging rates may apply.
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={`Write your ${mode === "whatsapp" ? "WhatsApp" : "text"} message…`}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-xs text-gray-400">{message.length}/1000 · the same message is sent to whoever you pick below.</span>
          </label>
        </>
      )}

      {cohorts.map((c) => (
        <div key={c.key}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{c.label}</div>
          <div className="space-y-1.5">
            {c.people.map((p) => <Row key={p.invitationId} id={p.invitationId} name={p.name} kind={p.kind} />)}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button onClick={onCancel} disabled={busyId !== null} className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50">Done</button>
      </div>
    </div>
  );
}

// Blinded compose panel: the message goes out as an email from the Cethos
// Research Panel address — the moderator never sees participant contact info
// and participant replies land with Cethos staff, who forward them.
//
// Reaches confirmed participants, interested candidates and waitlisters. Only
// confirmed participants are pre-selected: chasing the unconfirmed is a
// deliberate act, not the default. Cethos words each email to match the cohort,
// so an interested candidate is never told a session time they don't have.
function MessageComposer({ cohorts, messages, files, onCancel, onSend }: {
  cohorts: Cohort[];
  messages: InterviewSession["messages"];
  files: InterviewSession["files"];
  onCancel: () => void;
  onSend: (message: string, invitationIds?: string[], attachPaths?: string[]) => Promise<{ success: boolean; sent?: number; error?: string }>;
}) {
  const everyone = useMemo(() => cohorts.flatMap((c) => c.people), [cohorts]);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(everyone.filter((p) => p.kind === "participant").map((p) => p.invitationId)));
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interview documents are client material for the session itself, so Cethos
  // only relays them to confirmed participants and rejects the batch otherwise.
  // Catch it here so the moderator sees why before hitting send.
  const unconfirmedSelected = everyone.filter((p) => selected.has(p.invitationId) && p.kind !== "participant");
  const attachmentConflict = attached.size > 0 && unconfirmedSelected.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if ((!message.trim() && attached.size === 0) || selected.size === 0 || attachmentConflict) return;
    setSending(true);
    setError(null);
    // Always explicit: the cohorts differ, so "no ids = everyone" would be ambiguous.
    const r = await onSend(message.trim(), [...selected], attached.size ? [...attached] : undefined);
    setSending(false);
    if (!r.success) setError(r.error || "Failed to send");
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
        Your message is sent to the people you select <span className="font-medium">by email from the Cethos Research Panel</span>.
        You won't see their contact details, and their replies go to the Cethos team, who will forward them to you.
      </div>
      {cohorts.map((c) => (
        <div key={c.key}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</span>
            <button type="button"
              onClick={() => setSelected((prev) => {
                const next = new Set(prev);
                const allOn = c.people.every((p) => next.has(p.invitationId));
                for (const p of c.people) allOn ? next.delete(p.invitationId) : next.add(p.invitationId);
                return next;
              })}
              className="text-xs text-teal-700 hover:underline">
              {c.people.every((p) => selected.has(p.invitationId)) ? "Clear" : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {c.people.map((p) => (
              <label key={p.invitationId} className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(p.invitationId)} onChange={() => toggle(p.invitationId)} />
                {p.name}
              </label>
            ))}
          </div>
          {c.key === "interested" && (
            <p className="text-xs text-gray-400 mt-1">Cethos hasn't confirmed these people yet — their email won't mention a session time.</p>
          )}
        </div>
      ))}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="Write your message to the participants (e.g. what to prepare, joining instructions)…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
      {files.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Attach interview documents</div>
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <label key={f.path} className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={attached.has(f.path)} onChange={() => setAttached((prev) => {
                  const next = new Set(prev);
                  if (next.has(f.path)) next.delete(f.path);
                  else next.add(f.path);
                  return next;
                })} />
                <FileText className="w-3.5 h-3.5 text-teal-600" /> {f.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Documents shared by Cethos for this interview — each participant receives fresh 7-day download links.</p>
        </div>
      )}
      {attachmentConflict && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Interview documents go to <span className="font-medium">confirmed participants only</span>. Remove the attachments,
          or deselect {unconfirmedSelected.map((p) => p.name).join(", ")} to send them.
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{message.length}/2000</span>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={sending} className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50">Cancel</button>
          <button onClick={send} disabled={sending || (!message.trim() && attached.size === 0) || selected.size === 0 || attachmentConflict}
            className="inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700 disabled:opacity-50">
            {sending && <Loader2 className="w-4 h-4 animate-spin" />} Send to {selected.size} {selected.size === 1 ? "person" : "people"}
          </button>
        </div>
      </div>
      {messages.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sent messages</div>
          <ul className="space-y-1.5">
            {messages.map((m) => (
              <li key={m.batchId} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {fmt(m.createdAt)} · sent to {m.relayed}/{m.recipients} participant{m.recipients === 1 ? "" : "s"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────── availability proposals (moderator side) ───────────────────
// Cethos asked this moderator for the times that work for them. They propose
// date+time rows in their own timezone (session length is fixed by the study);
// Cethos approves, which opens the sessions for participant booking.

// Common payout currencies for the moderator's rate ask.
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "PLN", "BRL", "MXN", "CHF", "SEK", "NOK", "DKK", "ZAR", "SGD", "AED", "CNY"];

const durLabel = (min: number | null) => {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
};
const langName = (c: string | null) => {
  if (!c) return "";
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(c) || c; } catch { return c; }
};

function AvailabilityRequestCard({ request, token, onChanged }: {
  request: AvailabilityRequest;
  token: string;
  onChanged: () => Promise<void>;
}) {
  const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const [tz, setTz] = useState(browserTz);
  // Seed enough empty rows for a 1-to-1 study (one session per participant),
  // minus any times already proposed, capped at the per-submission limit.
  const [rows, setRows] = useState<{ date: string; time: string }[]>(() => {
    const live = request.proposals.filter((p) => p.status === "pending" || p.status === "approved").length;
    const need = request.interviewType !== "focus_group" && request.maxRespondents ? request.maxRespondents : 0;
    const seed = Math.min(Math.max(need - live, 1), 10);
    return Array.from({ length: seed }, () => ({ date: "", time: "10:00" }));
  });
  const [rate, setRate] = useState(request.proposedRate != null ? String(request.proposedRate) : "");
  const [currency, setCurrency] = useState(request.proposedRateCurrency || "USD");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineNote, setDeclineNote] = useState("");

  const tzOptions = useMemo(() => {
    const zones = (Intl as any).supportedValuesOf ? ((Intl as any).supportedValuesOf("timeZone") as string[]) : [];
    return zones.length ? zones : [browserTz, "UTC"];
  }, [browserTz]);

  const pending = request.proposals.filter((p) => p.status === "pending");
  const reviewed = request.proposals.filter((p) => p.status === "approved" || p.status === "rejected");
  // 1-to-1 studies need one session per participant, so the moderator must offer
  // at least max_respondents times (times already proposed count toward it).
  const existingLive = request.proposals.filter((p) => p.status === "pending" || p.status === "approved").length;
  const minSessions = request.interviewType !== "focus_group" && request.maxRespondents ? request.maxRespondents : 0;

  const fmtProposal = (p: { startAt: string; timezone: string }) => {
    try {
      return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: p.timezone }).format(new Date(p.startAt)) + ` (${p.timezone})`;
    } catch { return fmt(p.startAt); }
  };

  async function submit() {
    const filled = rows.filter((r) => r.date && r.time);
    if (!filled.length) { setError("Add at least one date and time"); return; }
    if (minSessions && existingLive + filled.length < minSessions && filled.length < 10) {
      setError(`This 1-to-1 study is for ${minSessions} participants — please add at least ${minSessions} session times (one per participant). You have ${existingLive + filled.length}.`);
      return;
    }
    const rateNum = Number(rate);
    if (!rate.trim() || !Number.isFinite(rateNum) || rateNum <= 0) { setError("Enter your hourly rate"); return; }
    setBusy("submit"); setError(null);
    const r = await proposeTimes(token, request.studyId, tz, filled, note.trim() || undefined, rateNum, currency);
    setBusy(null);
    if (!r.success) { setError(r.error || "Failed to submit"); return; }
    setRows([{ date: "", time: "10:00" }]); setNote("");
    await onChanged();
  }

  async function withdraw(id: string) {
    setBusy(id);
    const r = await withdrawProposal(token, id);
    setBusy(null);
    if (!r.success) { setError(r.error || "Failed to withdraw"); return; }
    await onChanged();
  }

  async function decline() {
    setBusy("decline");
    const r = await declineOffer(token, request.studyId, declineNote.trim() || undefined);
    setBusy(null);
    if (!r.success) { setError(r.error || "Failed"); return; }
    await onChanged();
  }

  const isFocus = request.interviewType === "focus_group";
  const accepted = request.offerStatus === "accepted";
  return (
    <div className="bg-white border border-teal-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">{request.studyCode}</div>
          <div className="text-xs text-gray-500">
            {isFocus ? "Focus group · " : ""}{durLabel(request.durationMinutes)}{isFocus ? " session" : " per session"}{request.targetLocale ? ` · ${langName(request.targetLocale)}` : ""}{request.meetingPlatform ? ` · ${request.meetingPlatform}` : ""} · offered {fmt(request.offeredAt)}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 whitespace-nowrap ${accepted ? "text-green-700 bg-green-50 border-green-200" : "text-teal-700 bg-teal-50 border-teal-200"}`}>
          {accepted ? <><CheckCircle2 className="w-3.5 h-3.5" /> Applied</> : <><CalendarPlus className="w-3.5 h-3.5" /> New offer</>}
        </span>
      </div>
      {!accepted && (
        <div className="mt-2 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          You've been offered this {isFocus ? "focus group" : "interview"}. Add the times that work for you and your hourly rate, then submit — that applies for this offer. Cethos may be asking a few moderators, so please respond{request.expiresAt ? ` before ${fmt(request.expiresAt)}` : " soon"}.
        </div>
      )}
      {isFocus && (
        <div className="mt-2 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          This is a focus group — <span className="font-medium">one shared session</span> that all participants join. Offer a few time options that work for you; Cethos will confirm <span className="font-medium">one</span> of them.
        </div>
      )}
      {request.requestNote && (
        <div className="mt-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">Note from Cethos: {request.requestNote}</div>
      )}

      {(pending.length > 0 || reviewed.length > 0) && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Your proposed times</div>
          <ul className="space-y-1">
            {[...pending, ...reviewed].map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
                <span className="flex-1">{fmtProposal(p)}</span>
                {p.status === "pending" && (
                  <>
                    <span className="text-xs text-amber-600">Awaiting Cethos review</span>
                    <button onClick={() => withdraw(p.id)} disabled={busy === p.id} title="Withdraw this proposed time" className="text-gray-400 hover:text-red-600">
                      {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
                {p.status === "approved" && <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Approved — session booked in</span>}
                {p.status === "rejected" && <span className="text-xs text-red-600" title={p.reviewNote || undefined}>Not used{p.reviewNote ? `: ${p.reviewNote}` : ""}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{accepted ? "Add more times" : "Apply & propose your times"}</div>
        {minSessions > 0 && (
          <div className="mb-2 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            This is a 1-to-1 study for <span className="font-medium">{minSessions} participant{minSessions === 1 ? "" : "s"}</span> — please offer at least <span className="font-medium">{minSessions} session times</span> (one per participant).{existingLive > 0 ? ` You've proposed ${existingLive} so far.` : ""}
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500">Your timezone:</span>
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1">
            {[...new Set([tz, browserTz, ...tzOptions])].map((z) => <option key={z}>{z}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Your hourly rate<span className="text-red-500">*</span>:</span>
          <input
            type="number" min={0} step="1" inputMode="decimal" required
            value={rate} onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. 120"
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-28"
          />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <span className="text-xs text-gray-400">per hour · saved to your profile</span>
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="date" value={r.date} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <input type="time" value={r.time} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <span className="text-xs text-gray-400">{isFocus ? `${durLabel(request.durationMinutes)} group session` : `each session ${durLabel(request.durationMinutes)}`}</span>
              {rows.length > 1 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
        {rows.length < 10 && (
          <button onClick={() => setRows([...rows, { date: rows[rows.length - 1]?.date || "", time: "10:00" }])} className="mt-1.5 text-xs text-teal-700 hover:underline">+ add another time</button>
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note for the Cethos team (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2" />
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        <div className="flex items-center justify-between mt-2">
          {!declining ? (
            <button onClick={() => setDeclining(true)} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600">
              <XCircle className="w-3.5 h-3.5" /> Decline this offer
            </button>
          ) : <span />}
          <button onClick={submit} disabled={busy === "submit"} className="inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700 disabled:opacity-50">
            {busy === "submit" && <Loader2 className="w-4 h-4 animate-spin" />} {accepted ? "Submit times" : "Apply and Submit times"}
          </button>
        </div>
        {declining && (
          <div className="mt-2 border border-red-200 bg-red-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-2">Let Cethos know you can't take this — they'll assign another moderator. Your pending proposed times are withdrawn.</p>
            <input value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} maxLength={500} placeholder="Reason (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeclining(false)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-white">Cancel</button>
              <button onClick={decline} disabled={busy === "decline"} className="inline-flex items-center gap-1.5 text-sm bg-red-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-red-700 disabled:opacity-50">
                {busy === "decline" && <Loader2 className="w-4 h-4 animate-spin" />} Confirm — can't take it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
