import { useState, useEffect } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getJobDetail,
  type VendorStep,
  type JobDetailResponse,
  type JobDetailFile,
} from "../../api/vendorJobs";
import { LANGUAGES } from "../../data/languages";
import { AcceptConfirmModal, DeclineModal, DeliverModal } from "./JobActionModals";
import {
  X,
  Clock,
  Download,
  FileText,
  AlertTriangle,
  Loader2,
  Calendar,
  Timer,
  BookOpen,
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(dateStr: string): { text: string; urgent: boolean; overdue: boolean } {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (diff < 0) {
    const label = days > 0 ? `overdue by ${days}d ${remainingHours}h` : `overdue by ${hours}h`;
    return { text: label, urgent: true, overdue: true };
  }
  if (hours < 24) return { text: `in ${hours}h`, urgent: true, overdue: false };
  if (days < 3) return { text: `in ${days}d ${remainingHours}h`, urgent: true, overdue: false };
  return { text: `in ${days} days`, urgent: false, overdue: false };
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

interface JobDetailModalProps {
  step: VendorStep;
  onClose: () => void;
  onAction: () => void;
}

export function JobDetailModal({ step, onClose, onAction }: JobDetailModalProps) {
  const { sessionToken } = useVendorAuth();
  const [actionModal, setActionModal] = useState<"accept" | "decline" | "deliver" | null>(null);
  const [detail, setDetail] = useState<JobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    async function fetchDetail() {
      setLoading(true);
      setFetchError("");
      try {
        const result = await getJobDetail(sessionToken!, step.id, step.offer_id ?? null);
        if (cancelled) return;
        if (result.error && !result.job) {
          setFetchError(result.error);
        } else {
          setDetail(result);
        }
      } catch {
        if (!cancelled) setFetchError("Failed to load job details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDetail();
    return () => { cancelled = true; };
  }, [sessionToken, step.id, step.offer_id]);

  const handleActionSuccess = () => {
    setActionModal(null);
    onAction();
  };

  const handleDownload = (file: JobDetailFile) => {
    window.open(file.download_url, "_blank");
  };

  // Use detail data when available, fall back to step data for header
  const job = detail?.job;
  const status = job?.status ?? step.status;
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.offered;
  const expired = isExpired(job?.expires_at ?? step.expires_at ?? null);
  const canDeliver = ["accepted", "in_progress", "revision_requested"].includes(status);
  const isRevision = status === "revision_requested";
  const canAccept = status === "offered" && !expired;

  const currency = job?.vendor_currency ?? step.vendor_currency ?? "CAD";
  const fmt = (val: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(val);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-gray-900">
                  Step {job?.step_number ?? step.step_number}: {job?.step_name ?? step.name}
                </h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
                {expired && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                    Expired
                  </span>
                )}
              </div>
              {job && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {job.workflow_position} &middot; {job.workflow_template}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : fetchError ? (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{fetchError}</span>
              </div>
            ) : job ? (
              <>
                {/* ORDER INFO */}
                <section className="rounded-lg border border-gray-200 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Order Info</h4>
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    <span className="text-gray-700">
                      Order <span className="font-medium text-gray-900">#{job.order_number}</span>
                    </span>
                    <span className="text-gray-400">&middot;</span>
                    <span className="text-gray-700">Service: <span className="font-medium text-gray-900">{job.service_name}</span></span>
                    {job.is_rush && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        RUSH ORDER
                      </span>
                    )}
                  </div>
                </section>

                {/* LANGUAGE & RATE */}
                <section className="rounded-lg border border-gray-200 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Language &amp; Rate</h4>
                  {(job.source_language || job.target_language) && (
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {getLanguageName(job.source_language)} &rarr; {getLanguageName(job.target_language)}
                    </p>
                  )}
                  {job.vendor_rate != null ? (
                    <div className="flex items-center gap-4 flex-wrap text-sm">
                      <span className="text-gray-700">
                        Rate: <span className="font-medium text-gray-900">{fmt(job.vendor_rate)} / {job.vendor_rate_unit?.replace("_", " ") ?? "unit"}</span>
                      </span>
                      {job.vendor_total != null && (
                        <span className="text-gray-700">
                          Total: <span className="font-semibold text-teal-700">{currency} {fmt(job.vendor_total)}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Rate to be discussed</p>
                  )}
                </section>

                {/* DEADLINE & TIMING */}
                <section className="rounded-lg border border-gray-200 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deadline &amp; Timing</h4>
                  <div className="space-y-1.5 text-sm">
                    {job.deadline && (() => {
                      const rel = formatRelativeTime(job.deadline);
                      return (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="text-gray-700">
                            Deadline: <span className="font-medium text-gray-900">{formatFullDate(job.deadline)}</span>
                          </span>
                          <span className={`text-xs font-medium ${rel.overdue ? "text-red-600" : rel.urgent ? "text-amber-600" : "text-gray-500"}`}>
                            ({rel.text})
                          </span>
                        </div>
                      );
                    })()}
                    {job.estimated_delivery_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-gray-700">
                          Est. delivery: <span className="font-medium text-gray-900">
                            {new Date(job.estimated_delivery_date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-gray-400 shrink-0" />
                      {job.expires_at ? (() => {
                        if (isExpired(job.expires_at)) {
                          return <span className="text-red-600 font-medium">Offer expired</span>;
                        }
                        const rel = formatRelativeTime(job.expires_at);
                        return (
                          <span className="text-gray-700">
                            Offer expires: <span className="font-medium text-gray-900">{formatFullDate(job.expires_at)}</span>
                            <span className={`ml-1 text-xs font-medium ${rel.urgent ? "text-amber-600" : "text-gray-500"}`}>
                              ({rel.text})
                            </span>
                          </span>
                        );
                      })() : (
                        <span className="text-gray-500">No expiry</span>
                      )}
                    </div>
                  </div>
                </section>

                {/* VOLUME */}
                {detail.volume && detail.volume.total_files > 0 && (
                  <section className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Volume</h4>
                    <p className="text-sm text-gray-700 mb-2">
                      {detail.volume.total_files} document{detail.volume.total_files !== 1 ? "s" : ""}
                      {detail.volume.total_word_count > 0 && <> &middot; {detail.volume.total_word_count.toLocaleString()} words</>}
                      {detail.volume.total_page_count > 0 && <> &middot; {detail.volume.total_page_count} pages</>}
                    </p>
                    {detail.volume.documents.length > 0 && (
                      <div className="space-y-1 text-sm text-gray-600">
                        {detail.volume.documents.map((doc, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span>{doc.filename}</span>
                            {doc.word_count > 0 && <span className="text-gray-400">&mdash; {doc.word_count.toLocaleString()} words</span>}
                            {doc.page_count > 0 && <span className="text-gray-400">, {doc.page_count} pages</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* SOURCE FILES */}
                <section className="rounded-lg border border-gray-200 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Source Files</h4>
                  {detail.source_files.length > 0 ? (
                    <div className="space-y-2">
                      {detail.source_files.map((file, i) => (
                        <FileRow key={i} file={file} onDownload={handleDownload} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No source files available</p>
                  )}
                </section>

                {/* REFERENCE FILES */}
                {detail.reference_files.length > 0 && (
                  <section className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reference Files</h4>
                    <div className="space-y-2">
                      {detail.reference_files.map((file, i) => (
                        <FileRow key={i} file={file} onDownload={handleDownload} />
                      ))}
                    </div>
                  </section>
                )}

                {/* INSTRUCTIONS */}
                {job.instructions && (
                  <section>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Instructions</h4>
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {job.instructions}
                    </div>
                  </section>
                )}

                {/* REVISION CONTEXT */}
                {isRevision && (job.rejection_reason || detail.delivered_files.length > 0) && (
                  <section className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <h4 className="text-sm font-semibold text-amber-800">
                        Revision Requested{job.revision_count > 0 && ` (Revision #${job.revision_count})`}
                      </h4>
                    </div>
                    {job.rejection_reason && (
                      <p className="text-sm text-amber-800 whitespace-pre-wrap mb-3 ml-6">
                        {job.rejection_reason}
                      </p>
                    )}
                    {detail.delivered_files.length > 0 && (
                      <div className="ml-6">
                        <p className="text-xs font-medium text-amber-700 mb-1">Your previous delivery:</p>
                        <div className="space-y-2">
                          {detail.delivered_files.map((file, i) => (
                            <FileRow key={i} file={file} onDownload={handleDownload} />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* TIMELINE */}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Timeline</h4>
                  <div className="space-y-2">
                    <TimelineEntry label="Offered" date={job.offered_at} />
                    <TimelineEntry label="Accepted" date={job.accepted_at} />
                    <TimelineEntry label="Started" date={job.started_at} />
                    <TimelineEntry label="Delivered" date={job.delivered_at} />
                    <TimelineEntry label="Approved" date={job.approved_at} />
                  </div>
                </section>

                {/* Awaiting review badge */}
                {status === "delivered" && (
                  <div className="flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Awaiting review</span>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
            {status === "offered" && (
              <>
                <button
                  onClick={() => setActionModal("decline")}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  Decline
                </button>
                <button
                  onClick={() => setActionModal("accept")}
                  disabled={expired}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
      {actionModal === "accept" && canAccept && (
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

// --- Sub-components ---

function FileRow({ file, onDownload }: { file: JobDetailFile; onDownload: (f: JobDetailFile) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
        <span className="text-gray-700 truncate">{file.filename}</span>
        {file.file_size != null && file.file_size > 0 && (
          <span className="text-gray-400 shrink-0">({formatFileSize(file.file_size)})</span>
        )}
      </div>
      <button
        onClick={() => onDownload(file)}
        className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    </div>
  );
}

function TimelineEntry({ label, date }: { label: string; date: string | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {date ? (
        <span className="text-teal-500 shrink-0">&#10003;</span>
      ) : (
        <span className="text-gray-300 shrink-0">&#9675;</span>
      )}
      <span className="text-gray-500 w-20">{label}</span>
      <span className="text-gray-700">
        {date ? formatShortDate(date) : "—"}
      </span>
    </div>
  );
}
