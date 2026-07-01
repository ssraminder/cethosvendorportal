import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getCapaActions,
  acknowledgeEscalation,
  submitEscalationResponse,
  type VendorEscalation,
} from "../../api/vendorCapaActions";
import { ShieldAlert, Loader2, ClipboardCheck, Upload, CheckCircle2, RotateCcw } from "lucide-react";

const SEVERITY_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-red-100", text: "text-red-700", label: "Critical" },
  major: { bg: "bg-orange-100", text: "text-orange-700", label: "Major" },
  minor: { bg: "bg-amber-100", text: "text-amber-700", label: "Minor" },
  observation: { bg: "bg-gray-100", text: "text-gray-600", label: "Observation" },
};

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  awaiting_ack: { bg: "bg-amber-100", text: "text-amber-700", label: "Action needed" },
  acknowledged: { bg: "bg-blue-100", text: "text-blue-700", label: "Acknowledged" },
  returned: { bg: "bg-red-100", text: "text-red-700", label: "Returned — revise" },
};

function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, overdue: true };
  if (days === 0) return { text: "Due today", overdue: true };
  return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, overdue: false };
}

export function QualityActionsList() {
  const { sessionToken } = useVendorAuth();
  const [items, setItems] = useState<VendorEscalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await getCapaActions(sessionToken);
      if (res.success) {
        setItems(res.escalations || []);
      } else {
        setError(res.error || "Failed to load quality actions");
      }
    } catch {
      setError("Failed to load quality actions");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-teal-600" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Quality Actions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Corrective actions Cethos has raised to you. For each, acknowledge it and provide the root
            cause plus your corrective and preventive action. This is part of our ISO 17100 quality process.
          </p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No open quality actions</p>
          <p className="text-sm">When Cethos asks you to respond to a quality issue, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((esc) => (
            <EscalationCard
              key={esc.id}
              esc={esc}
              open={openFor === esc.id}
              onToggle={() => setOpenFor(openFor === esc.id ? null : esc.id)}
              onChanged={() => {
                setOpenFor(null);
                load();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EscalationCard({
  esc,
  open,
  onToggle,
  onChanged,
}: {
  esc: VendorEscalation;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const { sessionToken } = useVendorAuth();
  const sev = esc.severity ? SEVERITY_BADGES[esc.severity] : null;
  const status = STATUS_BADGES[esc.status] || STATUS_BADGES.awaiting_ack;
  const due = dueLabel(esc.response_due);
  const canAcknowledge = esc.status === "awaiting_ack" || esc.status === "returned";

  const [ackBusy, setAckBusy] = useState(false);
  const [rootCause, setRootCause] = useState(esc.root_cause || "");
  const [corrective, setCorrective] = useState(esc.corrective_action || "");
  const [preventive, setPreventive] = useState(esc.preventive_action || "");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  async function acknowledge() {
    if (!sessionToken) return;
    setAckBusy(true);
    try {
      const res = await acknowledgeEscalation(sessionToken, esc.id);
      if (res.success) onChanged();
      else setFormError(res.error || "Failed to acknowledge");
    } catch {
      setFormError("Failed to acknowledge");
    } finally {
      setAckBusy(false);
    }
  }

  async function submit() {
    if (!sessionToken) return;
    setFormError("");
    if (!rootCause.trim()) return setFormError("Root cause is required.");
    if (!corrective.trim()) return setFormError("Corrective action is required.");
    setSubmitting(true);
    try {
      const res = await submitEscalationResponse(sessionToken, {
        escalationId: esc.id,
        rootCause: rootCause.trim(),
        correctiveAction: corrective.trim(),
        preventiveAction: preventive.trim() || undefined,
        file,
      });
      if (res.success) onChanged();
      else setFormError(res.error || "Failed to submit response");
    } catch {
      setFormError("Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{esc.nc_number}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            {sev && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.text}`}>{sev.label}</span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-gray-800">{esc.nc_title}</p>
          {due && (
            <p className={`mt-0.5 text-xs font-medium ${due.overdue ? "text-red-600" : "text-gray-500"}`}>{due.text}</p>
          )}
        </div>
        <div className="shrink-0">
          <button
            onClick={onToggle}
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {open ? "Close" : "Respond"}
          </button>
        </div>
      </div>

      {/* What Cethos is asking for */}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">What we need</p>
        <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{esc.ask}</p>
      </div>

      {/* Staff returned a prior response for revision */}
      {esc.status === "returned" && esc.review_note && (
        <div className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-4 py-3">
          <RotateCcw className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-700">Returned for revision</p>
            <p className="text-sm text-red-700 whitespace-pre-wrap">{esc.review_note}</p>
          </div>
        </div>
      )}

      {esc.acknowledged_at && esc.status !== "returned" && (
        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          Acknowledged on {new Date(esc.acknowledged_at).toLocaleDateString("en-CA")}.
        </div>
      )}

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {canAcknowledge && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <span className="text-sm text-gray-600">
                {esc.status === "returned"
                  ? "Re-acknowledge before submitting your revised response."
                  : "Acknowledge that you have received this quality action."}
              </span>
              <button
                onClick={acknowledge}
                disabled={ackBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
              >
                {ackBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Acknowledge
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Root cause <span className="text-red-500">(required)</span>
            </label>
            <textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              rows={3}
              placeholder="What was the underlying cause of the issue?"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Corrective action <span className="text-red-500">(required)</span>
            </label>
            <textarea
              value={corrective}
              onChange={(e) => setCorrective(e.target.value)}
              rows={3}
              placeholder="What did you do to fix this specific issue?"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Preventive action <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={preventive}
              onChange={(e) => setPreventive(e.target.value)}
              rows={2}
              placeholder="What will you change so it doesn't happen again?"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Evidence <span className="text-gray-400">(optional, max 10 MB)</span>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 cursor-pointer hover:border-teal-400">
              <Upload className="h-4 w-4 text-gray-400" />
              <span className="truncate">{file ? file.name : "Attach a document (PDF / image)…"}</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf,image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={onToggle} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !rootCause.trim() || !corrective.trim()}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit response
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
