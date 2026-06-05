// Onboarding-gate status: fetches CV + NDA status in parallel and
// returns a single `passes` boolean alongside per-gate detail. Wraps
// /sb/get-nda-status (Netlify proxy) and vendor-list-cvs (direct edge
// function) — both already exist in the project.
//
// Cached lightly via React state; refresh() forces a refetch (used by
// the onboarding page after the vendor uploads / signs).

import { useCallback, useEffect, useState } from "react";
import { useVendorAuth } from "../context/VendorAuthContext";
import { FUNCTIONS_BASE } from "../api/functionsBase";

const SB_BASE = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "/sb"
  : "/sb";

interface NdaCurrentSignature {
  signed_at: string;
  template_version_label?: string | null;
}
interface NdaStatus {
  current_signature: NdaCurrentSignature | null;
  needs_signature: boolean;
  waived_until?: string | null;
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
  cvCount: number;
  ndaSignedAt: string | null;
  /** When non-null, NDA gate is satisfied via a staff-set waiver
   *  (vendors.nda_waived_until) — vendor never actually signed. */
  ndaWaivedUntil: string | null;
  /** False for agencies — CV upload is waived. */
  cvRequired: boolean;
  refresh: () => Promise<void>;
}

export function useOnboardingGate(): OnboardingGateState {
  const { sessionToken, vendor } = useVendorAuth();
  // Agencies don't need to upload a CV — they sign the NDA on behalf of
  // the company and operate as an org. Freelancers / in-house / unknown
  // types all keep both gates.
  const cvRequired = (vendor?.vendor_type ?? "").toLowerCase() !== "agency";
  const [loading, setLoading] = useState(true);
  const [hasCv, setHasCv] = useState(false);
  const [hasNda, setHasNda] = useState(false);
  const [cvCount, setCvCount] = useState(0);
  const [ndaSignedAt, setNdaSignedAt] = useState<string | null>(null);
  const [ndaWaivedUntil, setNdaWaivedUntil] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cvRes, ndaRes] = await Promise.all([
        // CV list — vendor-list-cvs. Authorization: Bearer <session>.
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
        // NDA status — Netlify proxy /sb/get-nda-status. session_token in body.
        fetch(`${SB_BASE}/get-nda-status`, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ session_token: sessionToken }),
        })
          .then((r) => r.json())
          .catch(() => null),
      ]);

      const cv = (cvRes as CvListResponse | null) ?? null;
      const cvs = Array.isArray(cv?.cvs) ? cv!.cvs : [];
      setCvCount(cvs.length);
      setHasCv(cvs.length > 0);

      // The Netlify get-nda-status function flips needs_signature=false
      // for two reasons: (a) the vendor has a current signature against
      // the active template, OR (b) staff set vendors.nda_waived_until to
      // a future timestamp. Honor BOTH paths — gating on
      // current_signature presence alone strands waived agencies who
      // never signed at all (e.g. XTRF-imported vendors during the
      // waiver window). See feedback_supabase_bundle_loss_pattern for
      // why the related vendor-get-nda-status edge variant isn't safe to
      // touch separately.
      const nda = (ndaRes as NdaStatus | null) ?? null;
      const signature = nda?.current_signature ?? null;
      setHasNda(!!nda && !nda.needs_signature);
      setNdaSignedAt(signature?.signed_at ?? null);
      setNdaWaivedUntil(nda?.waived_until ?? null);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loading,
    passes: (cvRequired ? hasCv : true) && hasNda,
    hasCv,
    hasNda,
    cvCount,
    ndaSignedAt,
    ndaWaivedUntil,
    cvRequired,
    refresh,
  };
}
