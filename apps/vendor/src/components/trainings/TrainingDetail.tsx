import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getTrainingDetail, markTrainingComplete, type TrainingLesson } from "../../api/vendorTrainings";
import { LessonBlocks, type Block } from "./LessonBlocks";

// Lightweight markdown → HTML fallback for lessons without content_blocks.
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
  const [step, setStep] = useState(0);

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

  function go(next: number) {
    const clamped = Math.max(0, Math.min(lessons.length - 1, next));
    setStep(clamped);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const lesson = lessons[step];
  const isLast = step === lessons.length - 1;
  const blocks = Array.isArray(lesson?.content_blocks) ? (lesson!.content_blocks as Block[]) : null;

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
          <p className="text-sm text-gray-500 mt-1">{training?.description}</p>

          {completed && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="w-4 h-4" /> You've completed this training.
            </div>
          )}

          {lessons.length > 0 && (
            <>
              <div className="mt-5 mb-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>Step {step + 1} of {lessons.length}</span>
                  <span className="truncate pl-3">{lesson?.title}</span>
                </div>
                <div className="flex gap-1.5">
                  {lessons.map((l, i) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => go(i)}
                      aria-label={`Step ${i + 1}: ${l.title}`}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-teal-500" : "bg-gray-200"}`}
                    />
                  ))}
                </div>
              </div>

              {lesson && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                  <h2 className="font-semibold text-gray-900 mb-3">{step + 1}. {lesson.title}</h2>
                  {blocks && blocks.length > 0 ? (
                    <LessonBlocks blocks={blocks} />
                  ) : (
                    <div
                      className="prose prose-sm max-w-none text-gray-600 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.body_markdown) }}
                    />
                  )}
                  {Array.isArray(lesson.key_rules) && lesson.key_rules.length > 0 && (
                    <div className="mt-3 rounded-lg bg-teal-50 border border-teal-100 p-3">
                      <div className="text-xs font-semibold text-teal-800 uppercase tracking-wide mb-1">Key rules</div>
                      <ul className="list-disc ml-5 text-sm text-teal-900 space-y-0.5">
                        {lesson.key_rules.map((r, k) => <li key={k}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => go(step - 1)}
                  disabled={step === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>

                {!isLast ? (
                  <button
                    type="button"
                    onClick={() => go(step + 1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
                  >
                    Next <ArrowRight className="w-4 h-4" />
                  </button>
                ) : completed ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Mark as complete
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
