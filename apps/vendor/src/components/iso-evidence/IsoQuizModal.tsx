/**
 * IsoQuizModal
 *
 * Modal-style runner for ISO 17100 competence MCQ quizzes. Opens
 * inside /iso-evidence/:token when the vendor clicks "Take quiz" on
 * a kind=quiz request item.
 *
 * Flow:
 *   1. Fetch 8 random questions for the slug's competence.
 *   2. Vendor answers one at a time (single-page form with all
 *      questions visible — short quiz, no need to paginate).
 *   3. Submit → server auto-grades and either completes the slug
 *      (passed ≥ 80%) or stays pending (retake available).
 *   4. Result screen shows score + per-competence next step.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  X as XIcon,
  Award,
  RotateCw,
} from "lucide-react";
import {
  getIsoQuiz,
  submitIsoQuiz,
  type QuizQuestion,
} from "../../api/isoQuiz";

interface Props {
  token: string;
  slug: string;
  label: string;
  onClose: () => void;
  onPassed: (score: number) => void;
}

interface LoadedQuiz {
  competence: string;
  domain: string | null;
  threshold_pct: number;
  questions: QuizQuestion[];
}

interface SubmitOutcome {
  score_pct: number;
  correct_count: number;
  total_count: number;
  threshold_pct: number;
  passed: boolean;
  attempt_number: number;
}

export function IsoQuizModal({ token, slug, label, onClose, onPassed }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<LoadedQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOutcome(null);
    setAnswers({});
    const r = await getIsoQuiz(token, slug);
    setLoading(false);
    if (!r.success) {
      setError(
        r.error === "no_questions_available"
          ? "We don't yet have a quiz for this competence. Please contact Cethos."
          : r.error === "slug_already_resolved"
          ? "This item is already resolved."
          : `Could not load the quiz (${r.error}).`,
      );
      return;
    }
    setQuiz({
      competence: r.data.competence,
      domain: r.data.domain,
      threshold_pct: r.data.threshold_pct,
      questions: r.data.questions,
    });
  }, [token, slug]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  async function handleSubmit() {
    if (!quiz) return;
    const missing = quiz.questions.filter((q) => !answers[q.id]);
    if (missing.length > 0) {
      setError(`Please answer all ${quiz.questions.length} questions — ${missing.length} still blank.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    const r = await submitIsoQuiz(token, slug, answers);
    setSubmitting(false);
    if (!r.success) {
      setError(`Could not submit (${r.error}).`);
      return;
    }
    setOutcome({
      score_pct: r.data.score_pct,
      correct_count: r.data.correct_count,
      total_count: r.data.total_count,
      threshold_pct: r.data.threshold_pct,
      passed: r.data.passed,
      attempt_number: r.data.attempt_number,
    });
    if (r.data.passed) onPassed(r.data.score_pct);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Competence quiz — {label}
            </h3>
            {quiz && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                {quiz.questions.length} questions · pass at {quiz.threshold_pct}%
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading quiz…
            </div>
          )}
          {error && !outcome && (
            <div className="mb-3 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
              {error}
            </div>
          )}

          {outcome && (
            <div className={`p-5 rounded-xl border ${outcome.passed ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
              <div className="flex items-start gap-3">
                {outcome.passed ? (
                  <Award className="w-7 h-7 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-7 h-7 text-amber-600 mt-0.5 shrink-0" />
                )}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {outcome.passed ? "Passed" : "Not yet"}
                  </h4>
                  <p className="text-sm text-gray-700 mt-1">
                    Score: <strong>{outcome.score_pct}%</strong> ({outcome.correct_count} of {outcome.total_count} correct).
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    {outcome.passed
                      ? "We've marked the corresponding item complete. Cethos will pick up the score on the next ISO assessment."
                      : `Threshold is ${outcome.threshold_pct}%. You can retake the quiz — different random questions are served each time.`}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-2">Attempt #{outcome.attempt_number}.</p>
                </div>
              </div>
            </div>
          )}

          {!outcome && quiz && quiz.questions.length > 0 && (
            <div className="space-y-5">
              {quiz.questions.map((q, idx) => (
                <fieldset key={q.id} className="border border-gray-200 rounded-lg p-4">
                  <legend className="px-1 text-sm font-medium text-gray-900">
                    {idx + 1}. {q.question}
                  </legend>
                  <div className="space-y-1.5 mt-2">
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                            selected
                              ? "bg-teal-50 border border-teal-200"
                              : "hover:bg-gray-50 border border-transparent"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.value}
                            checked={selected}
                            onChange={() => setAnswers((s) => ({ ...s, [q.id]: opt.value }))}
                            className="mt-0.5"
                          />
                          <span className="text-sm text-gray-800">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-100">
          {outcome ? (
            <>
              {!outcome.passed && (
                <button
                  type="button"
                  onClick={loadQuiz}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 border border-teal-300 rounded hover:bg-teal-50"
                >
                  <RotateCw className="w-4 h-4" /> Retake
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700"
              >
                {outcome.passed ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Done</span> : "Close"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || loading || !quiz}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
