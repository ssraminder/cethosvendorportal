import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getSteps, type VendorStep, type TabKey } from "../../api/vendorJobs";
import { LANGUAGES } from "../../data/languages";
import { JobDetailModal } from "./JobDetailModal";
import { AcceptConfirmModal, DeclineModal, DeliverModal } from "./JobActionModals";
import { NegotiateModal } from "./NegotiateModal";
import { TermsModal, checkTermsForOffer, type TermsData } from "./TermsModal";
import {
  Briefcase,
  Loader2,
  Clock,
  ChevronRight,
  AlertTriangle,
  Timer,
} from "lucide-react";

interface ShellContext {
  setJobOfferedCount: (n: number) => void;
}

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

function formatDeadline(deadline: string | null): { text: string; fullDate: string; urgent: boolean } | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const fullDate = d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

  if (diff < 0) {
    const label = days > 0 ? `overdue by ${days} days` : `overdue by ${hours}h`;
    return { text: label, fullDate, urgent: true };
  }
  if (hours < 24) return { text: `${hours}h remaining`, fullDate, urgent: true };
  if (days < 3) return { text: `in ${days}d ${hours % 24}h`, fullDate, urgent: true };
  return { text: `in ${days} days`, fullDate, urgent: false };
}

function formatOfferExpiry(expiresAt: string | null): { text: string; expired: boolean } | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return { text: "Expired", expired: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (hours < 24) return { text: `Expires in ${hours}h`, expired: false };
  return { text: `Expires in ${days}d`, expired: false };
}

const EMPTY_MESSAGES: Record<TabKey, { title: string; desc: string }> = {
  offered: { title: "No job offers at the moment", desc: "New job offers will appear here when assigned by your project manager." },
  active: { title: "No active jobs", desc: "Accept an offer to get started." },
  completed: { title: "No completed jobs yet", desc: "" },
};

