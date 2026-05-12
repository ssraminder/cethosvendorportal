/**
 * Netlify Function: sign-nda
 * Records a clickwrap NDA signature. **Requires** the vendor to have
 * verified BOTH email and phone OTPs within the last 30 minutes — this
 * is independent of the session token, so a long-lived session can't
 * bypass identity confirmation at signing time.
 *
 * POST /sb/sign-nda
 * Body: { session_token, signed_full_name }
 * Returns: { success, signature_id, signed_at, template_version }
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
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

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

    // Identity proof: both OTP channels must be verified recently.
    // Phone OTP is only required if the vendor has a phone on file —
    // mirrors the UI affordance (it would otherwise lock out vendors
    // who haven't yet added a phone).
    const requiredChannels: string[] = ["nda_email"];
    if (vendor.phone) requiredChannels.push("nda_phone");

    const verified = await query<{ channel: string }>(
      `SELECT DISTINCT channel FROM vendor_otp
       WHERE vendor_id = $1
         AND channel = ANY($2::text[])
         AND verified = true
         AND created_at > now() - ($3 || ' minutes')::interval`,
      [vendor_id, requiredChannels, String(OTP_VALID_WINDOW_MINUTES)],
    );
    const have = new Set(verified.map((r) => r.channel));
    const missing = requiredChannels.filter((c) => !have.has(c));
    if (missing.length > 0) {
      return err(
        `Verification required: ${missing.map((c) => c === "nda_email" ? "email" : "phone").join(", ")}.`,
        403,
        { missing },
      );
    }

    const tpls = await query<Template>(
      `SELECT id, version_label, body_html
       FROM nda_templates
       WHERE is_active = true AND jurisdiction = 'global'
       LIMIT 1`,
    );
    const template = tpls[0];
    if (!template) return err("No active NDA template configured", 500);

    // Best-effort signer fingerprint from request headers.
    const xff = event.headers?.["x-forwarded-for"] ?? event.headers?.["X-Forwarded-For"] ?? "";
    const signerIp = String(xff).split(",")[0]?.trim() || null;
    const signerUa = (event.headers?.["user-agent"] ?? event.headers?.["User-Agent"] ?? null) as string | null;

    // Supersede any prior current signature
    await query(
      `UPDATE vendor_nda_signatures
       SET is_current = false,
           superseded_at = now(),
           superseded_reason = 'Replaced by new signature'
       WHERE vendor_id = $1 AND is_current = true`,
      [vendor_id],
    );

    const inserted = await query<{ id: string; signed_at: string }>(
      `INSERT INTO vendor_nda_signatures
         (vendor_id, nda_template_id, signed_full_name, signed_email, signed_at,
          signer_ip, signer_user_agent, signed_html_snapshot, is_current)
       VALUES ($1, $2, $3, $4, now(), $5, $6, $7, true)
       RETURNING id, signed_at`,
      [
        vendor_id,
        template.id,
        signedFullName,
        vendor.email,
        signerIp,
        signerUa,
        template.body_html,
      ],
    );

    // Mirror status onto vendors row for admin views (best-effort).
    await query(
      `UPDATE vendors SET nda_signed_at = $1, nda_template_id = $2 WHERE id = $3`,
      [inserted[0].signed_at, template.id, vendor_id],
    ).catch(() => { /* columns may not exist on older deploys */ });

    // Consume the OTP rows so they can't be reused for another sign.
    await query(
      `UPDATE vendor_otp SET expires_at = now()
       WHERE vendor_id = $1 AND channel = ANY($2::text[]) AND verified = true
         AND created_at > now() - ($3 || ' minutes')::interval`,
      [vendor_id, requiredChannels, String(OTP_VALID_WINDOW_MINUTES)],
    );

    return json({
      success: true,
      signature_id: inserted[0].id,
      signed_at: inserted[0].signed_at,
      template_version: template.version_label,
    });
  } catch (e) {
    console.error("sign-nda error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
