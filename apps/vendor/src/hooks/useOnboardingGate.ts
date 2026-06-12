// Onboarding-gate status: fetches CV + agreement (NDA + GVSA) status in
// parallel and returns a single `passes` boolean alongside per-gate
// detail. Wraps /sb/get-agreement-status (Netlify proxy) and
// vendor-list-cvs (direct edge function).
//
// Agreements carry a clause-7.6/8.5 grace window: enforcement is
// "dismissable" for existing vendors during the first 14 days after a
// template goes live, then "blocking". New registrants (vendor created
// on/after the template's effective_from) are blocking from day 1.
// Only BLOCKING agreements fail the route gate — the dismissable phase
// is surfaced by AgreementGateModal instead.
//
// Cached lightly via React state; refresh() forces a refetch (used by
// the onboarding page after the vendor uploads / signs).

import { useCallback, useEffect, useState } from "react";
import { useVendorAuth } from "../context/VendorAuthContext";
import { FUNCTIONS_BASE } from "../api/functionsBase";

const SB_BASE = "/sb";

export interface AgreementTemplateInfo {
  id: string;
  agreement_type: "nda" | "gvsa";
  version_label: string;
  jurisdiction: string;
  title: string;
  body_html: string;
  effective_from: string;
}

export interface AgreementSignatureInfo {
  id: string;
  agreement_type: "nda" | "gvsa";
  nda_template_id: string;
  signed_full_name: string;
  signed_email: string | null;
  signed_at: string;
  signer_ip: string | null;
  signer_user_agent?: string | null;
  signed_html_snapshot: string;
  verification_log?: unknown;
  template_version_label?: string | null;
}

export interface AgreementStatusItem {
  agreement_type: "nda" | "gvsa";
  template: AgreementTemplateInfo | null;
  current_signature: AgreementSignatureInfo | null;
  needs_signature: boolean;
  reason: string | null;
  enforcement: "none" | "dismissable" | "blocking";
  grace_ends_at: string | null;
}

interface AgreementStatusResponse {
  agreements?: AgreementStatusItem[];
  waived_until?: string | null;
  error?: string;
}

interface CvListResponse {
  success: boolean;
  cvs?: { id: string; is_current: boolean }[];
}

export interface OnboardingGateState {
  loading: boolean;
  passes: boolean;
  hasCv: boolean;
  hasNda: boolean;
  hasGvsa: boolean;
  cvCount: number;
  ndaSignedAt: string | null;
  gvsaSignedAt: string | null;
  /** When non-null, agreement gates are satisfied via a staff-set waiver
   *  (vendors.nda_waived_until) — vendor never actually signed. */
  ndaWaivedUntil: string | null;
  /** False for agencies — CV upload is waived. */
  cvRequired: boolean;
  /** Full per-agreement detail (NDA + GVSA) for the modal/pages. */
  agreements: AgreementStatusItem[];
  refresh: () => Promise<void>;
}

export async function fetchAgreementStatus(sessionToken: string): Promise<AgreementStatusResponse | null> {
  try {
    const res = await fetch(`${SB_BASE}/get-agreement-status`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ session_token: sessionToken }),
    });
    return (await res.json()) as AgreementStatusResponse;
  } catch {
    return null;
  }
}

export function useOnboardingGate(): OnboardingGateState {
  const { sessionToken, vendor } = useVendorAuth();
  // Agencies don't need to upload a CV — they sign the agreements on
  // behalf of the company and operate as an org. Freelancers / in-house
  // / unknown types all keep the CV gate.
  const cvRequired = (vendor?.vendor_type ?? "").toLowerCase() !== "agency";
  const [loading, setLoading] = useState(true);
  const [hasCv, setHasCv] = useState(false);
  const [cvCount, setCvCount] = useState(0);
  const [agreements, setAgreements] = useState<AgreementStatusItem[]>([]);
  const [ndaWaivedUntil, setNdaWaivedUntil] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cvRes, agrRes] = await Promise.all([
        fetch(`${FUNCTIONS_BASE}/vendor-list-cvs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({}),
        })
          .then((r) => r.json())
          .catch(() => null),
        fetchAgreementStatus(sessionToken),
      ]);

      const cv = (cvRes as CvListResponse | null) ?? null;
      const cvs = Array.isArray(cv?.cvs) ? cv!.cvs : [];
      setCvCount(cvs.length);
      setHasCv(cvs.length > 0);

      setAgreements(agrRes?.agreements ?? []);
      setNdaWaivedUntil(agrRes?.waived_until ?? null);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const nda = agreements.find((a) => a.agreement_type === "nda") ?? null;
  const gvsa = agreements.find((a) => a.agreement_type === "gvsa") ?? null;
  const anyBlocking = agreements.some((a) => a.enforcement === "blocking");

  return {
    loading,
    // Dismissable-phase agreements don't fail the gate — the vendor
    // keeps working and sees the reminder modal instead. Blocking ones
    // (new registrants, or grace expired) lock the portal.
    passes: (cvRequired ? hasCv : true) && !anyBlocking,
    hasCv,
    hasNda: !!nda && !nda.needs_signature,
    hasGvsa: !!gvsa && !gvsa.needs_signature,
    cvCount,
    ndaSignedAt: nda?.current_signature?.signed_at ?? null,
    gvsaSignedAt: gvsa?.current_signature?.signed_at ?? null,
    ndaWaivedUntil,
    cvRequired,
    agreements,
    refresh,
  };
}
