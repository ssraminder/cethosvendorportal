import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { listCvs, uploadCv, type VendorCv } from "../../api/vendorCvs";
import {
  FileText,
  Upload,
  Download,
  Loader2,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CvSection() {
  const { sessionToken } = useVendorAuth();
  const [cvs, setCvs] = useState<VendorCv[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const refresh = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    const result = await listCvs(sessionToken);
    setLoading(false);
    if (result.success && result.cvs) {
      setCvs(result.cvs);
    } else {
      setError(result.error || "Could not load CV history.");
    }
  }, [sessionToken]);

  useEffect(() => { refresh(); }, [refresh]);

  function pickFile(f: File | null) {
    setError(null);
    setSuccess(null);
    if (!f) { setFile(null); return; }
    if (f.type && f.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setError("File is too large — maximum 10 MB.");
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleUpload() {
    if (!sessionToken || !file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    const result = await uploadCv(sessionToken, file, notes.trim() || null);
    setUploading(false);
    if (result.success && result.cv) {
      setSuccess(`Uploaded as version ${result.cv.version}.`);
      setFile(null);
      setNotes("");
      await refresh();
    } else {
      const msg = result.detail || result.error || "Upload failed.";
      setError(
        msg === "pdf_only" ? "Only PDF files are accepted." :
        msg === "file_too_large" ? "File is too large — maximum 10 MB." :
        msg === "auth_required" || msg === "invalid_session" ? "Your session expired. Please refresh and log in again." :
        msg,
      );
    }
  }

  const current = cvs.find((c) => c.is_current) ?? null;
  const history = cvs.filter((c) => !c.is_current);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#0F9DA0]/10 flex items-center justify-center">
          <FileText className="w-4 h-4 text-[#0F9DA0]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">CV / Resume</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload your current CV. Old versions are kept for our records.
          </p>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Current CV summary */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : current ? (
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50/40">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-gray-900">
                  Current — version {current.version}
                </span>
              </div>
              <p className="text-xs text-gray-600 truncate">{current.file_name}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {formatBytes(current.file_size_bytes)} · uploaded {formatDate(current.created_at)}
                {current.uploaded_by_vendor ? "" : " · by staff"}
              </p>
              {current.notes && (
                <p className="text-xs text-gray-700 mt-2 italic">"{current.notes}"</p>
              )}
            </div>
            {current.download_url && (
              <a
                href={current.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-100"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 rounded-lg border border-amber-200 bg-amber-50/40 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            No CV on file yet. Please upload one below.
          </div>
        )}

        {/* Upload form */}
        <div className="rounded-lg border border-dashed border-gray-300 p-4">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Upload {current ? "a new version" : "your CV"}
          </label>
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-50"
          />
          <p className="text-[11px] text-gray-500 mt-1.5">PDF only, max 10 MB.</p>

          {file && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-gray-600">
                Selected: <span className="font-medium text-gray-900">{file.name}</span> ({formatBytes(file.size)})
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional: what changed in this version? (e.g. added new certifications, updated experience)"
                rows={2}
                disabled={uploading}
                maxLength={500}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none disabled:bg-gray-50 resize-none"
              />
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0F9DA0] rounded-md hover:bg-[#0d8688] disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Upload</>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mt-3 flex items-start gap-2 text-xs text-emerald-700">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* Version history */}
        {history.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5" />
              Previous versions ({history.length})
            </div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {history.map((cv) => (
                <div key={cv.id} className="flex items-start justify-between gap-4 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900">
                      v{cv.version} — {cv.file_name}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {formatBytes(cv.file_size_bytes)} · {formatDate(cv.created_at)}
                      {cv.superseded_at ? ` · superseded ${formatDate(cv.superseded_at)}` : ""}
                      {cv.uploaded_by_vendor ? "" : " · by staff"}
                    </div>
                    {cv.notes && (
                      <p className="text-[11px] text-gray-600 mt-1 italic">"{cv.notes}"</p>
                    )}
                  </div>
                  {cv.download_url && (
                    <a
                      href={cv.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[#0F9DA0] hover:underline"
                      title="Download"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
