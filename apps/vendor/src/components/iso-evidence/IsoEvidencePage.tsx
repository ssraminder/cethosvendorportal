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
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  Loader2,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Edit2,
  ShieldCheck,
  HelpCircle,
  XCircle,
  X as XIcon,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
} from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  resolveDocRequest,
  completeIsoEvidenceItem,
  explainIsoEvidenceItem,
  type IsoRequestItem,
  type ResolvedDocRequest,
} from "../../api/isoEvidence";
import { uploadCv } from "../../api/vendorCvs";
import { uploadCertification } from "../../api/vendorProfile";
import { updateProfile } from "../../api/vendorAuth";
import { ISO_REQUEST_ITEM_BY_SLUG } from "../../data/isoRequestItems";
import { guideFor } from "../../data/isoEvidenceGuide";
import { LANGUAGES } from "../../data/languages";
import { PrivacyAcceptanceGate, hasAcceptedPrivacy } from "./PrivacyAcceptanceGate";
import { SpecializationsPicker } from "../shared/SpecializationsPicker";
import { QualifyingRouteSelector } from "./QualifyingRouteSelector";
import {
  QUALIFYING_ROUTES,
  ALL_ROUTE_SLUGS,
  applicableRoutes,
  type RouteKey,
  type QualifyingRoute,
} from "../../data/qualifyingRoutes";

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
  const [search] = useSearchParams();
  const { vendor, sessionToken } = useVendorAuth();
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<ResolvedDocRequest | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [items, setItems] = useState<PageItem[]>([]);
  const [allDone, setAllDone] = useState(false);
  // "I don't have this" modal state — slug + draft reason.
  const [explainSlug, setExplainSlug] = useState<string | null>(null);
  const [explainReason, setExplainReason] = useState("");
  // Per-item "show instructions & examples" expansion state.
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});
  // Privacy-acceptance state. We open the modal lazily on the first
  // upload attempt and stash the pending action so we can resume after
  // the vendor accepts.
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ item: PageItem; file: File } | null>(null);

  // ISO 17100 §3.1.4 qualifying-route state. Inferred from items —
  // a route is "chosen" once its slugs are present AND at least one of
  // the OTHER routes' slugs has been declined (auto-declined on pick).
  const [routeBusy, setRouteBusy] = useState(false);

  // ── Local edits for profile-field items ──────────────────────────────
  const [nativeLangsDraft, setNativeLangsDraft] = useState<string[]>([]);
  const [yearsExpDraft, setYearsExpDraft] = useState<string>("");
  // Specializations are edited via the SpecializationsPicker chip
  // multi-select. We keep them as a string[] (canonical labels), not
  // the comma-separated string the old textarea produced.
  const [specsDraft, setSpecsDraft] = useState<string[]>([]);

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
    setSpecsDraft(r.vendor.profile.specializations ?? []);
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completedCount = useMemo(
    () => items.filter((it) => !!it.completed_at || !!it.declined_at).length,
    [items],
  );

  // Route inference: a route is "chosen" once at least one of its slugs
  // is completed OR all of the OTHER routes' slugs have been declined.
  const routeContext = useMemo(() => {
    const presentSlugs = items.map((it) => it.slug).filter((s) => ALL_ROUTE_SLUGS.has(s));
    if (presentSlugs.length === 0) return { applicable: [], chosen: null, routeItems: [] };
    const applicable = applicableRoutes(presentSlugs);
    // Multi-route mode only kicks in when the request asked for 2+ routes.
    if (applicable.length < 2) return { applicable: [], chosen: null, routeItems: items.filter((it) => presentSlugs.includes(it.slug)) };

    const itemBySlug = new Map(items.map((it) => [it.slug, it]));
    // Find a route whose at-least-one slug is completed (vendor has uploaded for it).
    let chosen: RouteKey | null = null;
    for (const r of QUALIFYING_ROUTES) {
      const slugs = r.required_slugs.filter((s) => presentSlugs.includes(s));
      if (slugs.length === 0) continue;
      if (slugs.some((s) => !!itemBySlug.get(s)?.completed_at)) { chosen = r.key; break; }
    }
    // Fall back: find the route where its slugs are NOT all declined (others must be all declined to indicate route was picked).
    if (!chosen) {
      for (const r of QUALIFYING_ROUTES) {
        const slugs = r.required_slugs.filter((s) => presentSlugs.includes(s));
        if (slugs.length === 0) continue;
        const allDeclined = slugs.every((s) => !!itemBySlug.get(s)?.declined_at);
        if (!allDeclined) {
          const others = applicable.filter((rr) => rr.key !== r.key);
          const othersAllDeclined = others.every((rr) =>
            rr.required_slugs.filter((s) => presentSlugs.includes(s)).every((s) => !!itemBySlug.get(s)?.declined_at),
          );
          if (othersAllDeclined && others.length > 0) { chosen = r.key; break; }
        }
      }
    }
    const routeItems = items.filter((it) => presentSlugs.includes(it.slug));
    return { applicable, chosen, routeItems };
  }, [items]);

  async function handleChooseRoute(route: QualifyingRoute) {
    if (!token) return;
    setRouteBusy(true);
    setErrorMsg(null);
    try {
      // Decline all route slugs that are NOT in the chosen route, with
      // a clear reason. Skip anything already resolved.
      const itemBySlug = new Map(items.map((it) => [it.slug, it]));
      const toDecline = items.filter(
        (it) =>
          ALL_ROUTE_SLUGS.has(it.slug)
          && !route.required_slugs.includes(it.slug)
          && !it.completed_at
          && !it.declined_at,
      );
      const reason = `Pursuing ${route.title} — this route's documents are not applicable for me.`;
      for (const it of toDecline) {
        // Run sequentially so we don't hammer the function with N parallel
        // writes against the same row — supersede-style updates would race.
        // eslint-disable-next-line no-await-in-loop
        const r = await explainIsoEvidenceItem(token, it.slug, reason, sessionToken);
        if (!r.success) {
          throw new Error(r.error ?? `Could not decline ${it.label}`);
        }
      }
      // Optimistic local update so the UI reflects the route immediately.
      setItems((prev) =>
        prev.map((it) => {
          if (!ALL_ROUTE_SLUGS.has(it.slug)) return it;
          if (route.required_slugs.includes(it.slug)) return it;
          if (it.completed_at || it.declined_at) return it;
          return { ...it, declined_at: new Date().toISOString(), decline_reason: reason };
        }),
      );
      // Voiding unused itemBySlug ref (silences ts lint about unused).
      void itemBySlug;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not lock route");
    } finally {
      setRouteBusy(false);
    }
  }

  // Reminder emails can deep-link to a specific slug with ?explain=<slug>
  // to pop the explain modal directly. Apply once items load.
  useEffect(() => {
    const slug = search.get("explain");
    if (slug && items.some((it) => it.slug === slug && !it.completed_at && !it.declined_at)) {
      setExplainSlug(slug);
      setExplainReason("");
    }
  }, [search, items]);

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
    // Privacy gate — first upload of the session opens the consent modal.
    // Once accepted we resume; subsequent uploads skip the gate.
    if (!hasAcceptedPrivacy()) {
      setPendingUpload({ item, file });
      setPrivacyOpen(true);
      return;
    }
    await doUpload(item, file);
  }

  async function doUpload(item: PageItem, file: File) {
    if (!sessionToken) return;
    setBusySlug(item.slug);
    setErrorMsg(null);
    try {
      if (isCvSlug(item.slug)) {
        const res = await uploadCv(sessionToken, file, item.label);
        if (!res.success) throw new Error(res.error ?? "CV upload failed");
      } else {
        // Stream the File directly via multipart. The base64+JSON path
        // was 546-panicking the function on any PDF over ~1 MB.
        const res = await uploadCertification(sessionToken, {
          action: "add",
          cert_name: item.label,
          file,
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

  async function handleExplainSubmit() {
    if (!token || !explainSlug) return;
    const reason = explainReason.trim();
    if (reason.length < 3) { setErrorMsg("Please explain in at least a few words."); return; }
    setBusySlug(explainSlug);
    setErrorMsg(null);
    try {
      const res = await explainIsoEvidenceItem(token, explainSlug, reason, sessionToken);
      if (!res.success) throw new Error(res.error ?? "Could not record");
      setItems((prev) =>
        prev.map((it) =>
          it.slug === explainSlug && !it.completed_at && !it.declined_at
            ? { ...it, declined_at: new Date().toISOString(), decline_reason: reason }
            : it,
        ),
      );
      if (res.data?.all_done) setAllDone(true);
      setExplainSlug(null);
      setExplainReason("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Save failed");
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
        const arr = specsDraft.map((s) => s.trim()).filter(Boolean);
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

        {routeContext.applicable.length >= 2 && (
          <div className={routeBusy ? "opacity-50 pointer-events-none" : ""}>
            <QualifyingRouteSelector
              routeItems={routeContext.routeItems}
              chosenRoute={routeContext.chosen}
              onChoose={handleChooseRoute}
            />
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => {
            const done = !!item.completed_at;
            const declined = !!item.declined_at;
            const resolved = done || declined;
            const busy = busySlug === item.slug;

            // When the doc-request spans multiple §3.1.4 qualifying
            // routes, hide route items: until a route is picked, none
            // of them appear (they're surfaced inside the route
            // selector); once a route is picked, only the chosen
            // route's items show. The others get marked declined by
            // handleChooseRoute and aren't rendered here.
            if (routeContext.applicable.length >= 2 && ALL_ROUTE_SLUGS.has(item.slug)) {
              if (!routeContext.chosen) return null;
              const chosenSlugs =
                QUALIFYING_ROUTES.find((r) => r.key === routeContext.chosen)?.required_slugs ?? [];
              if (!chosenSlugs.includes(item.slug)) return null;
            }

            return (
              <div
                key={item.slug}
                className={`bg-white rounded-xl border p-4 ${done ? "border-emerald-200" : declined ? "border-gray-300" : "border-gray-200"}`}
              >
                <div className="flex items-start gap-3">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                  ) : declined ? (
                    <XCircle className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-300 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium ${resolved ? "text-gray-500 line-through" : "text-gray-900"}`}>
                        {item.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        {item.kind === "profile_field" ? "profile" : "file"}
                      </span>
                    </div>
                    {item.rationale && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.rationale}</p>
                    )}

                    {/* What counts? / Examples disclosure */}
                    {(() => {
                      const guide = guideFor(item.slug);
                      if (!guide) return null;
                      const isOpen = !!openGuides[item.slug];
                      return (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setOpenGuides((s) => ({ ...s, [item.slug]: !s[item.slug] }))}
                            className="inline-flex items-center gap-1 text-[12px] text-teal-700 hover:text-teal-900 font-medium"
                          >
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            {isOpen ? "Hide instructions & examples" : "What counts? Show instructions & examples"}
                          </button>
                          {isOpen && (
                            <div className="mt-2 p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-3">
                              <div className="flex gap-2 text-xs">
                                <Info className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                                <p className="text-gray-700 leading-relaxed">{guide.description}</p>
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                  Examples we accept
                                </div>
                                <ul className="list-disc pl-5 space-y-0.5 text-xs text-gray-700">
                                  {guide.examples.map((ex, i) => (
                                    <li key={i}>{ex}</li>
                                  ))}
                                </ul>
                              </div>
                              {guide.tips && guide.tips.length > 0 && (
                                <div>
                                  <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3" /> Tips
                                  </div>
                                  <ul className="list-disc pl-5 space-y-0.5 text-xs text-gray-700">
                                    {guide.tips.map((t, i) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {!resolved && loggedIn && item.kind === "file" && (
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

                    {!resolved && loggedIn && item.kind === "profile_field" && (
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
                          <SpecializationsPicker
                            value={specsDraft}
                            onChange={setSpecsDraft}
                            disabled={busy}
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

                    {declined && (
                      <div className="mt-2 p-2 bg-gray-50 border border-gray-100 rounded text-[11px] text-gray-600">
                        <div className="font-medium text-gray-700 mb-0.5">Marked unavailable</div>
                        <div className="italic">{item.decline_reason || "No reason given"}</div>
                      </div>
                    )}

                    {!resolved && loggedIn && (
                      <button
                        type="button"
                        onClick={() => { setExplainSlug(item.slug); setExplainReason(""); }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
                      >
                        <HelpCircle className="w-3 h-3" />
                        I don't have this — explain
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {explainSlug && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">
                  Tell us what you have instead
                </h3>
                <button
                  type="button"
                  onClick={() => { setExplainSlug(null); setExplainReason(""); }}
                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Cethos asked for <strong>{items.find((it) => it.slug === explainSlug)?.label}</strong>. If you don't have it or can't get it, describe what you do have — we'll figure out if there's an acceptable substitute.
              </p>
              <textarea
                value={explainReason}
                onChange={(e) => setExplainReason(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="e.g. My original diploma was lost in a move; I can provide a transcript instead — or I'd need a few weeks to request a replacement from the registrar."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
              />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => { setExplainSlug(null); setExplainReason(""); }}
                  disabled={busySlug === explainSlug}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExplainSubmit}
                  disabled={busySlug === explainSlug || explainReason.trim().length < 3}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
                >
                  {busySlug === explainSlug ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {loggedIn && (
          <div className="text-center text-xs text-gray-500">
            <Link to="/" className="text-teal-700 hover:text-teal-900 inline-flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Back to dashboard
            </Link>
          </div>
        )}
      </div>

      <PrivacyAcceptanceGate
        open={privacyOpen}
        onAccept={() => {
          setPrivacyOpen(false);
          const pending = pendingUpload;
          setPendingUpload(null);
          if (pending) void doUpload(pending.item, pending.file);
        }}
        onCancel={() => {
          setPrivacyOpen(false);
          setPendingUpload(null);
        }}
      />
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
