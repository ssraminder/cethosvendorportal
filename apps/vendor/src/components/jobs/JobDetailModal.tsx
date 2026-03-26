import { useState, useEffect } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getJobDetail,
  type VendorStep,
  type JobDetailResponse,
  type JobDetailFile,
  type VolumeDocument,
} from "../../api/vendorJobs";
import { LANGUAGES } from "../../data/languages";
import { AcceptConfirmModal, DeclineModal, DeliverModal } from "./JobActionModals";
import { NegotiateModal } from "./NegotiateModal";
import { TermsModal, checkTermsForOffer, type TermsData } from "./TermsModal";
import {
  X,
  Clock,
  Download,
  FileText,
  AlertTriangle,
  Loader2,
  Calendar,
  Timer,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
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

function isPdf(file: JobDetailFile): boolean {
  return file.mime_type === "application/pdf";
}

interface JobDetailModalProps {
  step: VendorStep;
  onClose: () => void;
  onAction: (message?: string, switchToActive?: boolean) => void;
}

export function JobDetailModal({ step, onClose, onAction }: JobDetailModalProps) {
  const { sessionToken } = useVendorAuth();
  const [actionModal, setActionModal] = useState<"accept" | "decline" | "deliver" | null>(null);
  const [showNegotiate, setShowNegotiate] = useState(false);
  const [detail, setDetail] = useState<JobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [volumeExpanded, setVolumeExpanded] = useState(false);
  const [termsModal, setTermsModal] = useState<{
    isOpen: boolean;
    terms: TermsData;
    offerId: string;
    stepId: string;
    orderId: string;
    serviceId?: string | null;
    actionType: "accept_offer" | "submit_counter";
    pendingAction: () => void;
  } | null>(null);

  const checkTermsAndProceed = async (
    actionType: "accept_offer" | "submit_counter",
    onProceed: () => void
  ) => {
    if (!sessionToken || !step.offer_id) {
      onProceed();
      return;
    }

    const result = await checkTermsForOffer(sessionToken, step.offer_id, step.service_id);

    if (!result.needsTerms || !result.terms) {
      onProceed();
      return;
    }

    setTermsModal({
      isOpen: true,
      terms: result.terms,
      offerId: step.offer_id,
      stepId: step.id,
      orderId: step.order_id ?? "",
      serviceId: step.service_id,
      actionType,
      pendingAction: onProceed,
    });
  };

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

  const handleActionSuccess = (revisionVersion?: number) => {
    setActionModal(null);
    if (revisionVersion) {
      onAction(`Revised delivery v${revisionVersion} submitted`);
    } else {
      onAction();
    }
  };

  const handleDownload = (file: JobDetailFile) => {
    window.open(file.download_url, "_blank");
  };

  const togglePreview = (storagePath: string) => {
    setPreviewFileId((prev) => (prev === storagePath ? null : storagePath));
  };

  // Use detail data when available, fall back to step data for header
  const job = detail?.job;
  const status = job?.status ?? step.status;
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.offered;
  const expired = isExpired(job?.expires_at ?? step.expires_at ?? null);
  const canDeliver = ["accepted", "in_progress", "revision_requested"].includes(status);
  const isRevision = status === "revision_requested" || (job?.revision_count ?? 0) > 0;
  const canAccept = status === "offered" && !expired;

  const currency = job?.vendor_currency ?? step.vendor_currency ?? "CAD";
  const fmt = (val: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(val);

  // Categorize source files
  const originalFiles = detail?.source_files.filter((f) => f.source !== "previous_step") ?? [];
  const previousStepFiles = detail?.source_files.filter((f) => f.source === "previous_step") ?? [];

  // Match volume documents to source files by filename
  const getFileForDoc = (doc: VolumeDocument): JobDetailFile | undefined => {
    return detail?.source_files.find(
      (f) => f.filename === doc.filename || f.filename.replace(/\.[^.]+$/, "") === doc.filename.replace(/\.[^.]+$/, "")
    );
  };

  const customerFirstName = job?.customer_name?.split(" ")[0] || null;

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
                {/* 1. ORDER INFO with customer name */}
                <section className="rounded-lg border border-gray-200 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Order Info</h4>
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    <span className="text-gray-700">
                      Order <span className="font-medium text-gray-900">#{job.order_number}</span>
                    </span>
                    {customerFirstName && (
                      <>
                        <span className="text-gray-400">&middot;</span>
                        <span className="text-gray-700">
                          Customer: <span className="font-medium text-gray-900">{customerFirstName}</span>
                        </span>
                      </>
                    )}
                    <span className="text-gray-400">&middot;</span>
                    <span className="text-gray-700">Service: <span className="font-medium text-gray-900">{job.service_name}</span></span>
                    {job.is_rush && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        RUSH ORDER
                      </span>
                    )}
                  </div>
                </section>

                {/* 2. LANGUAGE & RATE */}
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
                  {job.negotiation_allowed && (
                    <div className="text-xs text-teal-600 mt-2">This offer is open to negotiation</div>
                  )}
                  {!job.negotiation_allowed && (
                    <div className="text-xs text-gray-400 mt-2">Fixed terms &mdash; accept or decline</div>
                  )}
                </section>

                {/* 3. DEADLINE & TIMING */}
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

                {/* 4. REVISION CONTEXT (prominent position when applicable) */}
                {isRevision && status === "revision_requested" && (
                  <section className="rounded-lg bg-amber-50 border border-amber-300 p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <h4 className="text-sm font-bold text-amber-800">
                        Revision #{job.revision_count} Requested
                      </h4>
                    </div>

                    {job.rejection_reason && (
                      <div className="ml-7 mb-4">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">PM Feedback:</p>
                        <p className="text-sm text-amber-900 whitespace-pre-wrap bg-amber-100/50 rounded p-3 border border-amber-200">
                          {job.rejection_reason}
                        </p>
                      </div>
                    )}

                    {detail.delivered_files.length > 0 && (
                      <div className="ml-7 mb-3">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Your Previous Delivery</p>
                        <div className="space-y-1">
                          {detail.delivered_files.map((file, i) => (
                            <FileRowWithPreview
                              key={i}
                              file={file}
                              previewFileId={previewFileId}
                              onTogglePreview={togglePreview}
                              onDownload={handleDownload}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {originalFiles.length > 0 && (
                      <div className="ml-7 mb-3">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Original Source Files</p>
                        <div className="space-y-1">
                          {originalFiles.map((file, i) => (
                            <FileRowWithPreview
                              key={i}
                              file={file}
                              previewFileId={previewFileId}
                              onTogglePreview={togglePreview}
                              onDownload={handleDownload}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="ml-7 text-xs text-amber-700 italic">
                      Compare your previous delivery against the source files and address the feedback above.
                    </p>

                    {canDeliver && (
                      <div className="ml-7 mt-3">
                        <button
                          onClick={() => setActionModal("deliver")}
                          className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                        >
                          Deliver Revision
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {/* 5. VOLUME & DOCUMENTS (expandable) */}
                {detail.volume && detail.volume.total_files > 0 && (
                  <section className="rounded-lg border border-gray-200 p-4">
                    <button
                      onClick={() => setVolumeExpanded(!volumeExpanded)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {detail.volume.total_files} document{detail.volume.total_files !== 1 ? "s" : ""}
                          {detail.volume.total_word_count > 0 && <> &middot; {detail.volume.total_word_count.toLocaleString()} words</>}
                          {detail.volume.total_page_count > 0 && <> &middot; {detail.volume.total_page_count} pages</>}
                        </span>
                      </div>
                      {volumeExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {volumeExpanded && detail.volume.documents.length > 0 && (
                      <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                        {detail.volume.documents.map((doc, i) => {
                          const matchedFile = getFileForDoc(doc);
                          return (
                            <div key={i} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                                <span className="text-sm font-medium text-gray-800 truncate">{doc.filename}</span>
                              </div>
                              <div className="ml-6 text-xs text-gray-500 mb-2">
                                {doc.word_count > 0 && <>{doc.word_count.toLocaleString()} words</>}
                                {doc.page_count > 0 && <>{doc.word_count > 0 ? " · " : ""}{doc.page_count} pages</>}
                                {matchedFile?.mime_type && (
                                  <> · {matchedFile.mime_type === "application/pdf" ? "PDF" : matchedFile.mime_type.split("/")[1]?.toUpperCase() ?? "File"}</>
                                )}
                                {matchedFile?.file_size != null && matchedFile.file_size > 0 && (
                                  <> · {formatFileSize(matchedFile.file_size)}</>
                                )}
                              </div>
                              {matchedFile && (
                                <div className="ml-6">
                                  <div className="flex items-center gap-2">
                                    {isPdf(matchedFile) && (
                                      <button
                                        onClick={() => togglePreview(matchedFile.storage_path)}
                                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                                      >
                                        {previewFileId === matchedFile.storage_path ? (
                                          <><EyeOff className="h-3.5 w-3.5" /> Hide</>
                                        ) : (
                                          <><Eye className="h-3.5 w-3.5" /> Preview</>
                                        )}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDownload(matchedFile)}
                                      className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Download
                                    </button>
                                  </div>
                                  {isPdf(matchedFile) && previewFileId === matchedFile.storage_path && (
                                    <iframe
                                      src={matchedFile.download_url}
                                      className="w-full h-96 border border-gray-200 rounded mt-2"
                                      title={`Preview: ${matchedFile.filename}`}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* 6. SOURCE FILES */}
                {originalFiles.length > 0 && (
                  <section className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Source Files</h4>
                    <div className="space-y-1">
                      {originalFiles.map((file, i) => (
                        <FileRowWithPreview
                          key={i}
                          file={file}
                          previewFileId={previewFileId}
                          onTogglePreview={togglePreview}
                          onDownload={handleDownload}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 7. PREVIOUS STEP FILES (blue section, only for step > 1) */}
                {previousStepFiles.length > 0 && (
                  <section className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                    <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Files from Previous Step</h4>
                    <p className="text-xs text-blue-600 mb-3">
                      These files were delivered by the previous step (Step {(job.step_number ?? 1) - 1}). They are your starting point.
                    </p>
                    <div className="space-y-1">
                      {previousStepFiles.map((file, i) => (
                        <FileRowWithPreview
                          key={i}
                          file={file}
                          previewFileId={previewFileId}
                          onTogglePreview={togglePreview}
                          onDownload={handleDownload}
                          tintColor="blue"
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 8. REFERENCE FILES (green section) */}
                {detail.reference_files.length > 0 && (
                  <section className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Reference Materials</h4>
                    <div className="space-y-1">
                      {detail.reference_files.map((file, i) => (
                        <FileRowWithPreview
                          key={i}
                          file={file}
                          previewFileId={previewFileId}
                          onTogglePreview={togglePreview}
                          onDownload={handleDownload}
                          tintColor="green"
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 9. INSTRUCTIONS */}
                {job.instructions && (
                  <section>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Instructions</h4>
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {job.instructions}
                    </div>
                  </section>
                )}

                {/* 10. TIMELINE */}
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
                {(job?.negotiation_allowed ?? step.negotiation_allowed) && (
                  <button
                    onClick={() =>
                      checkTermsAndProceed("submit_counter", () =>
                        setShowNegotiate(true)
                      )
                    }
                    disabled={(job?.counter_status ?? step.counter_status) === "proposed"}
                    className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-400 rounded-lg hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(job?.counter_status ?? step.counter_status) === "proposed" ? "Counter Pending" : "Negotiate"}
                  </button>
                )}
                <button
                  onClick={() =>
                    checkTermsAndProceed("accept_offer", () =>
                      setActionModal("accept")
                    )
                  }
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
                  status === "revision_requested"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-teal-600 hover:bg-teal-700"
                }`}
              >
                {status === "revision_requested" ? "Deliver Revision" : "Deliver"}
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
      {showNegotiate && (
        <NegotiateModal
          job={step}
          onClose={() => setShowNegotiate(false)}
          onSuccess={(msg, autoAssigned) => {
            setShowNegotiate(false);
            onAction(msg, autoAssigned);
          }}
        />
      )}
      {termsModal?.isOpen && (
        <TermsModal
          isOpen={true}
          onClose={() => setTermsModal(null)}
          onAccept={() => {
            const action = termsModal.pendingAction;
            setTermsModal(null);
            action();
          }}
          terms={termsModal.terms}
          offerId={termsModal.offerId}
          stepId={termsModal.stepId}
          orderId={termsModal.orderId}
          serviceId={termsModal.serviceId}
          actionType={termsModal.actionType}
        />
      )}
    </>
  );
}

// --- Sub-components ---

const TINT_COLORS = {
  default: { icon: "text-teal-600", hover: "hover:text-teal-700" },
  blue: { icon: "text-blue-600", hover: "hover:text-blue-700" },
  green: { icon: "text-green-600", hover: "hover:text-green-700" },
} as const;

function FileRowWithPreview({
  file,
  previewFileId,
  onTogglePreview,
  onDownload,
  tintColor = "default",
}: {
  file: JobDetailFile;
  previewFileId: string | null;
  onTogglePreview: (id: string) => void;
  onDownload: (f: JobDetailFile) => void;
  tintColor?: "default" | "blue" | "green";
}) {
  const isPreviewOpen = previewFileId === file.storage_path;
  const colors = TINT_COLORS[tintColor];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm py-1">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-gray-700 truncate">{file.filename}</span>
          {file.file_size != null && file.file_size > 0 && (
            <span className="text-gray-400 shrink-0">({formatFileSize(file.file_size)})</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPdf(file) && (
            <button
              onClick={() => onTogglePreview(file.storage_path)}
              className={`inline-flex items-center gap-1 text-xs font-medium ${colors.icon} ${colors.hover}`}
            >
              {isPreviewOpen ? (
                <><EyeOff className="h-3.5 w-3.5" /> Hide</>
              ) : (
                <><Eye className="h-3.5 w-3.5" /> Preview</>
              )}
            </button>
          )}
          <button
            onClick={() => onDownload(file)}
            className={`inline-flex items-center gap-1 text-xs font-medium ${colors.icon} ${colors.hover}`}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>
      {isPdf(file) && isPreviewOpen && (
        <iframe
          src={file.download_url}
          className="w-full h-96 border border-gray-200 rounded mt-2"
          title={`Preview: ${file.filename}`}
        />
      )}
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
