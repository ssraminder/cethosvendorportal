/**
 * Netlify Function: get-onboarding-package
 * Returns the signed-in vendor's current External Contractor Onboarding &
 * Compliance Package (rendered from merge fields by the shared template) plus
 * whether it has already been signed. Vendors with no package — the normal
 * case for the wider vendor base — get { has_package: false } and the
 * /onboarding route renders an empty state.
 *
 * POST /sb/get-onboarding-package
 * Body: { session_token }
 * Returns: { success, has_package, package?, signed, signature? }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import {
  renderOnboardingPackage,
  onboardingPackageTitle,
  type OnboardingFields,
} from "./_lib/onboarding-template";

interface PackageRow {
  id: string;
  reference_code: string | null;
  contractor_name: string | null;
  contractor_email: string | null;
  language_pair_display: string | null;
  effective_date_iso: string | null;
  pre_incorp: boolean;
}

interface SignatureRow {
  id: string;
  signed_full_name: string;
  signed_at: string;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as { session_token?: string };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const pkgs = await query<PackageRow>(
      `SELECT id, reference_code, contractor_name, contractor_email, language_pair_display,
              to_char(engagement_effective_date, 'YYYY-MM-DD') AS effective_date_iso, pre_incorp
         FROM vendor_onboarding_packages
        WHERE vendor_id = $1 AND is_current = true
        LIMIT 1`,
      [vendor_id],
    );
    const pkg = pkgs[0];
    if (!pkg) return json({ success: true, has_package: false });

    const fields: OnboardingFields = {
      contractor_name: pkg.contractor_name ?? "",
      reference_code: pkg.reference_code ?? "",
      contractor_email: pkg.contractor_email ?? "",
      language_pair_display: pkg.language_pair_display ?? "",
      engagement_effective_date_iso: pkg.effective_date_iso ?? "",
      pre_incorp: !!pkg.pre_incorp,
    };
    const bodyHtml = renderOnboardingPackage(fields);

    const sigs = await query<SignatureRow>(
      `SELECT id, signed_full_name, signed_at
         FROM vendor_nda_signatures
        WHERE vendor_id = $1 AND is_current = true AND agreement_type = 'onboarding'
        ORDER BY signed_at DESC
        LIMIT 1`,
      [vendor_id],
    );
    const sig = sigs[0] ?? null;

    return json({
      success: true,
      has_package: true,
      package: {
        id: pkg.id,
        title: onboardingPackageTitle(),
        reference_code: pkg.reference_code,
        contractor_name: pkg.contractor_name,
        language_pair_display: pkg.language_pair_display,
        engagement_effective_date: fields.engagement_effective_date_iso,
        body_html: bodyHtml,
      },
      signed: !!sig,
      signature: sig
        ? { id: sig.id, signed_full_name: sig.signed_full_name, signed_at: sig.signed_at }
        : null,
    });
  } catch (e) {
    console.error("get-onboarding-package error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
