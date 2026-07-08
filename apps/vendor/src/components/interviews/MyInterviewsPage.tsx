// Moderator console — a vendor who moderates research-panel interviews sees
// their sessions here, marks a session complete (attended / no-show), and rates
// each participant. Completing triggers the participant payment + feedback
// emails on the CETHOS side.

import { useCallback, useEffect, useState } from "react";
import { Loader2, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getMyInterviews,
  completeInterview,
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

function SessionCard({ session, busy, onComplete }: {
  session: InterviewSession;
  busy: boolean;
  onComplete: (results: { invitationId: string; attended: boolean; rating?: number | null; comments?: string | null }[]) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
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
        <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Users className="w-4 h-4" /> {confirmed.length}</span>
      </div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700">
          <CheckCircle2 className="w-4 h-4" /> Mark complete & rate
        </button>
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
            <button onClick={() => setOpen(false)} disabled={busy} className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50">Cancel</button>
            <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-teal-700 disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Complete session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
