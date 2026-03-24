import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getJobs, acceptJob, declineJob, type VendorJob } from "../../api/vendorJobs";
import {
  Briefcase,
  Loader2,
  Check,
  X,
  Clock,
  FileText,
  ChevronRight,
} from "lucide-react";

type TabKey = "offered" | "active" | "completed";

const STATUS_GROUPS: Record<TabKey, string[]> = {
  offered: ["offered"],
  active: ["accepted", "in_progress", "delivered", "under_review", "revision_requested"],
  completed: ["approved", "completed"],
};

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  offered: { bg: "bg-amber-100", text: "text-amber-700", label: "Offered" },
  accepted: { bg: "bg-blue-100", text: "text-blue-700", label: "Accepted" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress" },
  delivered: { bg: "bg-purple-100", text: "text-purple-700", label: "Delivered" },
  under_review: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Under Review" },
  revision_requested: { bg: "bg-orange-100", text: "text-orange-700", label: "Revision Requested" },
  approved: { bg: "bg-green-100", text: "text-green-700", label: "Approved" },
  completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  declined: { bg: "bg-gray-100", text: "text-gray-600", label: "Declined" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
};

export function JobBoard() {
  const { sessionToken } = useVendorAuth();
  const [jobs, setJobs] = useState<VendorJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("offered");
  const [actionId, setActionId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await getJobs(sessionToken);
      if (result.jobs) {
        setJobs(result.jobs);
      }
    } catch {
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleAccept = async (jobId: string) => {
    if (!sessionToken) return;
    setActionId(jobId);
    try {
      const result = await acceptJob(sessionToken, jobId);
      if (result.success) {
        await loadJobs();
      } else {
        setError(result.error || "Failed to accept job");
      }
    } catch {
      setError("Failed to accept job");
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (jobId: string) => {
    if (!sessionToken) return;
    setActionId(jobId);
    try {
      const result = await declineJob(sessionToken, jobId);
      if (result.success) {
        await loadJobs();
      } else {
        setError(result.error || "Failed to decline job");
      }
    } catch {
      setError("Failed to decline job");
    } finally {
      setActionId(null);
    }
  };

  const filteredJobs = jobs.filter((j) =>
    STATUS_GROUPS[tab].includes(j.status)
  );

  const counts: Record<TabKey, number> = {
    offered: jobs.filter((j) => STATUS_GROUPS.offered.includes(j.status)).length,
    active: jobs.filter((j) => STATUS_GROUPS.active.includes(j.status)).length,
    completed: jobs.filter((j) => STATUS_GROUPS.completed.includes(j.status)).length,
  };

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const d = new Date(deadline);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) return { text: "Overdue", urgent: true };
    if (hours < 24) return { text: `${hours}h remaining`, urgent: true };
    if (days < 3) return { text: `${days}d ${hours % 24}h remaining`, urgent: true };
    return { text: d.toLocaleDateString("en-CA"), urgent: false };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <p className="text-sm text-gray-500 mt-1">
          {jobs.length} total job{jobs.length !== 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["offered", "active", "completed"] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-teal-600 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {counts[t] > 0 && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  t === "offered" && counts[t] > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Job List */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No {tab} jobs</p>
          <p className="text-sm">
            {tab === "offered"
              ? "New job offers will appear here."
              : tab === "active"
              ? "Jobs you accept will appear here."
              : "Completed jobs will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const deadline = formatDeadline(job.deadline);
            const badge = STATUS_BADGES[job.status] || STATUS_BADGES.offered;
            return (
              <div
                key={job.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      {job.job_reference && (
                        <span className="text-xs text-gray-400">
                          {job.job_reference}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      {job.source_language?.name || "—"} → {job.target_language?.name || "—"}
                      {job.domain && (
                        <span className="text-xs text-gray-500">({job.domain})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {job.service_type && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {job.service_type.replace(/_/g, " ")}
                        </span>
                      )}
                      {job.word_count && (
                        <span>{job.word_count.toLocaleString()} words</span>
                      )}
                      {job.rate && job.rate_unit && (
                        <span>
                          {new Intl.NumberFormat("en-CA", {
                            style: "currency",
                            currency: job.currency || "CAD",
                          }).format(job.rate)}{" "}
                          / {job.rate_unit.replace("_", " ")}
                        </span>
                      )}
                      {deadline && (
                        <span
                          className={`flex items-center gap-1 ${
                            deadline.urgent ? "text-red-600 font-medium" : ""
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {deadline.text}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {job.status === "offered" && (
                      <>
                        <button
                          onClick={() => handleAccept(job.id)}
                          disabled={actionId === job.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                        >
                          {actionId === job.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Accept
                        </button>
                        <button
                          onClick={() => handleDecline(job.id)}
                          disabled={actionId === job.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                          Decline
                        </button>
                      </>
                    )}
                    <Link
                      to={`/jobs/${job.id}`}
                      className="p-1.5 text-gray-400 hover:text-teal-600"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
