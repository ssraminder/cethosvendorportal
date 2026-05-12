/**
 * Netlify Function: lookup-tax-rate
 * Port of lookup-tax-rate. No auth required (provinces list is public).
 *
 * POST /sb/lookup-tax-rate
 * Body: { province_code?: string }
 *   - With province_code: returns { success, tax_name, tax_rate }
 *   - Without: returns { success, provinces: [...] }
 */

import { query } from "./_lib/db";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string | undefined> | null;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as { province_code?: string };
    const provinceCode = body.province_code ?? event.queryStringParameters?.province_code;

    if (provinceCode) {
      const rows = await query<{
        region_code: string; region_name: string; tax_name: string; rate: string;
      }>(
        `SELECT region_code, region_name, tax_name, rate
         FROM tax_rates
         WHERE region_type = 'province' AND region_code = $1 AND is_active = true
         LIMIT 1`,
        [provinceCode.toUpperCase()],
      );
      const row = rows[0];
      if (!row) return err("Province not found", 404);

      return json({
        success: true,
        tax_name: row.tax_name,
        tax_rate: parseFloat(row.rate),
      });
    }

    const provinces = await query<{
      region_code: string; region_name: string; tax_name: string; rate: string;
    }>(
      `SELECT region_code, region_name, tax_name, rate
       FROM tax_rates
       WHERE region_type = 'province' AND is_active = true
       ORDER BY region_name`,
    );

    return json({ success: true, provinces });
  } catch (e) {
    console.error("lookup-tax-rate error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
