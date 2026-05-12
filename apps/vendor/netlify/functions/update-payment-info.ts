/**
 * Netlify Function: update-payment-info
 * Port of vendor-update-payment-info. Upserts vendor_payment_info row.
 *
 * POST /sb/update-payment-info
 * Body: {
 *   session_token: string,
 *   payment_method?, payment_details?, payment_currency?, invoice_notes?
 * }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

const VALID_METHODS = new Set([
  "bank_transfer", "paypal", "cheque", "e_transfer", "wire_transfer", "wise",
]);

interface Body {
  session_token?: string;
  payment_method?: string;
  payment_details?: Record<string, unknown>;
  payment_currency?: string;
  invoice_notes?: string;
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

    if (body.payment_method && !VALID_METHODS.has(body.payment_method)) {
      return err(`Invalid payment method. Must be one of: ${Array.from(VALID_METHODS).join(", ")}`, 400);
    }

    const existing = await query<{ id: string }>(
      `SELECT id FROM vendor_payment_info WHERE vendor_id = $1 LIMIT 1`,
      [vendor_id],
    );

    if (existing[0]) {
      const sets: string[] = ["updated_at = now()"];
      const params: unknown[] = [];
      const push = (col: string, val: unknown) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };
      if (body.payment_method !== undefined) push("payment_method", body.payment_method);
      // payment_details is jsonb — stringify so node-postgres doesn't
      // emit it as a Postgres composite/array literal.
      if (body.payment_details !== undefined) push("payment_details", JSON.stringify(body.payment_details));
      if (body.payment_currency !== undefined) push("payment_currency", body.payment_currency);
      if (body.invoice_notes !== undefined) push("invoice_notes", body.invoice_notes);
      params.push(existing[0].id);
      await query(
        `UPDATE vendor_payment_info SET ${sets.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    } else {
      await query(
        `INSERT INTO vendor_payment_info
           (vendor_id, payment_method, payment_details, payment_currency, invoice_notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [
          vendor_id,
          body.payment_method ?? null,
          body.payment_details ? JSON.stringify(body.payment_details) : null,
          body.payment_currency ?? null,
          body.invoice_notes ?? null,
        ],
      );
    }

    const updated = await query(
      `SELECT id, payment_currency, payment_method, invoice_notes, updated_at
       FROM vendor_payment_info WHERE vendor_id = $1 LIMIT 1`,
      [vendor_id],
    );

    return json({ success: true, payment_info: updated[0] ?? null });
  } catch (e) {
    console.error("update-payment-info error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
