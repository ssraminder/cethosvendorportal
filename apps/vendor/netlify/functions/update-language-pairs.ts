/**
 * Netlify Function: update-language-pairs
 * Port of vendor-update-language-pairs.
 *
 * POST /sb/update-language-pairs
 * Body: {
 *   session_token: string,
 *   action: "add" | "remove" | "toggle",
 *   language_pair_id?, source_language?, target_language?, notes?
 * }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface Body {
  session_token?: string;
  action?: "add" | "remove" | "toggle";
  language_pair_id?: string;
  source_language?: string;
  target_language?: string;
  notes?: string;
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
    if (!action || !["add", "remove", "toggle"].includes(action)) {
      return err("Invalid action. Must be add, remove, or toggle", 400);
    }

    if (action === "add") {
      if (!body.source_language || !body.target_language) {
        return err("source_language and target_language are required", 400);
      }
      const existing = await query<{ id: string }>(
        `SELECT id FROM vendor_language_pairs
         WHERE vendor_id = $1 AND source_language = $2 AND target_language = $3
         LIMIT 1`,
        [vendor_id, body.source_language, body.target_language],
      );
      if (existing[0]) {
        await query(
          `UPDATE vendor_language_pairs SET is_active = true WHERE id = $1`,
          [existing[0].id],
        );
      } else {
        await query(
          `INSERT INTO vendor_language_pairs
             (vendor_id, source_language, target_language, notes, is_active)
           VALUES ($1, $2, $3, $4, true)`,
          [vendor_id, body.source_language, body.target_language, body.notes ?? null],
        );
      }
    } else if (action === "remove") {
      if (!body.language_pair_id) return err("language_pair_id is required for remove", 400);
      await query(
        `UPDATE vendor_language_pairs SET is_active = false
         WHERE id = $1 AND vendor_id = $2`,
        [body.language_pair_id, vendor_id],
      );
    } else {
      // toggle
      if (!body.language_pair_id) return err("language_pair_id is required for toggle", 400);
      const rows = await query<{ is_active: boolean }>(
        `SELECT is_active FROM vendor_language_pairs
         WHERE id = $1 AND vendor_id = $2 LIMIT 1`,
        [body.language_pair_id, vendor_id],
      );
      if (!rows[0]) return err("Language pair not found", 404);
      await query(
        `UPDATE vendor_language_pairs SET is_active = NOT is_active
         WHERE id = $1 AND vendor_id = $2`,
        [body.language_pair_id, vendor_id],
      );
    }

    const language_pairs = await query(
      `SELECT id, source_language, target_language, is_active, notes, created_at
       FROM vendor_language_pairs WHERE vendor_id = $1 ORDER BY source_language`,
      [vendor_id],
    );
    return json({ success: true, language_pairs });
  } catch (e) {
    console.error("update-language-pairs error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
