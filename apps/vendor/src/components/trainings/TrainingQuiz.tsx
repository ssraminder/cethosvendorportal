import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getTrainingQuiz,
  gradeTraining,
  type GradeResult,
  type QuizQuestion,
} from "../../api/vendorTrainings";

const LETTERS = ["a", "b", "c", "d"] as const;

// The knowledge check for a quiz-enabled training. Loads answer-free questions,
// collects answers, grades server-side, and shows the result. A passing score
// records completion (bubbled up via onPassed); a failing score can be retaken.
export function TrainingQuiz({
  trainingId,
  onPassed,
}: {
  trainingId: string;
  onPassed: () => void;
}) {
  const { sessionToken } = useVendorAuth();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [threshold, setThreshold] = useState(80);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTrainingQuiz(sessionToken, trainingId);
      if (!res.success) throw new Error(res.error || "Failed to load the knowledge check");
      setQuestions(res.questions ?? []);
      setThreshold(res.threshold ?? 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the knowledge check");
    }
    setLoading(false);
  }, [sessionToken, trainingId]);

  useEffect(() => {
    load();
  }, [load]);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const wrongById = useMemo(() => {
    const m = new Set<string>();
    (result?.results ?? []).forEach((r) => {
      if (!r.is_correct) m.add(r.id);
    });
    return m;
  }, [result]);

  async function handleSubmit() {
    if (!sessionToken || !allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await gradeTraining(sessionToken, trainingId, answers);
      if (!res.success || !res.data) throw new Error(res.error || "Grading failed");
      setResult(res.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (res.data.passed) onPassed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grading failed");
    }
    setSubmitting(false);
  }

  function retake() {
    setResult(null);
    setAnswers({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (error && questions.length === 0) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const passed = result?.passed === true;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5">
          Knowledge check
        </span>
        <span className="text-xs text-gray-500">Pass mark {threshold}%</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Answer all {questions.length} questions, then submit. You need {threshold}% to pass — you can retake it if needed.
      </p>

      {result && (
        <div
          className={`mb-4 rounded-lg border p-4 ${
            passed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {passed ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-green-800">Passed — {result.score}%</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-amber-600" />
                <span className="text-amber-800">Not passed — {result.score}%</span>
              </>
            )}
          </div>
          <p className={`text-sm mt-1 ${passed ? "text-green-700" : "text-amber-700"}`}>
            {result.correct} of {result.total} correct.{" "}
            {passed
              ? "Your completion has been recorded."
              : `You need ${result.threshold}% to pass. Review the questions marked below and try again.`}
          </p>
          {!passed && (
            <button
              type="button"
              onClick={retake}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
            >
              <RotateCcw className="w-4 h-4" /> Retake the check
            </button>
          )}
        </div>
      )}

      <div className="space-y-5">
        {questions.map((q, qi) => {
          const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
          const isWrong = result ? wrongById.has(q.id) : false;
          const correctOpt = result?.results.find((r) => r.id === q.id)?.correct_option;
          return (
            <div
              key={q.id}
              className={`rounded-lg border p-3 ${
                result ? (isWrong ? "border-amber-200 bg-amber-50/40" : "border-green-200 bg-green-50/40") : "border-gray-200"
              }`}
            >
              <p className="text-sm font-medium text-gray-900 mb-2">
                <span className="text-teal-600 font-semibold">Q{qi + 1}.</span> {q.question}
              </p>
              <div className="grid gap-2">
                {opts.map((text, oi) => {
                  if (text == null) return null;
                  const val = LETTERS[oi];
                  const selected = answers[q.id] === val;
                  const isCorrectChoice = result && correctOpt === val;
                  return (
                    <label
                      key={val}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        result
                          ? isCorrectChoice
                            ? "border-green-400 bg-green-50 text-green-900"
                            : selected
                              ? "border-amber-400 bg-amber-50 text-amber-900"
                              : "border-gray-200 text-gray-600"
                          : selected
                            ? "border-teal-500 bg-teal-50 text-teal-900"
                            : "border-gray-200 hover:border-teal-300 text-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={val}
                        checked={selected}
                        disabled={!!result}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: val }))}
                        className="mt-0.5"
                      />
                      <span className="font-semibold uppercase">{val})</span>
                      <span>{text}</span>
                      {result && isCorrectChoice && <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {!result && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            {answeredCount} of {questions.length} answered
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Submit answers
          </button>
        </div>
      )}
    </div>
  );
}
