/**
 * Netlify Function: get-nda-status
 * Returns the active NDA template + the vendor's current signature (if
 * any) and whether they need to (re-)sign. Equivalent of
 * vendor-get-nda-status but on the /sb/* Lambda + Postgres pipeline.
 *
 * POST /sb/get-nda-status
 * Body: { session_token }
 * Returns:
 *   {
 *     template: { id, version_label, jurisdiction, title, body_html, effective_from },
 *     current_signature: { ... } | null,
 *     needs_signature: boolean,
 *     reason: string | null,
 *   }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface Template {
  id: string;
  version_label: string;
  jurisdiction: string;
  title: string;
  body_html: string;
  effective_from: string;
}

interface Signature {
  id: string;
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

    const tpls = await query<Template>(
      `SELECT id, version_label, jurisdiction, title, body_html, effective_from
       FROM nda_templates
       WHERE is_active = true AND jurisdiction = 'global'
       LIMIT 1`,
    );
    const template = tpls[0];
    if (!template) return err("No active NDA template configured", 500);

    // Join the template version label so the audit page in the
    // downloaded PDF can show "Signed against template v1.0" even after
    // a newer template has been published.
    const sigs = await query<Signature>(
      `SELECT s.id, s.nda_template_id, s.signed_full_name, s.signed_email, s.signed_at,
              s.signer_ip, s.signer_user_agent, s.signed_html_snapshot, s.verification_log,
              t.version_label AS template_version_label
       FROM vendor_nda_signatures s
       LEFT JOIN nda_templates t ON t.id = s.nda_template_id
       WHERE s.vendor_id = $1 AND s.is_current = true
       ORDER BY s.signed_at DESC
       LIMIT 1`,
      [vendor_id],
    );
    const current = sigs[0] ?? null;

    let needs = true;
    let reason: string | null = "Not signed yet.";
    if (current) {
      if (current.nda_template_id === template.id) {
        needs = false;
        reason = null;
      } else {
        reason = "A newer version of the NDA is available; please re-sign.";
      }
    }

    return json({
      template,
      current_signature: current,
      needs_signature: needs,
      reason,
    });
  } catch (e) {
    console.error("get-nda-status error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
