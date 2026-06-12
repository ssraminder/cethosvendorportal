/**
 * AgreementGateModal
 *
 * Surfaces pending agreement signatures (NDA / GVSA) over the whole
 * authed portal, mirroring NDA clause 7.6 / GVSA clause 8.5:
 *
 *  - "dismissable" (existing vendor, first 14 days after a template
 *    goes live): modal with "Remind me later" — dismissal is per
 *    session (sessionStorage), keyed by the pending template ids so a
 *    newly published template re-surfaces it.
 *  - "blocking" (new registrant, or 14 days elapsed): no dismiss
 *    option. The route gate also redirects gated routes to /onboarding
 *    in this state — the modal covers the non-gated remainder.
 *
 * Hidden on the pages a vendor needs to actually resolve the gate
 * (/nda, /gvsa, /onboarding) and on /profile (kept reachable so
 * vendors can fix contact details used by the signing OTP).
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FileSignature, ShieldCheck, AlertTriangle, ChevronRight, X } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { fetchAgreementStatus, type AgreementStatusItem } from "../../hooks/useOnboardingGate";

const HIDDEN_PATHS = ["/nda", "/gvsa", "/onboarding", "/profile"];
const DISMISS_KEY = "cethos-agreements-dismissed";

const DOC_LABEL: Record<string, { title: string; route: string }> = {
  nda: { title: "Confidentiality Agreement (NDA)", route: "/nda" },
  gvsa: { title: "General Vendor Service Agreement", route: "/gvsa" },
};

export function AgreementGateModal() {
  const { sessionToken } = useVendorAuth();
  const location = useLocation();
  const [pending, setPending] = useState<AgreementStatusItem[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sessionToken) return;
      const res = await fetchAgreementStatus(sessionToken);
      if (cancelled || !res?.agreements) return;
      const needing = res.agreements.filter(
        (a) => a.needs_signature && a.enforcement !== "none",
      );
      setPending(needing);
      const key = needing
        .map((a) => a.template?.id ?? a.agreement_type)
        .sort()
        .join(",");
      setDismissed(
        needing.length > 0 && sessionStorage.getItem(DISMISS_KEY) === key,
      );
    }
    load();
    return () => {
      cancelled = true;
    };
    // Re-check when the route changes so signing one agreement clears
    // it from the modal without a full reload.
  }, [sessionToken, location.pathname]);

  if (pending.length === 0) return null;
  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  const blocking = pending.some((a) => a.enforcement === "blocking");
  if (dismissed && !blocking) return null;

  const graceEnds = pending
    .map((a) => (a.grace_ends_at ? new Date(a.grace_ends_at) : null))
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const dismiss = () => {
    const key = pending
      .map((a) => a.template?.id ?? a.agreement_type)
      .sort()
      .join(",");
    sessionStorage.setItem(DISMISS_KEY, key);
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${blocking ? "bg-red-50" : "bg-amber-50"}`}>
            {blocking ? (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            ) : (
              <FileSignature className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">
              {blocking ? "Signature required to continue" : "Updated agreements to sign"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {blocking
                ? "Portal access requires the following agreement(s) to be signed. This only takes a couple of minutes."
                : `Cethos has published updated vendor agreements. Please review and sign to keep your profile current${graceEnds ? ` — signing becomes required on ${graceEnds.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}` : ""}.`}
            </p>
          </div>
          {!blocking && (
            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              aria-label="Remind me later"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-2">
          {pending.map((a) => {
            const doc = DOC_LABEL[a.agreement_type];
            return (
              <Link
                key={a.agreement_type}
                to={doc.route}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50/40 transition-colors"
              >
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                  <div className="text-xs text-gray-500">
                    {a.template ? `Version ${a.template.version_label}` : ""}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {!blocking && (
            <button
              onClick={dismiss}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Remind me later
            </button>
          )}
          <Link
            to={DOC_LABEL[pending[0].agreement_type].route}
            className="inline-flex items-center gap-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded"
          >
            Review &amp; sign
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
