/**
 * Netlify Function: accept-step
 * Port of vendor-accept-step. Vendor accepts a pending offer on a step.
 *
 * POST /sb/accept-step
 * Body: { session_token: string, step_id: string, offer_id?: string }
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
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const stepId = body.step_id;
    const offerIdParam = body.offer_id;
    if (!stepId) return err("Missing step_id", 400);

    const offerSql = offerIdParam
      ? `SELECT id, step_id, vendor_id, status, vendor_rate, vendor_rate_unit,
                vendor_total, vendor_currency, deadline, expires_at, instructions
         FROM vendor_step_offers
         WHERE step_id = $1 AND vendor_id = $2 AND status = 'pending' AND id = $3
         LIMIT 1`
      : `SELECT id, step_id, vendor_id, status, vendor_rate, vendor_rate_unit,
                vendor_total, vendor_currency, deadline, expires_at, instructions
         FROM vendor_step_offers
         WHERE step_id = $1 AND vendor_id = $2 AND status = 'pending'
         LIMIT 1`;
    const offerParams = offerIdParam ? [stepId, vendor_id, offerIdParam] : [stepId, vendor_id];

    const offers = await query<{
      id: string; vendor_rate: number | null; vendor_rate_unit: string | null;
      vendor_total: number | null; vendor_currency: string | null;
      deadline: string | null; expires_at: string | null; instructions: string | null;
    }>(offerSql, offerParams);
    const offer = offers[0];
    if (!offer) {
      return json({ success: false, error: "No active offer found for you on this step" }, 404);
    }

    if (offer.expires_at && new Date(offer.expires_at).getTime() < Date.now()) {
      await query(
        `UPDATE vendor_step_offers SET status = 'expired', responded_at = now() WHERE id = $1`,
        [offer.id],
      );
      return json({ success: false, error: "Offer has expired" }, 409);
    }

    const nowIso = new Date().toISOString();

    await query(
      `UPDATE vendor_step_offers SET status = 'accepted', responded_at = now() WHERE id = $1`,
      [offer.id],
    );

    await query(
      `UPDATE vendor_step_offers
       SET status = 'retracted', responded_at = now()
       WHERE step_id = $1 AND id <> $2 AND status IN ('pending', 'offered')`,
      [stepId, offer.id],
    );

    const stepRows = await query<{ id: string; workflow_id: string }>(
      `SELECT id, workflow_id FROM order_workflow_steps WHERE id = $1 LIMIT 1`,
      [stepId],
    );
    const stepRow = stepRows[0];

    await query(
      `UPDATE order_workflow_steps
       SET status = 'accepted', vendor_id = $2, vendor_rate = $3, vendor_rate_unit = $4,
           vendor_total = $5, vendor_currency = $6, deadline = $7,
           instructions = $8, accepted_at = now()
       WHERE id = $1`,
      [
        stepId, vendor_id, offer.vendor_rate, offer.vendor_rate_unit,
        offer.vendor_total, offer.vendor_currency, offer.deadline, offer.instructions,
      ],
    );

    await query(
      `UPDATE vendor_payables
       SET status = 'approved', approved_at = now()
       WHERE workflow_step_id = $1 AND vendor_id = $2 AND status = 'pending'`,
      [stepId, vendor_id],
    );

    await query(
      `UPDATE vendor_payables
       SET status = 'cancelled'
       WHERE workflow_step_id = $1 AND vendor_id <> $2 AND status = 'pending'`,
      [stepId, vendor_id],
    );

    if (stepRow?.workflow_id) {
      await query(
        `UPDATE order_workflows SET status = 'in_progress'
         WHERE id = $1 AND status = 'not_started'`,
        [stepRow.workflow_id],
      );
    }

    return json({
      success: true,
      step_id: stepId,
      offer_id: offer.id,
      accepted_at: nowIso,
    });
  } catch (e) {
    console.error("accept-step error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
