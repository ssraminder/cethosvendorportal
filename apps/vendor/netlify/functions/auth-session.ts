/**
 * Netlify Function: auth-session
 * Validates a vendor's session token and returns the vendor profile.
 * Called on every page load by VendorAuthContext to restore state.
 *
 * POST /sb/auth-session
 * Body: { session_token: string }
 * Returns: { vendor, session, needs_password, is_first_login, is_impersonation, impersonator }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface VendorRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  vendor_type: string | null;
  country: string | null;
  availability_status: string | null;
}

interface SessionRow {
  expires_at: string;
  last_seen_at: string | null;
  is_impersonation: boolean | null;
  impersonator_staff_id: string | null;
}

export const handler = async (event: { body: string | null; isBase64Encoded?: boolean }): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as { session_token?: string };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const sessions = await query<SessionRow>(
      `SELECT expires_at, last_seen_at, is_impersonation, impersonator_staff_id
       FROM vendor_sessions
       WHERE session_token = $1
       LIMIT 1`,
      [body.session_token],
    );
    const session = sessions[0];

    const vendors = await query<VendorRow>(
      `SELECT id, full_name, email, phone, status, vendor_type, country, availability_status
       FROM vendors WHERE id = $1 LIMIT 1`,
      [vendor_id],
    );
    const vendor = vendors[0];
    if (!vendor) return err("Vendor not found", 404);

    const authRows = await query<{ vendor_id: string }>(
      `SELECT vendor_id FROM vendor_auth WHERE vendor_id = $1 LIMIT 1`,
      [vendor_id],
    );

    const translatorRows = await query<{ invite_accepted_at: string | null }>(
      `SELECT invite_accepted_at FROM cvp_translators WHERE email = $1 LIMIT 1`,
      [vendor.email],
    );
    const isFirstLogin = translatorRows[0]
      ? !translatorRows[0].invite_accepted_at
      : false;

    let impersonator: { email: string; full_name: string | null } | null = null;
    if (session?.is_impersonation && session.impersonator_staff_id) {
      const staffRows = await query<{ email: string; full_name: string | null }>(
        `SELECT email, full_name FROM staff_users WHERE id = $1 LIMIT 1`,
        [session.impersonator_staff_id],
      );
      if (staffRows[0]) impersonator = staffRows[0];
    }

    return json({
      vendor,
      session: {
        expires_at: session?.expires_at,
        last_seen_at: new Date().toISOString(),
      },
      needs_password: authRows.length === 0,
      is_first_login: isFirstLogin,
      is_impersonation: !!session?.is_impersonation,
      impersonator,
    });
  } catch (e) {
    console.error("auth-session error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
