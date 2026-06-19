import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getTrainings, type TrainingSummary } from "../../api/vendorTrainings";

export function TrainingsList() {
  const { sessionToken } = useVendorAuth();
  const [items, setItems] = useState<TrainingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTrainings(sessionToken);
      if (!res.success) throw new Error(res.error || "Failed to load trainings");
      setItems(res.trainings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trainings");
    }
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const doneCount = items.filter((t) => t.completed).length;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-1">
        <GraduationCap className="w-6 h-6 text-teal-600" />
        <h1 className="text-xl font-semibold text-gray-900">Trainings</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Complete the trainings assigned to your specializations. Your completions are recorded for ISO 17100 / client audit purposes.
        {items.length > 0 && <span className="ml-1 font-medium text-gray-700">{doneCount}/{items.length} completed.</span>}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No trainings assigned yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <Link
              key={t.training_id}
              to={`/trainings/${t.training_id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-teal-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900">{t.title}</h2>
                    {t.completed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">To do</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-2">{t.lesson_count} lesson{t.lesson_count === 1 ? "" : "s"}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
