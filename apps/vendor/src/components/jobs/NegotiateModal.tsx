import { useState, useEffect } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { submitCounterOffer, type VendorStep } from "../../api/vendorJobs";
import { X, Loader2, AlertTriangle } from "lucide-react";

function generateTimeSlots(): Array<{ value: string; label: string }> {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (const m of ["00", "30"] as const) {
      const value = `${h.toString().padStart(2, "0")}:${m}`;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${m} ${ampm}`;
      slots.push({ value, label });
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

const unitLabel = (unit: string): string => {
  const map: Record<string, string> = {
    per_word: "word",
    per_page: "page",
    per_hour: "hour",
    flat: "flat",
    flat_rate: "flat",
  };
  return map[unit] || unit;
};

interface NegotiateModalProps {
  job: VendorStep;
  onClose: () => void;
  onSuccess: (message: string, autoAssigned?: boolean) => void;
}

export function NegotiateModal({ job, onClose, onSuccess }: NegotiateModalProps) {
  const { sessionToken } = useVendorAuth();

  // Derive units from original offer
  const originalRate = parseFloat(String(job.vendor_rate)) || 0;
  const originalTotal = parseFloat(String(job.vendor_total)) || 0;
  const rateUnit = job.vendor_rate_unit || "flat";
  const units = originalRate > 0 ? originalTotal / originalRate : 1;

  const [counterRate, setCounterRate] = useState(
    job.vendor_rate != null ? String(job.vendor_rate) : ""
  );
  const [counterCurrency] = useState(job.vendor_currency || "CAD");
  const [counterDeadlineDate, setCounterDeadlineDate] = useState("");
  const [counterDeadlineTime, setCounterDeadlineTime] = useState("");
  const [counterNote, setCounterNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Auto-calculate total
  const calculatedTotal = (parseFloat(counterRate) || 0) * units;

  const currency = job.vendor_currency || "CAD";

  // Pre-fill deadline from original offer
  useEffect(() => {
    if (job.deadline) {
      const d = new Date(job.deadline);
      setCounterDeadlineDate(d.toISOString().split("T")[0]);
      const hours = d.getHours().toString().padStart(2, "0");
      const mins = d.getMinutes() >= 30 ? "30" : "00";
      setCounterDeadlineTime(`${hours}:${mins}`);
    }
  }, [job.deadline]);

  const handleSubmit = async () => {
    if (!sessionToken || !job.offer_id) return;
    setSubmitting(true);
    setError("");

    // Combine date + time for deadline
    const counterDeadline = counterDeadlineDate && counterDeadlineTime
      ? new Date(`${counterDeadlineDate}T${counterDeadlineTime}:00`).toISOString()
      : counterDeadlineDate
        ? new Date(`${counterDeadlineDate}T23:59:00`).toISOString()
        : null;

    try {
      const { status, data } = await submitCounterOffer(sessionToken, {
        offer_id: job.offer_id,
        step_id: job.id,
        counter_rate: parseFloat(counterRate) || null,
        counter_rate_unit: rateUnit,
        counter_total: calculatedTotal,
        counter_currency: counterCurrency,
        counter_deadline: counterDeadline,
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

      if (data.auto_accepted && data.auto_assigned) {
        // Vendor is now fully assigned — job moves to Active tab
        onSuccess("Your proposal has been accepted! You are now assigned to this job.", true);
      } else if (data.auto_accepted) {
        // Fallback for edge case
        onSuccess("Your proposal has been accepted!");
      } else {
        // Queued for PM review
        onSuccess("Counter-proposal submitted. The PM will review it.");
      }
      onClose();
    } catch {
      setError("Failed to submit counter-proposal");
    } finally {
      setSubmitting(false);
    }
  };

  const formattedUnits = units % 1 === 0 ? units.toFixed(0) : units.toFixed(1);
  const unitStr = unitLabel(rateUnit);

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

          {/* Current Offer summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 mb-1">Current Offer</div>
            <div className="text-sm text-gray-800">
              ${originalRate}/{unitStr} × {formattedUnits} {unitStr}{units !== 1 ? "s" : ""} ={" "}
              <span className="font-semibold">{currency} ${originalTotal.toFixed(2)}</span>
            </div>
            {job.deadline && (
              <div className="text-sm text-gray-600 mt-1">
                Deadline: {new Date(job.deadline).toLocaleString()}
              </div>
            )}
          </div>

          {/* Rate input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Proposed Rate ({currency})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.001"
                min="0"
                value={counterRate}
                onChange={(e) => setCounterRate(e.target.value)}
                placeholder="0.00"
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-500">
                / {unitStr} × {formattedUnits} {unitStr}{units !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Auto-calculated total (read-only) */}
          <div className="text-sm">
            <span className="text-gray-500">Proposed Total: </span>
            <span className="font-semibold text-gray-800">
              {currency} ${calculatedTotal.toFixed(2)}
            </span>
            <span className="text-gray-400 text-xs ml-2">(auto-calculated)</span>
          </div>

          {/* Deadline with date + time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proposed Deadline
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={counterDeadlineDate}
                onChange={(e) => setCounterDeadlineDate(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <select
                value={counterDeadlineTime}
                onChange={(e) => setCounterDeadlineTime(e.target.value)}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Time</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (required)
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
            disabled={submitting || !counterRate || !counterNote}
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
