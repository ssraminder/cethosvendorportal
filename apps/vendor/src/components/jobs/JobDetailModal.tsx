import { useState } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getSourceFiles, type VendorStep } from "../../api/vendorJobs";
import { LANGUAGES } from "../../data/languages";
import { AcceptConfirmModal, DeclineModal, DeliverModal } from "./JobActionModals";
import {
  X,
  Clock,
  Download,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

function getLanguageName(code: string | null): string {
  if (!code) return "—";
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  offered: { bg: "bg-amber-100", text: "text-amber-700", label: "Offered" },
  accepted: { bg: "bg-blue-100", text: "text-blue-700", label: "Accepted" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress" },
  delivered: { bg: "bg-purple-100", text: "text-purple-700", label: "Delivered" },
  revision_requested: { bg: "bg-orange-100", text: "text-orange-700", label: "Revision Requested" },
  approved: { bg: "bg-green-100", text: "text-green-700", label: "Approved" },
  completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
};

function formatRelativeDeadline(deadline: string): { text: string; urgent: boolean } {
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (diff < 0) {
    return { text: days > 0 ? `overdue by ${days}d ${hours % 24}h` : `overdue by ${hours}h`, urgent: true };
  }
  if (hours < 24) return { text: `in ${hours}h`, urgent: true };
  if (days < 3) return { text: `in ${days}d ${hours % 24}h`, urgent: true };
  return { text: `in ${days} days`, urgent: false };
}

interface JobDetailModalProps {
  step: VendorStep;
  onClose: () => void;
  onAction: () => void;
}

export function JobDetailModal({ step, onClose, onAction }: JobDetailModalProps) {
  const { sessionToken } = useVendorAuth();
  const [actionModal, setActionModal] = useState<"accept" | "decline" | "deliver" | null>(null);
  const [downloadingSource, setDownloadingSource] = useState(false);

  const badge = STATUS_BADGES[step.status] ?? STATUS_BADGES.offered;
  const canDeliver = ["accepted", "in_progress", "revision_requested"].includes(step.status);
  const isRevision = step.status === "revision_requested";
  const customerFirst = step.customer_name?.split(" ")[0] ?? null;

  const currency = step.vendor_currency || "CAD";
  const fmt = (val: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(val);

  const handleDownloadSource = async () => {
    if (!sessionToken) return;
    setDownloadingSource(true);
    try {
      const result = await getSourceFiles(sessionToken, step.id);
      if (result.signed_urls) {
        for (const file of result.signed_urls) {
          window.open(file.url, "_blank");
        }
      }
    } catch {
      // silent
    } finally {
      setDownloadingSource(false);
    }
  };

  const handleActionSuccess = () => {
    setActionModal(null);
    onAction();
  };

  // Timeline entries
  const timeline: { label: string; date: string }[] = [];
  if (step.offered_at) timeline.push({ label: "Offered", date: step.offered_at });
  if (step.accepted_at) timeline.push({ label: "Accepted", date: step.accepted_at });
  if (step.started_at) timeline.push({ label: "Started", date: step.started_at });
  if (step.delivered_at) timeline.push({ label: "Delivered", date: step.delivered_at });
  if (step.approved_at) timeline.push({ label: "Approved", date: step.approved_at });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Step {step.step_number}: {step.name}
                </h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </div>
              {step.order_number && (
                <p className="text-sm text-gray-500 mt-0.5">Order #{step.order_number}</p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
            {/* Order info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {customerFirst && (
                <div>
                  <span className="text-gray-500">Customer</span>
                  <p className="font-medium text-gray-900">{customerFirst}</p>
                </div>
              )}
              {step.service_name && (
                <div>
                  <span className="text-gray-500">Service</span>
                  <p className="font-medium text-gray-900">{step.service_name}</p>
                </div>
              )}
              {(step.source_language || step.target_language) && (
                <div>
                  <span className="text-gray-500">Language Pair</span>
                  <p className="font-medium text-gray-900">
                    {getLanguageName(step.source_language)} → {getLanguageName(step.target_language)}
                  </p>
                </div>
              )}
            </div>

            {/* Rate */}
            {step.vendor_rate != null && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Rate</span>
                  <p className="font-medium text-gray-900">
                    {fmt(step.vendor_rate)} / {step.vendor_rate_unit?.replace("_", " ") ?? "unit"}
                  </p>
                </div>
                {step.vendor_total != null && (
                  <div>
                    <span className="text-gray-500">Total</span>
                    <p className="font-medium text-teal-700">{fmt(step.vendor_total)}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Currency</span>
                  <p className="font-medium text-gray-900">{currency}</p>
                </div>
              </div>
            )}

            {/* Deadline */}
            {step.deadline && (
              <div className="text-sm">
                <span className="text-gray-500">Deadline</span>
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  {new Date(step.deadline).toLocaleDateString("en-CA", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {(() => {
                    const rel = formatRelativeDeadline(step.deadline);
                    return (
                      <span className={`text-xs ${rel.urgent ? "text-red-600 font-medium" : "text-gray-500"}`}>
                        ({rel.text})
                      </span>
                    );
                  })()}
                </p>
              </div>
            )}

            {/* Instructions */}
            {step.instructions && (
              <div>
                <span className="text-sm text-gray-500">Instructions</span>
                <div className="mt-1 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {step.instructions}
                </div>
              </div>
            )}

            {/* Rejection reason */}
            {step.rejection_reason && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-1">Revision Feedback</p>
                    <p className="text-sm text-amber-800 whitespace-pre-wrap">{step.rejection_reason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Source files */}
            {step.source_file_paths && step.source_file_paths.length > 0 && (
              <div>
                <span className="text-sm text-gray-500">Source Files</span>
                <div className="mt-1 space-y-1">
                  {step.source_file_paths.map((path, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="h-4 w-4 text-gray-400" />
                      {path.split("/").pop()}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleDownloadSource}
                  disabled={downloadingSource}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium disabled:opacity-50"
                >
                  {downloadingSource ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download Source Files
                </button>
              </div>
            )}

            {/* Delivered files */}
            {step.delivered_file_paths && step.delivered_file_paths.length > 0 && (
              <div>
                <span className="text-sm text-gray-500">Delivered Files</span>
                <div className="mt-1 space-y-1">
                  {step.delivered_file_paths.map((path, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="h-4 w-4 text-gray-400" />
                      {path.split("/").pop()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revision count */}
            {step.revision_count > 0 && (
              <p className="text-sm text-gray-500">
                Revisions: <span className="font-medium text-gray-900">{step.revision_count}</span>
              </p>
            )}

            {/* Timeline */}
            {timeline.length > 0 && (
              <div>
                <span className="text-sm text-gray-500">Timeline</span>
                <div className="mt-1 space-y-1">
                  {timeline.map((t) => (
                    <div key={t.label} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-teal-500" />
                      <span className="text-gray-500 w-20">{t.label}</span>
                      <span className="text-gray-700">
                        {new Date(t.date).toLocaleString("en-CA", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Awaiting review badge */}
            {step.status === "delivered" && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">Awaiting review</span>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
            {step.status === "offered" && (
              <>
                <button
                  onClick={() => setActionModal("decline")}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  Decline
                </button>
                <button
                  onClick={() => setActionModal("accept")}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                >
                  Accept
                </button>
              </>
            )}
            {canDeliver && (
              <button
                onClick={() => setActionModal("deliver")}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                  isRevision
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-teal-600 hover:bg-teal-700"
                }`}
              >
                {isRevision ? "Deliver Revision" : "Deliver"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {actionModal === "accept" && (
        <AcceptConfirmModal step={step} onClose={() => setActionModal(null)} onSuccess={handleActionSuccess} />
      )}
      {actionModal === "decline" && (
        <DeclineModal step={step} onClose={() => setActionModal(null)} onSuccess={handleActionSuccess} />
      )}
      {actionModal === "deliver" && (
        <DeliverModal step={step} onClose={() => setActionModal(null)} onSuccess={handleActionSuccess} />
      )}
    </>
  );
}
