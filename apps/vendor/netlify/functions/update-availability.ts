/**
 * Netlify Function: update-availability
 * Port of vendor-update-availability.
 *
 * POST /sb/update-availability
 * Body: { session_token: string, availability_status: string }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

const VALID = new Set(["available", "busy", "vacation", "unavailable", "on_leave"]);

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      availability_status?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const status = body.availability_status;
    if (!status || !VALID.has(status)) {
      return err(`Invalid status. Must be one of: ${Array.from(VALID).join(", ")}`, 400);
    }

    await query(
      `UPDATE vendors SET availability_status = $1, updated_at = now() WHERE id = $2`,
      [status, vendor_id],
    );

    return json({ success: true, availability_status: status });
  } catch (e) {
    console.error("update-availability error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
