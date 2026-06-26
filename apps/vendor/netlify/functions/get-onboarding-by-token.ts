/**
 * Netlify Function: get-onboarding-by-token  (PUBLIC — no session)
 * Resolves a signing-link token to the contractor's Onboarding & Compliance
 * Package (rendered) + whether it has been signed. The token is the email-
 * possession identity anchor; it is emailed only to the contractor. Mirrors
 * the public token pattern used by the references / iso-evidence pages.
 *
 * POST /sb/get-onboarding-by-token
 * Body: { token }
 * Returns: { success, found, package?, signed, signed_full_name?, signed_at?, masked_email? }
 */

import { query } from "./_lib/db";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import {
  renderOnboardingPackage,
  onboardingPackageTitle,
  type OnboardingFields,
} from "./_lib/onboarding-template";

interface PackageRow {
  id: string;
  vendor_id: string;
  reference_code: string | null;
  contractor_name: string | null;
  contractor_email: string | null;
  language_pair_display: string | null;
  effective_date_iso: string | null;
  pre_incorp: boolean;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  return `${local[0]}***@${domain}`;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as { token?: string };
    const token = (body.token ?? "").trim();
    if (!token) return err("token required", 400);

    const pkgs = await query<PackageRow>(
      `SELECT id, vendor_id, reference_code, contractor_name, contractor_email, language_pair_display,
              to_char(engagement_effective_date, 'YYYY-MM-DD') AS effective_date_iso, pre_incorp
         FROM vendor_onboarding_packages
        WHERE sign_token = $1 AND is_current = true
        LIMIT 1`,
      [token],
    );
    const pkg = pkgs[0];
    if (!pkg) return json({ success: true, found: false });

    const fields: OnboardingFields = {
      contractor_name: pkg.contractor_name ?? "",
      reference_code: pkg.reference_code ?? "",
      contractor_email: pkg.contractor_email ?? "",
      language_pair_display: pkg.language_pair_display ?? "",
      engagement_effective_date_iso: pkg.effective_date_iso ?? "",
      pre_incorp: !!pkg.pre_incorp,
    };
    const bodyHtml = renderOnboardingPackage(fields);

    const sigs = await query<{ signed_full_name: string; signed_at: string }>(
      `SELECT signed_full_name, signed_at
         FROM vendor_nda_signatures
        WHERE vendor_id = $1 AND is_current = true AND agreement_type = 'onboarding'
        ORDER BY signed_at DESC LIMIT 1`,
      [pkg.vendor_id],
    );
    const sig = sigs[0] ?? null;

    return json({
      success: true,
      found: true,
      signed: !!sig,
      signed_full_name: sig?.signed_full_name ?? null,
      signed_at: sig?.signed_at ?? null,
      masked_email: maskEmail(pkg.contractor_email),
      package: {
        title: onboardingPackageTitle(),
        reference_code: pkg.reference_code,
        contractor_name: pkg.contractor_name,
        language_pair_display: pkg.language_pair_display,
        engagement_effective_date: fields.engagement_effective_date_iso,
        body_html: bodyHtml,
      },
    });
  } catch (e) {
    console.error("get-onboarding-by-token error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
