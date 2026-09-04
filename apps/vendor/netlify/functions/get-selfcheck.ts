/**
 * Netlify Function: get-selfcheck
 *
 * POST /sb/get-selfcheck
 * Body: { session_token: string, step_id: string }
 *
 * Returns the vendor-facing subset of the pre-release QA checklist that
 * applies to this step (SOP-043 v2 §6 / QA-CL-001 — internal reviewer items
 * are excluded server-side by qms_get_step_selfcheck), plus any answers the
 * vendor already saved. { template: null } means no checklist applies and the
 * deliver flow renders nothing extra.
 *
 * The self-check is a vendor declaration completed before delivery; it never
 * satisfies the internal release gate, which requires the named independent
 * reviewer's own checklist at the QA Review step.
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      step_id?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const stepId = String(body.step_id ?? "");
    if (!UUID_RE.test(stepId)) return err("Missing or invalid step_id", 400);

    // The step must belong to this vendor.
    const steps = await query<{ id: string; vendor_id: string | null }>(
      `SELECT id, vendor_id FROM order_workflow_steps WHERE id = $1::uuid`,
      [stepId],
    );
    if (steps.length === 0) return err("Step not found", 404);
    if (steps[0].vendor_id !== vendor_id) return err("Not authorized for this step", 403);

    const rows = await query<{ data: unknown }>(
      `SELECT public.qms_get_step_selfcheck($1::uuid) AS data`,
      [stepId],
    );
    const data = (rows[0]?.data ?? { template: null }) as Record<string, unknown>;
    return json({ success: true, ...data });
  } catch (e) {
    console.error("get-selfcheck error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
