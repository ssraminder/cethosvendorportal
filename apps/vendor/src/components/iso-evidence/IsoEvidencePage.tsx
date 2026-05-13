/**
 * IsoEvidencePage — /iso-evidence/:token
 *
 * Vendor lands here from the admin's "Request Documents" email. The page
 * resolves the token (public read), then renders a checklist of items the
 * admin asked for. Each item has an inline action:
 *   - File items   → upload PDF via vendor-upload-cv (CV slugs) or
 *                    vendor-upload-certification (everything else)
 *   - Profile items → inline form that saves via updateProfile
 *
 * On every successful action the page calls vendor-iso-evidence-complete-item
 * to flip the slug's completed_at on the request row. When all items are
 * satisfied the request transitions to status=completed.
 *
 * Auth: page is publicly reachable via token so vendors with stale sessions
 * can still see what's needed; but acting on items requires login. If not
 * authenticated, the page shows a "Sign in to continue" prompt that links
 * to /login?returnTo=/iso-evidence/:token.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Edit2,
  ShieldCheck,
} from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  resolveDocRequest,
  completeIsoEvidenceItem,
  type IsoRequestItem,
  type ResolvedDocRequest,
} from "../../api/isoEvidence";
import { uploadCv } from "../../api/vendorCvs";
import { uploadCertification } from "../../api/vendorProfile";
import { updateProfile } from "../../api/vendorAuth";
import { ISO_REQUEST_ITEM_BY_SLUG } from "../../data/isoRequestItems";
import { LANGUAGES } from "../../data/languages";

const CV_SLUGS = new Set([
  // The "CV" upload slot only really makes sense for the umbrella CV.
  // We don't currently auto-include a `cv` slug, but expose this set so
  // future items mapped to the CV slot are handled uniformly.
  "cv",
]);

function isCvSlug(slug: string): boolean {
  return CV_SLUGS.has(slug);
}

interface PageItem extends IsoRequestItem {
  label: string;
  rationale: string;
}

function decorateItem(it: IsoRequestItem): PageItem {
  const meta = ISO_REQUEST_ITEM_BY_SLUG[it.slug];
  return {
    ...it,
    label: it.label || meta?.label || it.slug,
    rationale: it.rationale ?? meta?.rationale ?? "",
  };
}

export function IsoEvidencePage() {
  const { token } = useParams<{ token: string }>();
  const { vendor, sessionToken } = useVendorAuth();
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<ResolvedDocRequest | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [items, setItems] = useState<PageItem[]>([]);
  const [allDone, setAllDone] = useState(false);

  // ── Local edits for profile-field items ──────────────────────────────
  const [nativeLangsDraft, setNativeLangsDraft] = useState<string[]>([]);
  const [yearsExpDraft, setYearsExpDraft] = useState<string>("");
  const [specsDraft, setSpecsDraft] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    const r = await resolveDocRequest(token);
    setLoading(false);
    if (!r.success) {
      setErrorMsg(
        r.error === "request_expired"
          ? "This request link has expired. Please contact Cethos to be re-sent."
          : r.error === "request_closed"
          ? `This request is already ${r.status ?? "closed"}.`
          : "We couldn't load this request. The link may be invalid.",
      );
      return;
    }
    setResolved(r);
    setItems(r.request.requested_items.map(decorateItem));
    setAllDone(r.request.status === "completed");
    setNativeLangsDraft(r.vendor.profile.native_languages ?? []);
    setYearsExpDraft(
      r.vendor.profile.years_experience != null
        ? String(r.vendor.profile.years_experience)
        : "",
    );
    setSpecsDraft((r.vendor.profile.specializations ?? []).join(", "));
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completedCount = useMemo(
    () => items.filter((it) => !!it.completed_at).length,
    [items],
  );

  const markComplete = useCallback(
    async (slug: string) => {
      if (!token) return;
      const res = await completeIsoEvidenceItem(token, slug, sessionToken);
      if (!res.success) {
        setErrorMsg(res.error ?? "Could not mark item complete");
        return;
      }
      if (res.data) {
        setItems((prev) =>
          prev.map((it) =>
            it.slug === slug && !it.completed_at
              ? { ...it, completed_at: new Date().toISOString() }
              : it,
          ),
        );
        setAllDone(res.data.all_done);
      }
    },
    [token, sessionToken],
  );

  async function handleFileUpload(item: PageItem, file: File) {
    if (!sessionToken) return;
    setBusySlug(item.slug);
    setErrorMsg(null);
    try {
      if (isCvSlug(item.slug)) {
        const res = await uploadCv(sessionToken, file, item.label);
        if (!res.success) throw new Error(res.error ?? "CV upload failed");
      } else {
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("File read failed"));
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.split(",")[1] ?? "";
        const res = await uploadCertification(sessionToken, {
          action: "add",
          cert_name: item.label,
          file_base64: base64,
          file_name: file.name,
          file_type: file.type || "application/pdf",
        });
        if (res.error) throw new Error(res.error);
      }
      await markComplete(item.slug);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusySlug(null);
    }
  }

  async function handleProfileSave(item: PageItem) {
    if (!sessionToken) return;
    setBusySlug(item.slug);
    setErrorMsg(null);
    try {
      let payload: Parameters<typeof updateProfile>[1] = {};
      if (item.profile_column === "native_languages") {
        if (nativeLangsDraft.length === 0) throw new Error("Pick at least one native language");
        payload = { native_languages: nativeLangsDraft };
      } else if (item.profile_column === "years_experience") {
        const n = Number(yearsExpDraft);
        if (!Number.isFinite(n) || n < 0 || n > 80) throw new Error("Years must be 0–80");
        payload = { years_experience: n };
      } else if (item.profile_column === "specializations") {
        const arr = specsDraft.split(",").map((s) => s.trim()).filter(Boolean);
        if (arr.length === 0) throw new Error("Pick at least one specialization");
        payload = { specializations: arr };
      } else {
        throw new Error("Unknown profile field");
      }
      const res = await updateProfile(sessionToken, payload);
      if (res.error) throw new Error(res.error);
      await markComplete(item.slug);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusySlug(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (errorMsg && !resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-red-200 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-sm text-gray-600">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!resolved) return null;

  const loggedIn = !!vendor && vendor.id === resolved.vendor.id;
  const wrongVendor = !!vendor && vendor.id !== resolved.vendor.id;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h1 className="text-lg font-semibold text-gray-900">
              ISO 17100 evidence — Cethos
            </h1>
          </div>
          <p className="text-sm text-gray-600">
            Hi {resolved.vendor.first_name || "there"}, Cethos has asked you to
            complete the following items so we can keep your vendor profile
            aligned with ISO 17100. Items marked <em>(profile)</em> are short
            fields you fill in right here; items marked <em>(file)</em> need a
            PDF upload.
          </p>
          {resolved.request.staff_message && (
            <div className="mt-3 p-3 rounded border border-gray-200 bg-gray-50 text-xs text-gray-700 italic">
              "{resolved.request.staff_message}"
            </div>
          )}
          <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
            <span>
              Expires {new Date(resolved.request.expires_at).toLocaleDateString()}
            </span>
            <span>·</span>
            <span>
              {completedCount} of {items.length} complete
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${items.length === 0 ? 0 : Math.round((completedCount / items.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        {wrongVendor && (
          <div className="bg-white rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            You're signed in as a different vendor account. Sign out and sign
            back in as <strong>{resolved.vendor.email}</strong> to act on this
            request.
          </div>
        )}

        {!vendor && (
          <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/40 p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-blue-900">
              <strong>Sign in to continue</strong>
              <div className="text-xs mt-0.5">
                We need you to sign in as <span className="font-mono">{resolved.vendor.email}</span> before you can upload files or edit your profile.
              </div>
            </div>
            <Link
              to={`/login?returnTo=${encodeURIComponent(`/iso-evidence/${token}`)}`}
              className="shrink-0 inline-flex items-center px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            >
              Sign in
            </Link>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {allDone && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-900">
              All set — every item is on file. We'll re-run the assessment on our side.
            </div>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => {
            const done = !!item.completed_at;
            const busy = busySlug === item.slug;
            return (
              <div
                key={item.slug}
                className={`bg-white rounded-xl border p-4 ${done ? "border-emerald-200" : "border-gray-200"}`}
              >
                <div className="flex items-start gap-3">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-300 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium ${done ? "text-gray-500 line-through" : "text-gray-900"}`}>
                        {item.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        {item.kind === "profile_field" ? "profile" : "file"}
                      </span>
                    </div>
                    {item.rationale && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.rationale}</p>
                    )}

                    {!done && loggedIn && item.kind === "file" && (
                      <div className="mt-3">
                        <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium cursor-pointer ${busy ? "bg-gray-100 text-gray-400" : "bg-teal-600 text-white hover:bg-teal-700"}`}>
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {busy ? "Uploading…" : "Upload PDF"}
                          <input
                            type="file"
                            accept="application/pdf"
                            disabled={busy}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(item, file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {!done && loggedIn && item.kind === "profile_field" && (
                      <div className="mt-3 space-y-2">
                        {item.profile_column === "native_languages" && (
                          <NativeLanguageEditor
                            value={nativeLangsDraft}
                            onChange={setNativeLangsDraft}
                            disabled={busy}
                          />
                        )}
                        {item.profile_column === "years_experience" && (
                          <input
                            type="number"
                            min={0}
                            max={80}
                            step={1}
                            value={yearsExpDraft}
                            onChange={(e) => setYearsExpDraft(e.target.value)}
                            disabled={busy}
                            placeholder="e.g. 7"
                            className="w-32 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        )}
                        {item.profile_column === "specializations" && (
                          <input
                            type="text"
                            value={specsDraft}
                            onChange={(e) => setSpecsDraft(e.target.value)}
                            disabled={busy}
                            placeholder="Legal, Medical, Marketing (comma-separated)"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleProfileSave(item)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                          {busy ? "Saving…" : "Save"}
                        </button>
                      </div>
                    )}

                    {done && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Completed {new Date(item.completed_at!).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {loggedIn && (
          <div className="text-center text-xs text-gray-500">
            <Link to="/" className="text-teal-700 hover:text-teal-900 inline-flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function NativeLanguageEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [pick, setPick] = useState("");
  const remaining = LANGUAGES.filter((l) => !value.includes(l.code));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-gray-400">No languages selected.</span>}
        {value.map((code) => {
          const lang = LANGUAGES.find((l) => l.code === code);
          return (
            <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 text-xs">
              {lang?.name ?? code}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== code))}
                disabled={disabled}
                className="text-teal-600 hover:text-teal-800"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      {value.length < 3 && (
        <div className="flex gap-2">
          <select
            value={pick}
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                onChange([...value, v]);
                setPick("");
              }
            }}
            disabled={disabled}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">+ Add language</option>
            {remaining.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400 self-center">
            ({value.length}/3 max)
          </span>
        </div>
      )}
    </div>
  );
}
