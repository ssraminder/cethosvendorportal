/**
 * Netlify Function: decline-step
 * Port of vendor-decline-step. Vendor declines a pending offer.
 *
 * POST /sb/decline-step
 * Body: { session_token: string, step_id: string, offer_id?: string, reason?: string }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      step_id?: string;
      offer_id?: string;
      reason?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const stepId = body.step_id;
    const offerIdParam = body.offer_id;
    const reason = body.reason ?? null;
    if (!stepId) return err("Missing step_id", 400);

    const offerSql = offerIdParam
      ? `SELECT id FROM vendor_step_offers
         WHERE step_id = $1 AND vendor_id = $2 AND status = 'pending' AND id = $3
         LIMIT 1`
      : `SELECT id FROM vendor_step_offers
         WHERE step_id = $1 AND vendor_id = $2 AND status = 'pending'
         LIMIT 1`;
    const offerParams = offerIdParam ? [stepId, vendor_id, offerIdParam] : [stepId, vendor_id];

    const offers = await query<{ id: string }>(offerSql, offerParams);
    const offer = offers[0];
    if (!offer) {
      return json({ success: false, error: "No active offer found for you on this step" }, 404);
    }

    const nowIso = new Date().toISOString();

    await query(
      `UPDATE vendor_step_offers
       SET status = 'declined', declined_reason = $2, responded_at = now()
       WHERE id = $1`,
      [offer.id, reason],
    );

    await query(
      `UPDATE vendor_payables
       SET status = 'cancelled'
       WHERE workflow_step_id = $1 AND vendor_id = $2 AND status = 'pending'`,
      [stepId, vendor_id],
    );

    const remaining = await query<{ id: string }>(
      `SELECT id FROM vendor_step_offers
       WHERE step_id = $1 AND status IN ('pending', 'offered')`,
      [stepId],
    );

    if (remaining.length === 0) {
      await query(
        `UPDATE order_workflow_steps
         SET status = 'pending', vendor_id = NULL, offered_at = NULL
         WHERE id = $1`,
        [stepId],
      );
    }

    return json({
      success: true,
      declined_at: nowIso,
      remaining_offers: remaining.length,
    });
  } catch (e) {
    console.error("decline-step error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
