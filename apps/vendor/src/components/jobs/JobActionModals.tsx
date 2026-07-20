import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  acceptStep,
  acceptDirectAssign,
  declineStep,
  deliverStep,
  type VendorStep,
} from "../../api/vendorJobs";
import { listRoster, type RosterLinguist } from "../../api/vendorRoster";
import {
  X,
  Loader2,
  Upload,
  FileText,
  AlertTriangle,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// AcceptConfirmModal
// ---------------------------------------------------------------------------

interface AcceptConfirmProps {
  step: VendorStep;
  onClose: () => void;
  onSuccess: () => void;
}

export function AcceptConfirmModal({ step, onClose, onSuccess }: AcceptConfirmProps) {
  const { sessionToken } = useVendorAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError("");
    try {
      const { status, data } = await acceptStep(sessionToken, step.id, step.offer_id);
      if (status === 410) {
        setError("This offer has expired. Please check for new offers.");
        onSuccess(); // refresh job list to remove expired card
        return;
      }
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || "Failed to accept job");
      }
    } catch {
      setError("Failed to accept job");
    } finally {
      setLoading(false);
    }
  };

  const deadlineStr = step.deadline
    ? new Date(step.deadline).toLocaleDateString("en-CA", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No deadline set";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Accept Job?</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            You&apos;ll be committing to deliver{" "}
            <span className="font-medium text-gray-900">{step.name}</span> for
            Order <span className="font-medium text-gray-900">#{step.order_number}</span>.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Deadline: <span className="font-medium text-gray-700">{deadlineStr}</span></p>
            {step.vendor_total != null && (
              <p>
                Total:{" "}
                <span className="font-medium text-gray-700">
                  {new Intl.NumberFormat("en-CA", {
                    style: "currency",
                    currency: step.vendor_currency || "CAD",
                  }).format(step.vendor_total)}
                </span>
              </p>
            )}
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeclineModal
// ---------------------------------------------------------------------------

interface DeclineProps {
  step: VendorStep;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeclineModal({ step, onClose, onSuccess }: DeclineProps) {
  const { sessionToken } = useVendorAuth();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDecline = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError("");
    try {
      const result = await declineStep(sessionToken, step.id, reason || undefined, step.offer_id);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || "Failed to decline job");
      }
    } catch {
      setError("Failed to decline job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Decline Job</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Decline <span className="font-medium text-gray-900">{step.name}</span> for
            Order #{step.order_number}? The project manager will reassign this step.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you declining this job?"
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
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDecline}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeliverModal
// ---------------------------------------------------------------------------

// Audio recordings (cognitive-debriefing jobs deliver interview audio). Kept
// as a separate list so they can carry a larger size cap than documents.
const AUDIO_EXTENSIONS = [".m4a", ".mp3", ".wav", ".amr"];

const ACCEPTED_EXTENSIONS = [
  ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".html",
  ".rtf", ".jpg", ".png", ".tiff", ".zip",
  ".xliff", ".sdlxliff", ".mqxliff", ".mqxlz",
  ".tmx", ".tbx", ".ttx", ".sdlppx", ".sdlrpx",
  ...AUDIO_EXTENSIONS,
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB (documents)
// Interview recordings run long; allow a higher cap for audio. Note the
// delivery edge function buffers each file in memory, so files much beyond
// this may fail to upload regardless of this limit.
const MAX_AUDIO_FILE_SIZE = 300 * 1024 * 1024; // 300 MB (audio recordings)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAudioFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function maxSizeForFile(file: File): number {
  return isAudioFile(file) ? MAX_AUDIO_FILE_SIZE : MAX_FILE_SIZE;
}

function isValidFileType(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

interface DeliverProps {
  step: VendorStep;
  onClose: () => void;
  onSuccess: (revisionVersion?: number) => void;
}

export function DeliverModal({ step, onClose, onSuccess }: DeliverProps) {
  const { sessionToken, vendor } = useVendorAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [vendorIdentifier, setVendorIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agencies pick the roster linguist who performed the step from a dropdown
  // (replaces the free-text identifier). Non-agency business contractors keep
  // the free-text reference. Solo individuals see the optional free-text field.
  const isAgency = vendor?.vendor_type === "agency";
  const isBusinessNonAgency = !isAgency && vendor?.contractor_type === "business";
  const identifierRequired = isBusinessNonAgency;

  const [rosterLinguists, setRosterLinguists] = useState<RosterLinguist[]>([]);
  const [rosterLoading, setRosterLoading] = useState(isAgency);
  const [selectedLinguistId, setSelectedLinguistId] = useState("");

  // Eligible roster, with pairs matching this step's language pair first.
  const stepSrc = (step.source_language ?? "").toUpperCase();
  const stepTgt = (step.target_language ?? "").toUpperCase();
  const matchesPair = (l: RosterLinguist) =>
    l.language_pairs.some((p) => p.source_language === stepSrc && p.target_language === stepTgt);

  useEffect(() => {
    if (!isAgency || !sessionToken) return;
    let active = true;
    (async () => {
      try {
        const res = await listRoster(sessionToken);
        if (!active) return;
        const eligible = (res.roster ?? []).filter((l) => l.is_eligible);
        eligible.sort((a, b) => (matchesPair(b) ? 1 : 0) - (matchesPair(a) ? 1 : 0));
        setRosterLinguists(eligible);
      } finally {
        if (active) setRosterLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgency, sessionToken]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const newFiles: File[] = [];
    const errors: string[] = [];

    for (const file of Array.from(incoming)) {
      const maxSize = maxSizeForFile(file);
      if (!isValidFileType(file)) {
        errors.push(`"${file.name}" — unsupported file type`);
      } else if (file.size > maxSize) {
        errors.push(`"${file.name}" — exceeds ${Math.round(maxSize / (1024 * 1024))} MB limit`);
      } else {
        newFiles.push(file);
      }
    }

    if (errors.length > 0) {
      setError(errors.join(". "));
    } else {
      setError("");
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleSubmit = async () => {
    if (!sessionToken || files.length === 0) return;
    const trimmedIdentifier = vendorIdentifier.trim();
    if (isAgency && !selectedLinguistId) {
      setError("Select the linguist from your roster who performed this step before delivering.");
      return;
    }
    if (identifierRequired && !trimmedIdentifier) {
      setError("Please add your reference (translator name or internal job code) before delivering.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await deliverStep(
        sessionToken,
        step.id,
        files,
        notes || undefined,
        isAgency ? undefined : (trimmedIdentifier || undefined),
        isAgency ? selectedLinguistId : undefined,
      );
      if (result.success) {
        onSuccess(isRevision ? (step.revision_count ?? 0) + 1 : undefined);
      } else {
        const msg = result.upload_errors?.join(". ") || result.error || "Failed to upload delivery";
        setError(msg);
      }
    } catch {
      setError("Failed to upload delivery");
    } finally {
      setLoading(false);
    }
  };

  const isRevision = step.status === "revision_requested";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">
            {isRevision ? "Deliver Revision" : "Deliver Files"}
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Revision context */}
          {isRevision && step.rejection_reason && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">Revision Requested</p>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{step.rejection_reason}</p>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? "border-teal-400 bg-teal-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Drag and drop files here, or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-teal-600 font-medium hover:text-teal-700"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Max 100 MB per file (300 MB for audio). Accepted: {ACCEPTED_EXTENSIONS.join(", ")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Linguist used — roster picker for agencies, free-text otherwise */}
          {isAgency ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roster linguist who did this work <span className="text-red-500" aria-label="required">*</span>
              </label>
              {rosterLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading your roster…
                </div>
              ) : rosterLinguists.length === 0 ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <p className="flex items-center gap-2 font-medium"><Users className="w-4 h-4" /> No eligible linguists yet</p>
                  <p className="mt-1">
                    Add a linguist (blinded CV, specializations, ISO attestation) on your{" "}
                    <Link to="/roster" className="underline font-medium" onClick={onClose}>Linguist Roster</Link>{" "}
                    before delivering this step.
                  </p>
                </div>
              ) : (
                <>
                  <select
                    value={selectedLinguistId}
                    onChange={(e) => setSelectedLinguistId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">Select linguist…</option>
                    {rosterLinguists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.handle}
                        {l.real_name ? ` — ${l.real_name}` : ""}
                        {matchesPair(l) ? "  ✓ pair match" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Only this name/handle is recorded with Cethos (blinded). Required for ISO 17100 §6.1.2 competence records.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Linguist / vendor used{" "}
                {identifierRequired ? (
                  <span className="text-red-500" aria-label="required">*</span>
                ) : (
                  <span className="text-gray-400 font-normal">(optional)</span>
                )}
              </label>
              <input
                type="text"
                value={vendorIdentifier}
                onChange={(e) => setVendorIdentifier(e.target.value)}
                placeholder={
                  identifierRequired
                    ? "Name or ID of the linguist from your database who did this work"
                    : "Optional — your reference for this delivery"
                }
                required={identifierRequired}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              {identifierRequired && (
                <p className="mt-1 text-xs text-gray-500">
                  Which translator / reviewer from your vendor pool performed this step. Required for ISO 17100 §6.1.2 competence records.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes for the project manager (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isRevision ? "Describe what you changed..." : "Any comments about this delivery..."}
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

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || files.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {isRevision ? "Submit Revision" : "Submit Delivery"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AcceptDirectAssignModal — for directly-assigned steps (status = "assigned")
// ---------------------------------------------------------------------------

interface AcceptDirectProps {
  step: VendorStep;
  onClose: () => void;
  onSuccess: () => void;
}

export function AcceptDirectAssignModal({ step, onClose, onSuccess }: AcceptDirectProps) {
  const { sessionToken } = useVendorAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await acceptDirectAssign(sessionToken, step.id);
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || "Failed to accept assignment");
      }
    } catch {
      setError("Failed to accept assignment");
    } finally {
      setLoading(false);
    }
  };

  const deadlineStr = step.deadline
    ? new Date(step.deadline).toLocaleDateString("en-CA", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No deadline set";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Accept Assignment?</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            You have been directly assigned to{" "}
            <span className="font-medium text-gray-900">{step.name}</span> for
            Order <span className="font-medium text-gray-900">#{step.order_number}</span>.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Deadline: <span className="font-medium text-gray-700">{deadlineStr}</span></p>
            {step.vendor_total != null && (
              <p>
                Total:{" "}
                <span className="font-medium text-gray-700">
                  {new Intl.NumberFormat("en-CA", {
                    style: "currency",
                    currency: step.vendor_currency || "CAD",
                  }).format(step.vendor_total)}
                </span>
              </p>
            )}
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Accept Assignment
          </button>
        </div>
      </div>
    </div>
  );
}
