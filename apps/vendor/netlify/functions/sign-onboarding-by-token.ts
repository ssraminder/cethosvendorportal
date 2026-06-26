/**
 * Netlify Function: sign-onboarding-by-token  (PUBLIC — no session)
 * Records a clickwrap signature for the Onboarding & Compliance Package via the
 * emailed signing-link token. The token (delivered only to the contractor's
 * email) is the identity anchor; the signature stores the fully-rendered package
 * snapshot, typed legal name, signer IP/UA, and a verification_log noting the
 * email the link was delivered to — the audit record.
 *
 * Idempotent: if the package is already signed, returns the existing signature
 * rather than creating a duplicate.
 *
 * POST /sb/sign-onboarding-by-token
 * Body: { token, signed_full_name }
 * Returns: { success, signature_id, signed_at, already_signed? }
 */

import { query } from "./_lib/db";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { renderOnboardingPackage, type OnboardingFields } from "./_lib/onboarding-template";

// Far-future waiver that suppresses the separate global NDA/GVSA gate — the
// onboarding package incorporates and supersedes both.
const GATE_WAIVER_UNTIL = "2099-12-31T00:00:00Z";

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

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      token?: string;
      signed_full_name?: string;
    };
    const token = (body.token ?? "").trim();
    if (!token) return err("token required", 400);

    const signedFullName = (body.signed_full_name ?? "").trim();
    if (signedFullName.length < 3) {
      return err("Please type your full legal name (at least 3 characters)", 400);
    }

    const pkgs = await query<PackageRow>(
      `SELECT id, vendor_id, reference_code, contractor_name, contractor_email, language_pair_display,
              to_char(engagement_effective_date, 'YYYY-MM-DD') AS effective_date_iso, pre_incorp
         FROM vendor_onboarding_packages
        WHERE sign_token = $1 AND is_current = true
        LIMIT 1`,
      [token],
    );
    const pkg = pkgs[0];
    if (!pkg) return err("This signing link is invalid or has expired.", 404);

    // Idempotency: already signed → return the existing signature.
    const existing = await query<{ id: string; signed_at: string }>(
      `SELECT id, signed_at FROM vendor_nda_signatures
        WHERE vendor_id = $1 AND is_current = true AND agreement_type = 'onboarding'
        ORDER BY signed_at DESC LIMIT 1`,
      [pkg.vendor_id],
    );
    if (existing[0]) {
      return json({ success: true, already_signed: true, signature_id: existing[0].id, signed_at: existing[0].signed_at });
    }

    const fields: OnboardingFields = {
      contractor_name: pkg.contractor_name ?? "",
      reference_code: pkg.reference_code ?? "",
      contractor_email: pkg.contractor_email ?? "",
      language_pair_display: pkg.language_pair_display ?? "",
      engagement_effective_date_iso: pkg.effective_date_iso ?? "",
      pre_incorp: !!pkg.pre_incorp,
    };
    const snapshot = renderOnboardingPackage(fields);

    const xff = event.headers?.["x-forwarded-for"] ?? event.headers?.["X-Forwarded-For"] ?? "";
    const signerIp = String(xff).split(",")[0]?.trim() || null;
    const signerUa = (event.headers?.["user-agent"] ?? event.headers?.["User-Agent"] ?? null) as string | null;

    const verificationLog = {
      method: "email_link_clickwrap",
      delivered_to: pkg.contractor_email,
      via: "sign_token",
    };

    const inserted = await query<{ id: string; signed_at: string }>(
      `INSERT INTO vendor_nda_signatures
         (vendor_id, agreement_type, onboarding_package_id, signed_full_name, signed_email,
          signed_at, signer_ip, signer_user_agent, signed_html_snapshot, is_current, verification_log)
       VALUES ($1, 'onboarding', $2, $3, $4, now(), $5, $6, $7, true, $8::jsonb)
       RETURNING id, signed_at`,
      [
        pkg.vendor_id,
        pkg.id,
        signedFullName,
        pkg.contractor_email,
        signerIp,
        signerUa,
        snapshot,
        JSON.stringify(verificationLog),
      ],
    );

    // Stamp profile + suppress the separate global NDA/GVSA gate. Best-effort.
    await query(
      `UPDATE vendors
          SET onboarding_signed_at = $1,
              nda_waived_until = GREATEST(COALESCE(nda_waived_until, $2::timestamptz), $2::timestamptz)
        WHERE id = $3`,
      [inserted[0].signed_at, GATE_WAIVER_UNTIL, pkg.vendor_id],
    ).catch(() => {});

    return json({ success: true, signature_id: inserted[0].id, signed_at: inserted[0].signed_at });
  } catch (e) {
    console.error("sign-onboarding-by-token error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
