/**
 * Netlify Function: list-doc-requests
 *
 * Returns all ISO 17100 document requests for the authed vendor, ordered
 * by created_at desc. The /documents page in the vendor portal uses this
 * to surface open requests so vendors don't need the original email to
 * find their checklist.
 *
 * POST /sb/list-doc-requests
 * Body: { session_token: string }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface DocRequestRow {
  id: string;
  request_token: string;
  request_token_expires_at: string;
  status: "draft" | "sent" | "partial" | "completed" | "expired" | "superseded";
  staff_message: string | null;
  requested_items: Array<{
    slug: string;
    label: string;
    kind: "file" | "profile_field";
    completed_at: string | null;
    declined_at: string | null;
    decline_reason: string | null;
  }>;
  reminder_count: number;
  last_reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
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

    const rows = await query<DocRequestRow>(
      `SELECT id, request_token, request_token_expires_at, status,
              staff_message, requested_items, reminder_count, last_reminder_at,
              completed_at, created_at
       FROM vendor_document_requests
       WHERE vendor_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [vendor_id],
    );

    return json({ success: true, requests: rows });
  } catch (e) {
    console.error("list-doc-requests error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
