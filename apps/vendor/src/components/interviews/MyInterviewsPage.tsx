// Moderator console — a vendor who moderates research-panel interviews sees
// their sessions here, marks a session complete (attended / no-show), and rates
// each participant. Completing triggers the participant payment + feedback
// emails on the CETHOS side.
//
// Phase 6: the moderator can also message booked participants before the
// session (blinded relay — Cethos emails them; no contact info is shown here
// and replies go to Cethos staff), and sees the session's meeting link.

import { useCallback, useEffect, useState } from "react";
import { Loader2, CalendarClock, CheckCircle2, Users, MessageSquare, Video } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getMyInterviews,
  completeInterview,
  messageParticipants,
  type InterviewSession,
  type InterviewParticipant,
} from "../../api/vendorInterviews";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function MyInterviewsPage() {
  const { sessionToken } = useVendorAuth();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setSessions(await getMyInterviews(sessionToken));
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
        <p className="text-sm text-gray-500">Run your session, then mark it complete and rate each participant.</p>
      </div>

      {sessions.length === 0 && (
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
                onMessage={async (message, invitationIds) => {
                  const r = await messageParticipants(sessionToken!, s.slotId, message, invitationIds);
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
  onMessage: (message: string, invitationIds?: string[]) => Promise<{ success: boolean; sent?: number; error?: string }>;
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
        <MessageComposer participants={confirmed} messages={session.messages}
          onCancel={() => setPanel(null)}
          onSend={async (message, invitationIds) => {
            const r = await onMessage(message, invitationIds);
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
function MessageComposer({ participants, messages, onCancel, onSend }: {
  participants: InterviewParticipant[];
  messages: InterviewSession["messages"];
  onCancel: () => void;
  onSend: (message: string, invitationIds?: string[]) => Promise<{ success: boolean; sent?: number; error?: string }>;
}) {
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(participants.map((p) => p.invitationId)));
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
    if (!message.trim() || selected.size === 0) return;
    setSending(true);
    setError(null);
    const all = selected.size === participants.length;
    const r = await onSend(message.trim(), all ? undefined : [...selected]);
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
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{message.length}/2000</span>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={sending} className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50">Cancel</button>
          <button onClick={send} disabled={sending || !message.trim() || selected.size === 0}
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
