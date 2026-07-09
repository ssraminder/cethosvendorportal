// Moderator console — a vendor who moderates research-panel interviews sees
// their sessions here, marks a session complete (attended / no-show), and rates
// each participant. Completing triggers the participant payment + feedback
// emails on the CETHOS side.
//
// Phase 6: the moderator can also message booked participants before the
// session (blinded relay — Cethos emails them; no contact info is shown here
// and replies go to Cethos staff), and sees the session's meeting link.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, CalendarClock, CheckCircle2, Users, MessageSquare, Video, FileText, CalendarPlus, Trash2, XCircle } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getMyInterviews,
  completeInterview,
  messageParticipants,
  proposeTimes,
  withdrawProposal,
  declineAvailability,
  type InterviewSession,
  type InterviewParticipant,
  type AvailabilityRequest,
} from "../../api/vendorInterviews";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function MyInterviewsPage() {
  const { sessionToken } = useVendorAuth();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [availabilityRequests, setAvailabilityRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    const data = await getMyInterviews(sessionToken);
    setSessions(data.sessions);
    setAvailabilityRequests(data.availabilityRequests);
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const upcoming = sessions.filter((s) => s.canComplete);
  const completed = sessions.filter((s) => s.isCompleted);

  if (loading)
    return <div className="flex items-center justify-center py-24 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your sessions…</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarClock className="w-6 h-6 text-teal-600" /> My interviews</h1>
        <p className="text-sm text-gray-500">Propose times for new studies, run your sessions, then mark them complete and rate each participant.</p>
      </div>

      {availabilityRequests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Availability requested</h2>
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

function SessionCard({ session, busy, onComplete, onMessage }: {
  session: InterviewSession;
  busy: boolean;
  onComplete: (results: { invitationId: string; attended: boolean; rating?: number | null; comments?: string | null }[]) => Promise<boolean>;
  onMessage: (message: string, invitationIds?: string[], attachPaths?: string[]) => Promise<{ success: boolean; sent?: number; error?: string }>;
}) {
  const [panel, setPanel] = useState<null | "complete" | "message">(null);
  const confirmed = session.participants.filter((p) => p.status === "confirmed");
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
          <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Users className="w-4 h-4" /> {confirmed.length}</span>
        </div>
      </div>
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
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setPanel("complete")} className="inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700">
            <CheckCircle2 className="w-4 h-4" /> Mark complete & rate
          </button>
          {session.canMessage && (
            <button onClick={() => setPanel("message")} className="inline-flex items-center gap-1.5 text-sm border border-teal-600 text-teal-700 rounded-lg px-3 py-2 font-medium hover:bg-teal-50">
              <MessageSquare className="w-4 h-4" /> Message participants
            </button>
          )}
        </div>
      ) : panel === "message" ? (
        <MessageComposer participants={confirmed} messages={session.messages} files={session.files}
          onCancel={() => setPanel(null)}
          onSend={async (message, invitationIds, attachPaths) => {
            const r = await onMessage(message, invitationIds, attachPaths);
            if (r.success) setPanel(null);
            return r;
          }} />
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

// Blinded compose panel: the message goes out as an email from the Cethos
// Research Panel address — the moderator never sees participant contact info
// and participant replies land with Cethos staff, who forward them.
function MessageComposer({ participants, messages, files, onCancel, onSend }: {
  participants: InterviewParticipant[];
  messages: InterviewSession["messages"];
  files: InterviewSession["files"];
  onCancel: () => void;
  onSend: (message: string, invitationIds?: string[], attachPaths?: string[]) => Promise<{ success: boolean; sent?: number; error?: string }>;
}) {
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(participants.map((p) => p.invitationId)));
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if ((!message.trim() && attached.size === 0) || selected.size === 0) return;
    setSending(true);
    setError(null);
    const all = selected.size === participants.length;
    const r = await onSend(message.trim(), all ? undefined : [...selected], attached.size ? [...attached] : undefined);
    setSending(false);
    if (!r.success) setError(r.error || "Failed to send");
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
        Your message is sent to the selected participants <span className="font-medium">by email from the Cethos Research Panel</span>.
        You won't see their contact details, and their replies go to the Cethos team, who will forward them to you.
      </div>
      <div className="flex flex-wrap gap-2">
        {participants.map((p) => (
          <label key={p.invitationId} className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={selected.has(p.invitationId)} onChange={() => toggle(p.invitationId)} />
            {p.name}
          </label>
        ))}
      </div>
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
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{message.length}/2000</span>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={sending} className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50">Cancel</button>
          <button onClick={send} disabled={sending || (!message.trim() && attached.size === 0) || selected.size === 0}
            className="inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700 disabled:opacity-50">
            {sending && <Loader2 className="w-4 h-4 animate-spin" />} Send to {selected.size} participant{selected.size === 1 ? "" : "s"}
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
  const [rows, setRows] = useState<{ date: string; time: string }[]>([{ date: "", time: "10:00" }]);
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

  const fmtProposal = (p: { startAt: string; timezone: string }) => {
    try {
      return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: p.timezone }).format(new Date(p.startAt)) + ` (${p.timezone})`;
    } catch { return fmt(p.startAt); }
  };

  async function submit() {
    const filled = rows.filter((r) => r.date && r.time);
    if (!filled.length) { setError("Add at least one date and time"); return; }
    setBusy("submit"); setError(null);
    const r = await proposeTimes(token, request.studyId, tz, filled, note.trim() || undefined);
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
    const r = await declineAvailability(token, request.studyId, declineNote.trim() || undefined);
    setBusy(null);
    if (!r.success) { setError(r.error || "Failed"); return; }
    await onChanged();
  }

  return (
    <div className="bg-white border border-teal-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">{request.studyCode}</div>
          <div className="text-xs text-gray-500">
            {durLabel(request.durationMinutes)} per session{request.targetLocale ? ` · ${langName(request.targetLocale)}` : ""}{request.meetingPlatform ? ` · ${request.meetingPlatform}` : ""} · requested {fmt(request.requestedAt)}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
          <CalendarPlus className="w-3.5 h-3.5" /> Times needed
        </span>
      </div>
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
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Propose times that work for you</div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500">Your timezone:</span>
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1">
            {[...new Set([tz, browserTz, ...tzOptions])].map((z) => <option key={z}>{z}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="date" value={r.date} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <input type="time" value={r.time} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <span className="text-xs text-gray-400">each session {durLabel(request.durationMinutes)}</span>
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
              <XCircle className="w-3.5 h-3.5" /> I can't take this study
            </button>
          ) : <span />}
          <button onClick={submit} disabled={busy === "submit"} className="inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700 disabled:opacity-50">
            {busy === "submit" && <Loader2 className="w-4 h-4 animate-spin" />} Submit times
          </button>
        </div>
        {declining && (
          <div className="mt-2 border border-red-200 bg-red-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-2">Let Cethos know you can't moderate this study — they'll assign someone else. Your pending proposed times are withdrawn.</p>
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