export function JobBoard() {
  const { id: paramId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { sessionToken } = useVendorAuth();
  const shellCtx = useOutletContext<ShellContext | null>();

  const [tab, setTab] = useState<TabKey>("offered");
  const [steps, setSteps] = useState<VendorStep[]>([]);
  const [counts, setCounts] = useState({ offered: 0, active: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal state
  const [selectedStep, setSelectedStep] = useState<VendorStep | null>(null);
  const [actionModal, setActionModal] = useState<{ type: "accept" | "decline" | "deliver"; step: VendorStep } | null>(null);
  const [negotiatingJob, setNegotiatingJob] = useState<VendorStep | null>(null);
  const [termsModal, setTermsModal] = useState<{
    isOpen: boolean;
    terms: TermsData;
    offerId: string;
    stepId: string;
    orderId: string;
    actionType: "accept_offer" | "submit_counter";
    pendingAction: () => void;
  } | null>(null);

  const checkTermsAndProceed = async (
    step: VendorStep,
    actionType: "accept_offer" | "submit_counter",
    onProceed: () => void
  ) => {
    if (!sessionToken || !step.offer_id) {
      onProceed();
      return;
    }

    const result = await checkTermsForOffer(sessionToken, step.offer_id);

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
      actionType,
      pendingAction: onProceed,
    });
  };

  const fetchTab = useCallback(
    async (t: TabKey) => {
      if (!sessionToken) return;
      setLoading(true);
      setError("");
      try {
        const result = await getSteps(sessionToken, t);
        if (result.error) {
          setError(result.error);
        } else {
          setSteps(result.jobs ?? []);
          if (result.counts) {
            setCounts(result.counts);
            shellCtx?.setJobOfferedCount(result.counts.offered);
          }
        }
      } catch {
        setError("Failed to load jobs");
      } finally {
        setLoading(false);
      }
    },
    [sessionToken, shellCtx]
  );

  // Fetch on tab change
  useEffect(() => {
    fetchTab(tab);
  }, [tab, fetchTab]);

  // Handle direct link /jobs/:id — find the step across tabs
  useEffect(() => {
    if (!paramId || !sessionToken) return;
    let cancelled = false;

    async function findStep() {
      const tabs: TabKey[] = ["offered", "active", "completed"];
      for (const t of tabs) {
        try {
          const result = await getSteps(sessionToken!, t);
          if (cancelled) return;
          const found = result.jobs?.find((s) => s.id === paramId);
          if (found) {
            setTab(t);
            setSteps(result.jobs ?? []);
            if (result.counts) {
              setCounts(result.counts);
              shellCtx?.setJobOfferedCount(result.counts.offered);
            }
            setSelectedStep(found);
            setLoading(false);
            return;
          }
        } catch {
          // continue
        }
      }
      if (!cancelled) setLoading(false);
    }

    findStep();
    return () => { cancelled = true; };
    // Only run on mount when paramId exists
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId, sessionToken]);

  const handleActionSuccess = (message: string) => {
    setActionModal(null);
    setSelectedStep(null);
    setSuccessMsg(message);
    fetchTab(tab);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleDetailClose = () => {
    setSelectedStep(null);
    if (paramId) navigate("/jobs", { replace: true });
  };

  const canDeliver = (status: string) =>
    ["accepted", "in_progress", "revision_requested"].includes(status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Jobs</h1>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["offered", "active", "completed"] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm border-b-[3px] transition-colors ${
              tab === t
                ? "border-teal-600 text-teal-600 font-semibold"
                : "border-transparent text-gray-600 font-medium hover:text-gray-800"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {counts[t] > 0 && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  t === "offered"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : steps.length === 0 ? (
        /* Empty state */
        <div className="text-center py-12 text-gray-500">
          <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">{EMPTY_MESSAGES[tab].title}</p>
          {EMPTY_MESSAGES[tab].desc && (
            <p className="text-sm mt-1">{EMPTY_MESSAGES[tab].desc}</p>
          )}
        </div>
      ) : (
        /* Job cards */
        <div className="space-y-3">
          {steps.map((step) => {
            const badge = STATUS_BADGES[step.status] ?? STATUS_BADGES.offered;
            const deadline = formatDeadline(step.deadline);
            const offerExpiry = step.status === "offered" ? formatOfferExpiry(step.expires_at ?? null) : null;

            return (
              <div
                key={step.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedStep(step)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Status + step name + rush */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {step.name} — Step {step.step_number}
                      </span>
                      {step.is_rush && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                          RUSH
                        </span>
                      )}
                      {offerExpiry && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          offerExpiry.expired
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          <Timer className="h-3 w-3" />
                          {offerExpiry.text}
                        </span>
                      )}
                    </div>

                    {/* Order number + language pair */}
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1 flex-wrap">
                      {step.order_number && (
                        <span className="text-gray-500">Order #{step.order_number}</span>
                      )}
                      {(step.source_language || step.target_language) && (
                        <span className="font-medium">
                          {getLanguageName(step.source_language)} &rarr; {getLanguageName(step.target_language)}
                        </span>
                      )}
                    </div>

                    {/* Rate + deadline row */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      {step.service_name && <span>{step.service_name}</span>}
                      {step.vendor_rate != null && step.vendor_rate_unit && (
                        <span>
                          {new Intl.NumberFormat("en-CA", {
                            style: "currency",
                            currency: step.vendor_currency || "CAD",
                          }).format(step.vendor_rate)}
                          /{step.vendor_rate_unit.replace("_", " ")}
                          {step.vendor_total != null && (
                            <> &middot; {new Intl.NumberFormat("en-CA", {
                              style: "currency",
                              currency: step.vendor_currency || "CAD",
                            }).format(step.vendor_total)}</>
                          )}
                        </span>
                      )}
                      {deadline && (
                        <span
                          className={`flex items-center gap-1 ${
                            deadline.urgent ? "text-red-600 font-medium" : ""
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {deadline.fullDate} ({deadline.text})
                        </span>
                      )}
                    </div>

                    {/* Negotiation indicator / counter status */}
                    {step.status === "offered" && step.negotiation_allowed && step.counter_status === "none" && (
                      <div className="text-xs text-teal-600 mt-1">Open to negotiation</div>
                    )}
                    {step.status === "offered" && step.counter_status === "proposed" && (
                      <span className="inline-flex items-center mt-1 text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 font-medium">
                        Counter pending review
                      </span>
                    )}
                    {step.status === "offered" && step.counter_status === "accepted" && (
                      <span className="inline-flex items-center mt-1 text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5 font-medium">
                        Counter accepted
                      </span>
                    )}
                    {step.status === "offered" && step.counter_status === "rejected" && (
                      <span className="inline-flex items-center mt-1 text-xs text-red-700 bg-red-50 rounded-full px-2 py-0.5 font-medium">
                        Counter rejected
                      </span>
                    )}

                    {/* Rejection reason preview */}
                    {step.status === "revision_requested" && step.rejection_reason && (
                      <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 truncate">
                        Feedback: {step.rejection_reason}
                      </p>
                    )}

                    {/* Awaiting review badge */}
                    {step.status === "delivered" && (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs text-purple-700 bg-purple-50 rounded-full px-2 py-0.5 font-medium">
                        <Clock className="h-3 w-3" />
                        Awaiting review
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {step.status === "offered" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            checkTermsAndProceed(step, "accept_offer", () =>
                              setActionModal({ type: "accept", step })
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionModal({ type: "decline", step }); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Decline
                        </button>
                        {step.negotiation_allowed && (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-orange-400 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={(e) => {
                              e.stopPropagation();
                              checkTermsAndProceed(step, "submit_counter", () =>
                                setNegotiatingJob(step)
                              );
                            }}
                            disabled={step.counter_status === "proposed"}
                          >
                            {step.counter_status === "proposed" ? "Counter Pending" : "Negotiate"}
                          </button>
                        )}
                      </>
                    )}
                    {canDeliver(step.status) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setActionModal({ type: "deliver", step }); }}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
                          step.status === "revision_requested"
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-teal-600 hover:bg-teal-700"
                        }`}
                      >
                        {step.status === "revision_requested" ? "Deliver Revision" : "Deliver"}
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedStep && (
        <JobDetailModal
          step={selectedStep}
          onClose={handleDetailClose}
          onAction={() => {
            setSelectedStep(null);
            if (paramId) navigate("/jobs", { replace: true });
            handleActionSuccess("Action completed successfully!");
          }}
        />
      )}

      {/* Action modals from card buttons */}
      {actionModal?.type === "accept" && (
        <AcceptConfirmModal
          step={actionModal.step}
          onClose={() => setActionModal(null)}
          onSuccess={() => handleActionSuccess("Job accepted!")}
        />
      )}
      {actionModal?.type === "decline" && (
        <DeclineModal
          step={actionModal.step}
          onClose={() => setActionModal(null)}
          onSuccess={() => handleActionSuccess("Job declined. The project manager will reassign.")}
        />
      )}
      {actionModal?.type === "deliver" && (
        <DeliverModal
          step={actionModal.step}
          onClose={() => setActionModal(null)}
          onSuccess={() => handleActionSuccess("Files delivered! The project manager will review.")}
        />
      )}
      {negotiatingJob && (
        <NegotiateModal
          job={negotiatingJob}
          onClose={() => setNegotiatingJob(null)}
          onSuccess={(msg) => { setNegotiatingJob(null); handleActionSuccess(msg); }}
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
          actionType={termsModal.actionType}
        />
      )}
    </div>
  );
}
