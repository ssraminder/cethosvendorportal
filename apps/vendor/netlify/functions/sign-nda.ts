/**
 * Netlify Function: sign-nda
 * Records a clickwrap agreement signature (NDA or GVSA — the General
 * Vendor Service Agreement reuses the whole NDA signing stack with an
 * agreement_type discriminator). **Requires** the vendor to have
 * verified an email or phone OTP within the last 30 minutes — this is
 * independent of the session token, so a long-lived session can't
 * bypass identity confirmation at signing time. One OTP verification
 * covers signing both agreements back-to-back: the codes are only
 * consumed once no active agreement remains unsigned.
 *
 * GVSA clause 5.1 recites the NDA as already accepted, so signing the
 * GVSA requires a current NDA signature against the active NDA
 * template first.
 *
 * POST /sb/sign-nda
 * Body: { session_token, signed_full_name, agreement_type?: "nda" | "gvsa" }
 * Returns: { success, signature_id, signed_at, template_version, agreement_type }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface Template {
  id: string;
  version_label: string;
  body_html: string;
}

interface VendorRow {
  email: string;
  full_name: string;
  phone: string | null;
}

// Generous window: a vendor finishes verifying, reads the NDA, types
// their name, ticks the box, clicks sign. 30 minutes is plenty without
// being so long that a stolen session can drift in later.
const OTP_VALID_WINDOW_MINUTES = 30;

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      signed_full_name?: string;
      agreement_type?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const agreementType = body.agreement_type ?? "nda";
    if (agreementType !== "nda" && agreementType !== "gvsa") {
      return err("agreement_type must be 'nda' or 'gvsa'", 400);
    }

    const signedFullName = (body.signed_full_name ?? "").trim();
    if (signedFullName.length < 3) {
      return err("Please type your full legal name (at least 3 characters)", 400);
    }

    const vendors = await query<VendorRow>(
      `SELECT email, full_name, phone FROM vendors WHERE id = $1 LIMIT 1`,
      [vendor_id],
    );
    const vendor = vendors[0];
    if (!vendor) return err("Vendor not found", 404);

    // Identity proof: at least ONE OTP channel (email or phone) must be
    // verified within the window. Email-only is sufficient — keeps the
    // door open for vendors who don't have a phone on file yet, while
    // still preventing a stolen session from signing without a fresh
    // identity check.
    const candidateChannels = ["nda_email", "nda_phone"];

    const verifiedRows = await query<{ id: string; channel: string; email: string | null; phone: string | null; created_at: string }>(
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
        { missing: candidateChannels.map((c) => c === "nda_email" ? "email" : "phone") },
      );
    }

    // Audit log: capture which factor(s) were verified at sign time.
    // Stored on the signature row so the proof of identity travels with
    // the signature itself — auditor-friendly.
    const verificationLog: Record<string, unknown> = {
      channels: verifiedRows.map((r) => r.channel === "nda_email" ? "email" : "phone"),
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
    const verifiedChannels = verifiedRows.map((r) => r.channel);

    const tpls = await query<Template>(
      `SELECT id, version_label, body_html
       FROM nda_templates
       WHERE is_active = true AND jurisdiction = 'global' AND agreement_type = $1
       LIMIT 1`,
      [agreementType],
    );
    const template = tpls[0];
    if (!template) return err(`No active ${agreementType.toUpperCase()} template configured`, 500);

    // GVSA cl. 5.1 incorporates the NDA by reference as already
    // accepted — enforce NDA-first ordering (a staff waiver counts).
    if (agreementType === "gvsa") {
      const ndaOk = await query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM vendor_nda_signatures s
           JOIN nda_templates t ON t.id = s.nda_template_id AND t.is_active = true
           WHERE s.vendor_id = $1 AND s.is_current = true AND s.agreement_type = 'nda'
         ) OR COALESCE((SELECT nda_waived_until > now() FROM vendors WHERE id = $1), false) AS ok`,
        [vendor_id],
      );
      if (!ndaOk[0]?.ok) {
        return err("Please sign the Confidentiality Agreement first — the Service Agreement incorporates it by reference.", 409);
      }
    }

    // Best-effort signer fingerprint from request headers.
    const xff = event.headers?.["x-forwarded-for"] ?? event.headers?.["X-Forwarded-For"] ?? "";
    const signerIp = String(xff).split(",")[0]?.trim() || null;
    const signerUa = (event.headers?.["user-agent"] ?? event.headers?.["User-Agent"] ?? null) as string | null;

    // Supersede any prior current signature of the SAME agreement type
    // — signing the GVSA must never supersede the NDA signature.
    await query(
      `UPDATE vendor_nda_signatures
       SET is_current = false,
           superseded_at = now(),
           superseded_reason = 'Replaced by new signature'
       WHERE vendor_id = $1 AND is_current = true AND agreement_type = $2`,
      [vendor_id, agreementType],
    );

    const inserted = await query<{ id: string; signed_at: string }>(
      `INSERT INTO vendor_nda_signatures
         (vendor_id, nda_template_id, agreement_type, signed_full_name, signed_email,
          signed_at, signer_ip, signer_user_agent, signed_html_snapshot, is_current,
          verification_log)
       VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, true, $9::jsonb)
       RETURNING id, signed_at`,
      [
        vendor_id,
        template.id,
        agreementType,
        signedFullName,
        vendor.email,
        signerIp,
        signerUa,
        template.body_html,
        JSON.stringify(verificationLog),
      ],
    );

    // Mirror status onto vendors row for admin views (best-effort).
    const mirrorSql = agreementType === "nda"
      ? `UPDATE vendors SET nda_signed_at = $1, nda_template_id = $2 WHERE id = $3`
      : `UPDATE vendors SET gvsa_signed_at = $1, gvsa_template_id = $2 WHERE id = $3`;
    await query(mirrorSql, [inserted[0].signed_at, template.id, vendor_id])
      .catch(() => { /* columns may not exist on older deploys */ });

    // One OTP session covers both agreements signed back-to-back. Only
    // consume the codes once nothing remains to sign; otherwise the
    // vendor would need a fresh code for the second document.
    const pending = await query<{ remaining: number }>(
      `SELECT count(*)::int AS remaining
       FROM nda_templates t
       WHERE t.is_active = true AND t.jurisdiction = 'global'
         AND NOT EXISTS (
           SELECT 1 FROM vendor_nda_signatures s
           WHERE s.vendor_id = $1 AND s.is_current = true
             AND s.agreement_type = t.agreement_type
             AND s.nda_template_id = t.id
         )`,
      [vendor_id],
    );
    if ((pending[0]?.remaining ?? 0) === 0) {
      await query(
        `UPDATE vendor_otp SET expires_at = now()
         WHERE vendor_id = $1 AND channel = ANY($2::text[]) AND verified = true
           AND created_at > now() - ($3 || ' minutes')::interval`,
        [vendor_id, verifiedChannels, String(OTP_VALID_WINDOW_MINUTES)],
      );
    }

    return json({
      success: true,
      signature_id: inserted[0].id,
      signed_at: inserted[0].signed_at,
      template_version: template.version_label,
      agreement_type: agreementType,
    });
  } catch (e) {
    console.error("sign-nda error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
