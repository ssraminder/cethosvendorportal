/**
 * Netlify Function: request-contractor-upgrade
 * Vendor files (or withdraws) a request to be upgraded from
 * 'individual' to 'business'. Only one pending request per vendor at a
 * time (enforced by partial unique index on vendor_contractor_upgrade_requests).
 *
 * POST /sb/request-contractor-upgrade
 * Body: { session_token, action: 'submit' | 'withdraw', justification?: string }
 * Returns: { success, request: { id, status, ... } }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface Body {
  session_token?: string;
  action?: "submit" | "withdraw";
  justification?: string;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as Body;
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const action = body.action;
    if (action !== "submit" && action !== "withdraw") {
      return err("action must be 'submit' or 'withdraw'", 400);
    }

    if (action === "submit") {
      // Confirm current state; only individuals can request a business
      // upgrade. Already-business vendors get a 409.
      const v = await query<{ contractor_type: string }>(
        `SELECT contractor_type FROM vendors WHERE id = $1 LIMIT 1`,
        [vendor_id],
      );
      const currentType = v[0]?.contractor_type ?? "individual";
      if (currentType !== "individual") {
        return err("Only individual vendors can request a business upgrade", 409);
      }

      // Block if there's already a pending request — the unique index
      // would catch it, but a friendly 409 is nicer than a constraint
      // error.
      const existing = await query<{ id: string }>(
        `SELECT id FROM vendor_contractor_upgrade_requests
         WHERE vendor_id = $1 AND status = 'pending' LIMIT 1`,
        [vendor_id],
      );
      if (existing[0]) {
        return err("You already have a pending upgrade request", 409);
      }

      const justification = (body.justification ?? "").trim() || null;

      const inserted = await query<{
        id: string;
        from_type: string;
        to_type: string;
        status: string;
        requested_at: string;
        vendor_justification: string | null;
      }>(
        `INSERT INTO vendor_contractor_upgrade_requests
           (vendor_id, from_type, to_type, status, vendor_justification)
         VALUES ($1, 'individual', 'business', 'pending', $2)
         RETURNING id, from_type, to_type, status, requested_at, vendor_justification`,
        [vendor_id, justification],
      );

      return json({ success: true, request: inserted[0] });
    }

    // action === 'withdraw'
    const pending = await query<{ id: string }>(
      `SELECT id FROM vendor_contractor_upgrade_requests
       WHERE vendor_id = $1 AND status = 'pending'
       ORDER BY requested_at DESC
       LIMIT 1`,
      [vendor_id],
    );
    if (!pending[0]) {
      return err("No pending request to withdraw", 404);
    }
    await query(
      `UPDATE vendor_contractor_upgrade_requests
       SET status = 'withdrawn', updated_at = now()
       WHERE id = $1`,
      [pending[0].id],
    );
    return json({ success: true, request: { id: pending[0].id, status: "withdrawn" } });
  } catch (e) {
    console.error("request-contractor-upgrade error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
