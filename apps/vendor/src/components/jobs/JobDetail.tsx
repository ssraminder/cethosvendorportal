import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getJobs,
  acceptJob,
  declineJob,
  uploadDelivery,
  getSourceFiles,
  type VendorJob,
} from "../../api/vendorJobs";
import {
  ArrowLeft,
  Loader2,
  Check,
  X,
  Download,
  Upload,
  Clock,
  FileText,
  CheckCircle,
} from "lucide-react";

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { sessionToken } = useVendorAuth();
  const [job, setJob] = useState<VendorJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [acting, setActing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadJob = useCallback(async () => {
    if (!sessionToken || !id) return;
    try {
      const result = await getJobs(sessionToken);
      const found = result.jobs?.find((j) => j.id === id);
      if (found) {
        setJob(found);
      } else {
        setError("Job not found");
      }
    } catch {
      setError("Failed to load job details");
    } finally {
      setLoading(false);
    }
  }, [sessionToken, id]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const handleAccept = async () => {
    if (!sessionToken || !id) return;
    setActing(true);
    try {
      const result = await acceptJob(sessionToken, id);
      if (result.success) {
        setSuccess("Job accepted!");
        await loadJob();
      } else {
        setError(result.error || "Failed to accept job");
      }
    } catch {
      setError("Failed to accept job");
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!sessionToken || !id) return;
    setActing(true);
    try {
      const result = await declineJob(sessionToken, id);
      if (result.success) {
        setSuccess("Job declined");
        await loadJob();
      } else {
        setError(result.error || "Failed to decline job");
      }
    } catch {
      setError("Failed to decline job");
    } finally {
      setActing(false);
    }
  };

  const handleDownloadSource = async () => {
    if (!sessionToken || !id) return;
    try {
      const result = await getSourceFiles(sessionToken, id);
      if (result.signed_urls) {
        for (const file of result.signed_urls) {
          window.open(file.url, "_blank");
        }
      }
    } catch {
      setError("Failed to get source files");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionToken || !id) return;

    setUploading(true);
    setError("");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadDelivery(
          sessionToken,
          id,
          base64,
          file.name,
          file.type,
          deliveryNotes || undefined
        );
        if (result.success) {
          setSuccess("Delivery uploaded successfully!");
          setDeliveryNotes("");
          await loadJob();
        } else {
          setError(result.error || "Failed to upload delivery");
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setError("Failed to upload delivery");
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        <p className="text-center text-gray-500">Job not found</p>
        <Link to="/jobs" className="block text-center text-teal-600 mt-2">
          Back to Jobs
        </Link>
      </div>
    );
  }

  const canDeliver = ["accepted", "in_progress", "revision_requested"].includes(job.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </Link>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Job Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-gray-900">
                {job.source_language?.name || "—"} → {job.target_language?.name || "—"}
              </h1>
              {job.job_reference && (
                <span className="text-sm text-gray-400">{job.job_reference}</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
              {job.domain && (
                <div>
                  <span className="text-gray-500">Domain</span>
                  <p className="font-medium capitalize">{job.domain}</p>
                </div>
              )}
              {job.service_type && (
                <div>
                  <span className="text-gray-500">Service</span>
                  <p className="font-medium">{job.service_type.replace(/_/g, " ")}</p>
                </div>
              )}
              {job.word_count && (
                <div>
                  <span className="text-gray-500">Word Count</span>
                  <p className="font-medium">{job.word_count.toLocaleString()}</p>
                </div>
              )}
              {job.deadline && (
                <div>
                  <span className="text-gray-500">Deadline</span>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(job.deadline).toLocaleString("en-CA")}
                  </p>
                </div>
              )}
              {job.rate && (
                <div>
                  <span className="text-gray-500">Rate</span>
                  <p className="font-medium">
                    {new Intl.NumberFormat("en-CA", {
                      style: "currency",
                      currency: job.currency || "CAD",
                    }).format(job.rate)}{" "}
                    / {job.rate_unit?.replace("_", " ") || "unit"}
                  </p>
                </div>
              )}
              {job.estimated_total && (
                <div>
                  <span className="text-gray-500">Estimated Total</span>
                  <p className="font-medium text-teal-700">
                    {new Intl.NumberFormat("en-CA", {
                      style: "currency",
                      currency: job.currency || "CAD",
                    }).format(job.estimated_total)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {job.status === "offered" && (
          <div className="mt-6 flex gap-3 border-t border-gray-100 pt-4">
            <button
              onClick={handleAccept}
              disabled={acting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Accept Job
            </button>
            <button
              onClick={handleDecline}
              disabled={acting}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Decline
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      {job.instructions && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Instructions</h2>
          <div className="text-sm text-gray-600 whitespace-pre-wrap">{job.instructions}</div>
        </div>
      )}

      {/* Source Files */}
      {job.source_file_paths && job.source_file_paths.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Source Files</h2>
          <button
            onClick={handleDownloadSource}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Download Source Files ({job.source_file_paths.length})
          </button>
        </div>
      )}

      {/* Delivery Upload */}
      {canDeliver && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Upload Delivery</h2>
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder="Delivery notes (optional)..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <input
            type="file"
            ref={fileRef}
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload Translated File"}
          </button>
        </div>
      )}

      {/* Delivery History */}
      {job.delivery_file_paths && job.delivery_file_paths.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Deliveries</h2>
          <div className="space-y-2">
            {job.delivery_file_paths.map((path, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-gray-600"
              >
                <FileText className="h-4 w-4 text-gray-400" />
                {path.split("/").pop()}
              </div>
            ))}
          </div>
          {job.delivery_notes && (
            <p className="mt-3 text-sm text-gray-500">Notes: {job.delivery_notes}</p>
          )}
          {job.delivered_at && (
            <p className="mt-1 text-xs text-gray-400">
              Delivered: {new Date(job.delivered_at).toLocaleString("en-CA")}
            </p>
          )}
        </div>
      )}

      {/* Reviewer Feedback */}
      {(job.reviewer_notes || job.quality_score !== null) && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Review Feedback</h2>
          {job.quality_score !== null && (
            <div className="mb-2">
              <span className="text-sm text-gray-500">Quality Score: </span>
              <span
                className={`text-sm font-bold ${
                  (job.quality_score ?? 0) >= 80
                    ? "text-green-600"
                    : (job.quality_score ?? 0) >= 60
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {job.quality_score}/100
              </span>
            </div>
          )}
          {job.reviewer_notes && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {job.reviewer_notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
