/**
 * Netlify Function: update-profile
 * Port of vendor-update-profile. Partial vendor profile update.
 *
 * POST /sb/update-profile
 * Body: {
 *   session_token: string,
 *   email?, phone?, full_name?, city?, country?, province_state?,
 *   tax_id?, tax_name?, tax_rate?, preferred_rate_currency?, native_languages?
 * }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UpdateBody {
  session_token?: string;
  email?: string;
  phone?: string;
  full_name?: string;
  city?: string;
  country?: string;
  province_state?: string;
  tax_id?: string;
  tax_name?: string;
  tax_rate?: string;
  preferred_rate_currency?: string;
  native_languages?: string[];
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as UpdateBody;
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    // Validate + normalize email separately (uniqueness check).
    let normalizedEmail: string | undefined;
    if (body.email !== undefined) {
      const trimmed = body.email.trim().toLowerCase();
      if (!trimmed || !EMAIL_RE.test(trimmed)) {
        return err("Invalid email address", 400);
      }
      const existing = await query<{ id: string }>(
        `SELECT id FROM vendors WHERE email = $1 AND id <> $2 LIMIT 1`,
        [trimmed, vendor_id],
      );
      if (existing[0]) return err("This email is already in use", 409);
      normalizedEmail = trimmed;
    }

    // Build SET clause dynamically. Parameterize everything.
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (normalizedEmail !== undefined) push("email", normalizedEmail);
    if (body.phone !== undefined) push("phone", body.phone.trim() || null);
    if (body.full_name !== undefined) push("full_name", body.full_name.trim());
    if (body.city !== undefined) push("city", body.city.trim() || null);
    if (body.country !== undefined) {
      const c = body.country.trim() || null;
      push("country", c);
      if (c !== "Canada") {
        push("province_state", null);
        push("tax_name", "N/A");
        push("tax_rate", 0);
      }
    }
    if (body.province_state !== undefined) push("province_state", body.province_state.trim() || null);
    if (body.tax_name !== undefined) push("tax_name", body.tax_name.trim() || null);
    if (body.tax_id !== undefined) push("tax_id", body.tax_id.trim() || null);
    if (body.tax_rate !== undefined) {
      const rate = body.tax_rate ? parseFloat(body.tax_rate) : null;
      if (rate !== null && (rate < 0 || rate > 100)) {
        return err("Tax rate must be between 0 and 100", 400);
      }
      push("tax_rate", rate);
    }
    if (body.preferred_rate_currency !== undefined) {
      push("preferred_rate_currency", body.preferred_rate_currency.trim() || "CAD");
    }
    if (body.native_languages !== undefined) {
      if (!Array.isArray(body.native_languages)) {
        return err("native_languages must be an array", 400);
      }
      // Mirror the client-side cap. Three is the upper bound for someone
      // truthfully claiming native-level fluency; defends against UI bypass.
      if (body.native_languages.length > 3) {
        return err("Maximum of 3 native languages", 400);
      }
      // native_languages is a jsonb column — pass it as a JSON string,
      // otherwise node-postgres serializes the JS array as a Postgres
      // array literal (`{en,fr}`) and the server 500s with "invalid
      // input syntax for type json".
      push("native_languages", JSON.stringify(body.native_languages));
    }

    if (sets.length === 0) return err("No fields to update", 400);

    params.push(vendor_id);
    await query(
      `UPDATE vendors SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );

    // Mirror name/email/phone into cvp_translators (matches old behaviour).
    const fetched = await query<{ email: string }>(
      `SELECT email FROM vendors WHERE id = $1 LIMIT 1`,
      [vendor_id],
    );
    const newEmail = fetched[0]?.email;
    if (newEmail) {
      const tSets: string[] = [];
      const tParams: unknown[] = [];
      const tPush = (col: string, val: unknown) => {
        tParams.push(val);
        tSets.push(`${col} = $${tParams.length}`);
      };
      if (body.email !== undefined && normalizedEmail !== undefined) tPush("email", normalizedEmail);
      if (body.phone !== undefined) tPush("phone", body.phone.trim() || null);
      if (body.full_name !== undefined) tPush("full_name", body.full_name.trim());
      if (tSets.length > 0) {
        tParams.push(newEmail);
        await query(
          `UPDATE cvp_translators SET ${tSets.join(", ")} WHERE email = $${tParams.length}`,
          tParams,
        );
      }
    }

    const updated = await query(
      `SELECT id, full_name, email, phone, status, vendor_type, country, province_state, city,
              availability_status, tax_id, tax_name, tax_rate, preferred_rate_currency, native_languages
       FROM vendors WHERE id = $1 LIMIT 1`,
      [vendor_id],
    );

    return json({ success: true, vendor: updated[0] });
  } catch (e) {
    console.error("update-profile error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
