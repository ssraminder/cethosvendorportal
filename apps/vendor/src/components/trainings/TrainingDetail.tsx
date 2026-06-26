import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getTrainingDetail, markTrainingComplete, type TrainingLesson } from "../../api/vendorTrainings";
import { LessonBlocks, type Block } from "./LessonBlocks";

// Lightweight markdown → HTML (mirrors the portal's TermsModal renderer).
function renderMarkdown(md: string): string {
  return (md || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1 text-gray-900">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mt-4 mb-2 text-gray-900">$1</h2>')
    .replace(/^\d+\.\s+(.+)$/gm, '<div class="ml-4 mb-1">• $1</div>')
    .replace(/^- (.+)$/gm, '<div class="ml-4 mb-1">• $1</div>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/^/, '<p class="mb-2">').replace(/$/, "</p>");
}

export function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const { sessionToken } = useVendorAuth();
  const [training, setTraining] = useState<{ title: string; description: string } | null>(null);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTrainingDetail(sessionToken, id);
      if (!res.success) throw new Error(res.error || "Failed to load training");
      setTraining(res.training ? { title: res.training.title, description: res.training.description } : null);
      setLessons(res.lessons ?? []);
      setCompleted(res.completed === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load training");
    }
    setLoading(false);
  }, [sessionToken, id]);

  useEffect(() => { load(); }, [load]);

  async function handleComplete() {
    if (!sessionToken || !id) return;
    setSaving(true);
    try {
      const res = await markTrainingComplete(sessionToken, id);
      if (!res.success) throw new Error(res.error || "Failed to record completion");
      setCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record completion");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Link to="/trainings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> All trainings
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-gray-900">{training?.title}</h1>
          <p className="text-sm text-gray-500 mt-1 mb-4">{training?.description}</p>

          {completed && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="w-4 h-4" /> You've completed this training.
            </div>
          )}

          <div className="space-y-4">
            {lessons.map((l, i) => (
              <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <h2 className="font-semibold text-gray-900 mb-2">{i + 1}. {l.title}</h2>
                {Array.isArray(l.content_blocks) && l.content_blocks.length > 0 ? (
                  <LessonBlocks blocks={l.content_blocks as Block[]} />
                ) : (
                  <div
                    className="prose prose-sm max-w-none text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(l.body_markdown) }}
                  />
                )}
                {Array.isArray(l.key_rules) && l.key_rules.length > 0 && (
                  <div className="mt-3 rounded-lg bg-teal-50 border border-teal-100 p-3">
                    <div className="text-xs font-semibold text-teal-800 uppercase tracking-wide mb-1">Key rules</div>
                    <ul className="list-disc ml-5 text-sm text-teal-900 space-y-0.5">
                      {l.key_rules.map((r, k) => <li key={k}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!completed && lessons.length > 0 && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-600">Confirm you've read and understood this training.</p>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark as complete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
