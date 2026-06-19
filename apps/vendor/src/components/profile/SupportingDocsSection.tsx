import { useState } from "react";
import { uploadCertification, type CertificationEntry } from "../../api/vendorProfile";
import {
  ShieldCheck,
  Upload,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  Trash2,
  FileBadge,
} from "lucide-react";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// Same accept list the ISO 17100 evidence flow uses. The vendor-certifications
// bucket is format-agnostic; the edge function enforces the 10 MB ceiling.
const ACCEPT =
  ".pdf,application/pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,image/*,.doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Standardised document types. The chosen label becomes the certification
// `name` (and the claimed-label the QMS AI-screen files it under), so keep
// these aligned with the admin "Request ISO 17100 evidence" checklist.
const DOC_TYPES = [
  "Diploma / Degree",
  "Academic transcript",
  "Professional translation certificate (ATA / CTTIC / ITI / NAATI, etc.)",
  "Language-proficiency proof (C2 / native attestation)",
  "Sworn / certified translator accreditation",
  "Other supporting document",
] as const;

const OTHER = "Other supporting document";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

interface Props {
  sessionToken: string;
  initialCertifications: CertificationEntry[];
}

export function SupportingDocsSection({ sessionToken, initialCertifications }: Props) {
  const [certs, setCerts] = useState<CertificationEntry[]>(initialCertifications);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [customName, setCustomName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isOther = docType === OTHER;
  const resolvedName = isOther ? customName.trim() : docType;

  function pickFile(f: File | null) {
    setError(null);
    setSuccess(null);
    if (!f) { setFile(null); return; }
    if (f.size > MAX_SIZE_BYTES) {
      setError("File is too large — maximum 10 MB.");
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleUpload() {
    if (!sessionToken || !file) return;
    if (!resolvedName) {
      setError("Please give this document a name.");
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    const result = await uploadCertification(sessionToken, {
      action: "add",
      cert_name: resolvedName,
      expiry_date: expiry || undefined,
      file,
    });
    setUploading(false);
    if (result.error) {
      const msg = result.error;
      setError(
        msg === "file_too_large" ? "File is too large — maximum 10 MB." :
        msg === "Invalid or expired session" ? "Your session expired. Please refresh and log in again." :
        msg,
      );
      return;
    }
    if (result.certifications) setCerts(result.certifications);
    setSuccess(`"${resolvedName}" uploaded. Our team will review it — no need to email it in.`);
    setFile(null);
    setCustomName("");
    setExpiry("");
    setDocType(DOC_TYPES[0]);
  }

  async function handleRemove(cert: CertificationEntry) {
    if (!sessionToken) return;
    if (!window.confirm(`Remove "${cert.name}"? This can't be undone.`)) return;
    setRemoving(cert.name);
    setError(null);
    setSuccess(null);
    const result = await uploadCertification(sessionToken, {
      action: "remove",
      cert_name: cert.name,
    });
    setRemoving(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.certifications) setCerts(result.certifications);
    setSuccess(`"${cert.name}" removed.`);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#0F9DA0]/10 flex items-center justify-center">
          <FileBadge className="w-4 h-4 text-[#0F9DA0]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Supporting Documents</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload your diplomas, certificates and proficiency proofs here — please don't email them in.
          </p>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Existing documents */}
        {certs.length > 0 ? (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {certs.map((cert, i) => (
              <div key={`${cert.name}-${cert.added_at}-${i}`} className="flex items-start justify-between gap-4 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-900">{cert.name}</span>
                    {cert.verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                        <ShieldCheck className="w-3 h-3" /> Verified by Cethos
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                        <Clock className="w-3 h-3" /> Pending review
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Uploaded {formatDate(cert.added_at)}
                    {cert.expiry_date ? ` · expires ${formatDate(cert.expiry_date)}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(cert)}
                  disabled={removing === cert.name}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600 disabled:opacity-50"
                  title="Remove"
                >
                  {removing === cert.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 rounded-lg border border-gray-200 bg-gray-50/60 text-xs text-gray-600">
            <FileBadge className="w-4 h-4 text-gray-400 shrink-0" />
            No supporting documents yet. Add your degree, certification or proficiency proof below.
          </div>
        )}

        {/* Upload form */}
        <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Document type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={uploading}
              className="block w-full text-xs text-gray-700 px-3 py-2 border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none disabled:opacity-50 bg-white"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {isOther && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Document name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Certificate of Employment — About Asia Travel"
                disabled={uploading}
                maxLength={120}
                className="block w-full text-xs text-gray-700 px-3 py-2 border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none disabled:opacity-50"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Expiry date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              disabled={uploading}
              className="block text-xs text-gray-700 px-3 py-2 border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">File</label>
            <input
              type="file"
              accept={ACCEPT}
              disabled={uploading}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-50"
            />
            <p className="text-[11px] text-gray-500 mt-1.5">PDF, image (JPG/PNG/HEIC) or Word, max 10 MB.</p>
          </div>

          {file && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !resolvedName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0F9DA0] rounded-md hover:bg-[#0d8688] disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-3.5 h-3.5" /> Upload document</>
              )}
            </button>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 text-xs text-emerald-700">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
