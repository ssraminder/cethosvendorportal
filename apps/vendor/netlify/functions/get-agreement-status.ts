/**
 * Netlify Function: get-agreement-status
 * Generalized successor to get-nda-status: returns status for EVERY
 * agreement type (NDA + GVSA) in one call, including the clause-7.6 /
 * 8.5 grace-window enforcement the gate + modal need:
 *
 *   enforcement: "none"        — signed / waived / no active template
 *                "dismissable" — existing vendor, within 14 days of the
 *                                template going live (dismissable modal)
 *                "blocking"    — new registrant (vendor created on/after
 *                                effective_from), or 14+ days elapsed
 *
 * The 14-day clock anchors to nda_templates.effective_from, which is
 * bumped to the activation moment when a template is published.
 * vendors.nda_waived_until is a staff bypass covering both agreements.
 *
 * POST /sb/get-agreement-status
 * Body: { session_token }
 * Returns: { agreements: AgreementStatus[], waived_until }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

const GRACE_DAYS = 14;
const AGREEMENT_TYPES = ["nda", "gvsa"] as const;

interface Template {
  id: string;
  agreement_type: string;
  version_label: string;
  jurisdiction: string;
  title: string;
  body_html: string;
  effective_from: string;
}

interface Signature {
  id: string;
  agreement_type: string;
  nda_template_id: string;
  signed_full_name: string;
  signed_email: string | null;
  signed_at: string;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signed_html_snapshot: string;
  verification_log: unknown;
  template_version_label: string | null;
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

    const [templates, signatures, vendorRows] = await Promise.all([
      query<Template>(
        `SELECT id, agreement_type, version_label, jurisdiction, title, body_html, effective_from
         FROM nda_templates
         WHERE is_active = true AND jurisdiction = 'global'`,
      ),
      query<Signature>(
        `SELECT DISTINCT ON (s.agreement_type)
                s.id, s.agreement_type, s.nda_template_id, s.signed_full_name,
                s.signed_email, s.signed_at, s.signer_ip, s.signer_user_agent,
                s.signed_html_snapshot, s.verification_log,
                t.version_label AS template_version_label
         FROM vendor_nda_signatures s
         LEFT JOIN nda_templates t ON t.id = s.nda_template_id
         WHERE s.vendor_id = $1 AND s.is_current = true
         ORDER BY s.agreement_type, s.signed_at DESC`,
        [vendor_id],
      ),
      query<{ created_at: string; nda_waived_until: string | null }>(
        `SELECT created_at, nda_waived_until FROM vendors WHERE id = $1 LIMIT 1`,
        [vendor_id],
      ),
    ]);

    const vendor = vendorRows[0];
    if (!vendor) return err("Vendor not found", 404);

    const waivedUntilIso = vendor.nda_waived_until ?? null;
    const waived = !!waivedUntilIso && new Date(waivedUntilIso).getTime() > Date.now();

    const agreements = AGREEMENT_TYPES.map((type) => {
      const template = templates.find((t) => t.agreement_type === type) ?? null;
      const current = signatures.find((s) => s.agreement_type === type) ?? null;

      // No active template published for this type → nothing to enforce.
      if (!template) {
        return {
          agreement_type: type,
          template: null,
          current_signature: current,
          needs_signature: false,
          reason: null,
          enforcement: "none" as const,
          grace_ends_at: null,
        };
      }

      let needs = true;
      let reason: string | null = "Not signed yet.";
      if (current && current.nda_template_id === template.id) {
        needs = false;
        reason = null;
      } else if (current) {
        reason = `A newer version of the ${type === "nda" ? "Confidentiality Agreement" : "General Vendor Service Agreement"} is available; please review and sign it.`;
      }

      if (needs && waived) {
        needs = false;
        reason = `Signature waived through ${new Date(waivedUntilIso!).toISOString().slice(0, 10)}.`;
      }

      const effectiveFromMs = new Date(template.effective_from).getTime();
      const graceEndsMs = effectiveFromMs + GRACE_DAYS * 24 * 60 * 60 * 1000;
      // Clause 7.6 / 8.5: vendors registered on/after the template went
      // live must sign before using the portal; existing vendors get the
      // 14-day window, blocking "on or after the date falling fourteen
      // (14) days after" availability.
      const isNewRegistrant = new Date(vendor.created_at).getTime() >= effectiveFromMs;
      // The grace window is for RE-signing a newer version. A vendor
      // with no NDA signature at all (any version) was already hard-
      // blocked by the onboarding gate pre-rollout — never loosen that.
      // GVSA is exempt from this rule at introduction since no vendor
      // has a prior GVSA signature to carry over.
      const neverSignedNda = type === "nda" && !current;
      const enforcement = !needs
        ? ("none" as const)
        : isNewRegistrant || neverSignedNda || Date.now() >= graceEndsMs
          ? ("blocking" as const)
          : ("dismissable" as const);

      return {
        agreement_type: type,
        template,
        current_signature: current,
        needs_signature: needs,
        reason,
        enforcement,
        grace_ends_at: new Date(graceEndsMs).toISOString(),
      };
    });

    return json({ agreements, waived_until: waivedUntilIso });
  } catch (e) {
    console.error("get-agreement-status error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
