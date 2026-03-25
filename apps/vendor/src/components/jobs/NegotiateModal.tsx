import { useState } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { submitCounterOffer, type VendorStep } from "../../api/vendorJobs";
import { X, Loader2, AlertTriangle } from "lucide-react";

const RATE_UNIT_OPTIONS = [
  { value: "per_word", label: "Per word" },
  { value: "per_page", label: "Per page" },
  { value: "per_hour", label: "Per hour" },
  { value: "flat_rate", label: "Flat rate" },
];

interface NegotiateModalProps {
  job: VendorStep;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function NegotiateModal({ job, onClose, onSuccess }: NegotiateModalProps) {
  const { sessionToken } = useVendorAuth();

  const [counterRate, setCounterRate] = useState(
    job.vendor_rate != null ? String(job.vendor_rate) : ""
  );
  const [counterRateUnit, setCounterRateUnit] = useState(
    job.vendor_rate_unit ?? "per_word"
  );
  const [counterTotal, setCounterTotal] = useState(
    job.vendor_total != null ? String(job.vendor_total) : ""
  );
  const [counterCurrency] = useState(job.vendor_currency || "CAD");
  const [counterDeadline, setCounterDeadline] = useState(
    job.deadline ? job.deadline.slice(0, 10) : ""
  );
  const [counterNote, setCounterNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!sessionToken || !job.offer_id) return;
    setSubmitting(true);
    setError("");

    try {
      const { status, data } = await submitCounterOffer(sessionToken, {
        offer_id: job.offer_id,
        step_id: job.id,
        counter_rate: parseFloat(counterRate) || null,
        counter_rate_unit: counterRateUnit,
        counter_total: parseFloat(counterTotal) || null,
        counter_currency: counterCurrency,
        counter_deadline: counterDeadline || null,
        counter_note: counterNote,
      });

      if (status === 403) {
        onSuccess("Negotiation is not available for this offer.");
        onClose();
        return;
      }

      if (status === 410) {
        onSuccess("This offer has expired.");
        onClose();
        return;
      }

      if (status === 409) {
        setError("You already have a pending counter-proposal.");
        return;
      }

      if (!data.success) {
        setError(data.error || "Failed to submit counter-proposal");
        return;
      }

      if (data.auto_accepted) {
        onSuccess("Your proposal has been accepted! You can now accept the revised offer.");
      } else {
        onSuccess("Counter-proposal submitted. The PM will review it.");
      }
      onClose();
    } catch {
      setError("Failed to submit counter-proposal");
    } finally {
      setSubmitting(false);
    }
  };

  const currency = job.vendor_currency || "CAD";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Negotiate Terms</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600">
            Propose different terms for{" "}
            <span className="font-medium text-gray-900">{job.name}</span>{" "}
            (Order #{job.order_number}). The project manager will review your proposal.
          </p>

          {/* Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proposed Rate ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={counterRate}
                onChange={(e) => setCounterRate(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rate Unit
              </label>
              <select
                value={counterRateUnit}
                onChange={(e) => setCounterRateUnit(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {RATE_UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Total */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proposed Total ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={counterTotal}
              onChange={(e) => setCounterTotal(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proposed Deadline
            </label>
            <input
              type="date"
              value={counterDeadline}
              onChange={(e) => setCounterDeadline(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (optional)
            </label>
            <textarea
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              placeholder="Explain your reasoning..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (!counterRate && !counterTotal && !counterDeadline)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Proposal
          </button>
        </div>
      </div>
    </div>
  );
}
