/**
 * Netlify Function: auth-check
 * Drop-in replacement for the Supabase Edge Function `vendor-auth-check`,
 * but talks to Postgres directly so the request never crosses Supabase's
 * blocked HTTPS edge.
 *
 * POST /sb/auth-check
 * Body: { email: string }
 * Returns: { exists, has_phone, has_password, is_first_login }
 */

import { query } from "./_lib/db";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface VendorRow {
  id: string;
  phone: string | null;
}

interface TranslatorRow {
  invite_accepted_at: string | null;
}

export const handler = async (event: { body: string | null; isBase64Encoded?: boolean }): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as { email?: string };
    const email = (body.email ?? "").toLowerCase().trim();
    if (!email) return err("Email is required", 400);

    const vendors = await query<VendorRow>(
      "SELECT id, phone FROM vendors WHERE email = $1 LIMIT 1",
      [email],
    );
    const vendor = vendors[0];
    if (!vendor) {
      return json({ exists: false, has_phone: false, has_password: false, is_first_login: false });
    }

    const authRows = await query<{ vendor_id: string }>(
      "SELECT vendor_id FROM vendor_auth WHERE vendor_id = $1 LIMIT 1",
      [vendor.id],
    );

    const translatorRows = await query<TranslatorRow>(
      "SELECT invite_accepted_at FROM cvp_translators WHERE email = $1 LIMIT 1",
      [email],
    );
    const isFirstLogin = translatorRows[0]
      ? !translatorRows[0].invite_accepted_at
      : false;

    return json({
      exists: true,
      has_phone: !!vendor.phone,
      has_password: authRows.length > 0,
      is_first_login: isFirstLogin,
    });
  } catch (e) {
    console.error("auth-check error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
