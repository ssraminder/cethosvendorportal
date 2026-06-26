/**
 * Netlify Function: sign-onboarding-package
 * Records a clickwrap signature for the External Contractor Onboarding &
 * Compliance Package (the 7-document IQVIA package). Reuses the same identity
 * gate as sign-nda: the vendor must have verified an email or phone OTP
 * (channels nda_email / nda_phone) within the last 30 minutes, independent of
 * the session token.
 *
 * The signed package contains and supersedes a Confidentiality/NDA and a
 * Services Agreement (Docs 1 & 2 + the s.11 supersession clause), so signing
 * it also satisfies the separate global NDA/GVSA gate: we set
 * vendors.nda_waived_until far into the future (the gate treats a waiver as
 * covering both agreements). This is intentional and reversible.
 *
 * POST /sb/sign-onboarding-package
 * Body: { session_token, signed_full_name }
 * Returns: { success, signature_id, signed_at, package_id }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { renderOnboardingPackage, type OnboardingFields } from "./_lib/onboarding-template";

const OTP_VALID_WINDOW_MINUTES = 30;
// Far-future waiver that suppresses the SEPARATE global NDA/GVSA gate — the
// onboarding package already incorporates and supersedes both.
const GATE_WAIVER_UNTIL = "2099-12-31T00:00:00Z";

interface PackageRow {
  id: string;
  reference_code: string | null;
  contractor_name: string | null;
  contractor_email: string | null;
  language_pair_display: string | null;
  effective_date_iso: string | null;
  pre_incorp: boolean;
}

interface VendorRow {
  email: string;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      signed_full_name?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const signedFullName = (body.signed_full_name ?? "").trim();
    if (signedFullName.length < 3) {
      return err("Please type your full legal name (at least 3 characters)", 400);
    }

    const vendors = await query<VendorRow>(
      `SELECT email FROM vendors WHERE id = $1 LIMIT 1`,
      [vendor_id],
    );
    const vendor = vendors[0];
    if (!vendor) return err("Vendor not found", 404);

    const pkgs = await query<PackageRow>(
      `SELECT id, reference_code, contractor_name, contractor_email, language_pair_display,
              to_char(engagement_effective_date, 'YYYY-MM-DD') AS effective_date_iso, pre_incorp
         FROM vendor_onboarding_packages
        WHERE vendor_id = $1 AND is_current = true
        LIMIT 1`,
      [vendor_id],
    );
    const pkg = pkgs[0];
    if (!pkg) return err("No onboarding package is assigned to your profile.", 404);

    // Identity proof: at least ONE OTP channel (email or phone) verified
    // within the window. Same gate as sign-nda; email-only is sufficient.
    const candidateChannels = ["nda_email", "nda_phone"];
    const verifiedRows = await query<{
      id: string;
      channel: string;
      email: string | null;
      phone: string | null;
      created_at: string;
    }>(
      `SELECT DISTINCT ON (channel) id, channel, email, phone, created_at
         FROM vendor_otp
        WHERE vendor_id = $1
          AND channel = ANY($2::text[])
          AND verified = true
          AND created_at > now() - ($3 || ' minutes')::interval
        ORDER BY channel, created_at DESC`,
      [vendor_id, candidateChannels, String(OTP_VALID_WINDOW_MINUTES)],
    );
    if (verifiedRows.length === 0) {
      return err(
        "Verification required: please verify your email or phone before signing.",
        403,
        { missing: candidateChannels.map((c) => (c === "nda_email" ? "email" : "phone")) },
      );
    }

    const verificationLog: Record<string, unknown> = {
      channels: verifiedRows.map((r) => (r.channel === "nda_email" ? "email" : "phone")),
    };
    for (const r of verifiedRows) {
      if (r.channel === "nda_email") {
        verificationLog.email = {
          otp_id: r.id,
          verified_at: r.created_at,
          masked: r.email ? `${r.email[0]}***@${r.email.split("@")[1] ?? ""}` : null,
        };
      } else if (r.channel === "nda_phone") {
        verificationLog.phone = {
          otp_id: r.id,
          verified_at: r.created_at,
          masked: r.phone ? `${r.phone.slice(0, 3)}***${r.phone.slice(-2)}` : null,
        };
      }
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

    // Supersede any prior current onboarding signature (re-signs are rare but
    // must keep a clean single-current history).
    await query(
      `UPDATE vendor_nda_signatures
          SET is_current = false, superseded_at = now(),
              superseded_reason = 'Replaced by new onboarding signature'
        WHERE vendor_id = $1 AND is_current = true AND agreement_type = 'onboarding'`,
      [vendor_id],
    );

    const inserted = await query<{ id: string; signed_at: string }>(
      `INSERT INTO vendor_nda_signatures
         (vendor_id, agreement_type, onboarding_package_id, signed_full_name, signed_email,
          signed_at, signer_ip, signer_user_agent, signed_html_snapshot, is_current, verification_log)
       VALUES ($1, 'onboarding', $2, $3, $4, now(), $5, $6, $7, true, $8::jsonb)
       RETURNING id, signed_at`,
      [
        vendor_id,
        pkg.id,
        signedFullName,
        vendor.email,
        signerIp,
        signerUa,
        snapshot,
        JSON.stringify(verificationLog),
      ],
    );

    // Stamp the profile + suppress the separate global NDA/GVSA gate (the
    // package incorporates and supersedes both). Best-effort.
    await query(
      `UPDATE vendors
          SET onboarding_signed_at = $1,
              nda_waived_until = GREATEST(COALESCE(nda_waived_until, $2::timestamptz), $2::timestamptz)
        WHERE id = $3`,
      [inserted[0].signed_at, GATE_WAIVER_UNTIL, vendor_id],
    ).catch(() => { /* columns may not exist on older deploys */ });

    // Consume the OTP codes used for this signature.
    await query(
      `UPDATE vendor_otp SET expires_at = now()
        WHERE vendor_id = $1 AND channel = ANY($2::text[]) AND verified = true
          AND created_at > now() - ($3 || ' minutes')::interval`,
      [vendor_id, candidateChannels, String(OTP_VALID_WINDOW_MINUTES)],
    ).catch(() => {});

    return json({
      success: true,
      signature_id: inserted[0].id,
      signed_at: inserted[0].signed_at,
      package_id: pkg.id,
    });
  } catch (e) {
    console.error("sign-onboarding-package error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
