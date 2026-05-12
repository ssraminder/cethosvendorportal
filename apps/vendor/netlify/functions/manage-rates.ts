/**
 * Netlify Function: manage-rates
 * Port of vendor-manage-rates. CRUD for vendor_rates.
 *
 * POST /sb/manage-rates
 * Body: {
 *   session_token: string,
 *   action: "get" | "add" | "update" | "remove",
 *   service_id?, calculation_unit?, rate?, currency?, minimum_charge?,
 *   notes?, rate_id?
 * }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface Body {
  session_token?: string;
  action?: "get" | "add" | "update" | "remove";
  service_id?: string;
  calculation_unit?: string;
  rate?: number;
  currency?: string;
  minimum_charge?: number;
  notes?: string;
  rate_id?: string;
}

interface ServiceRow {
  id: string;
  code: string;
  name: string;
  category: string;
  default_calculation_units: string[];
}

interface RateRow {
  id: string;
  service_id: string;
  calculation_unit: string;
  rate: number;
  currency: string;
  minimum_charge: number | null;
  is_active: boolean;
  notes: string | null;
  source: string;
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
    if (!action) return err("action is required", 400);

    if (action === "get") {
      const rates = await query<RateRow>(
        `SELECT id, service_id, calculation_unit, rate, currency, minimum_charge,
                is_active, notes, source
         FROM vendor_rates
         WHERE vendor_id = $1 AND is_active = true
         ORDER BY created_at`,
        [vendor_id],
      );

      const serviceIds = Array.from(new Set(rates.map((r) => r.service_id).filter(Boolean)));
      const services = serviceIds.length > 0
        ? await query<ServiceRow>(
            `SELECT id, code, name, category, default_calculation_units
             FROM services WHERE id = ANY($1::uuid[])`,
            [serviceIds],
          )
        : [];
      const serviceMap = new Map(services.map((s) => [s.id, s]));

      const ratesWithService = rates.map((r) => {
        const svc = serviceMap.get(r.service_id);
        return {
          ...r,
          service_name: svc?.name ?? "Unknown Service",
          service_code: svc?.code ?? "",
          service_category: svc?.category ?? "other",
        };
      });

      const allServices = await query<ServiceRow>(
        `SELECT id, code, name, category, default_calculation_units
         FROM services WHERE vendor_facing = true AND is_active = true
         ORDER BY sort_order`,
      );
      const servicesByCategory: Record<string, ServiceRow[]> = {};
      for (const svc of allServices) {
        (servicesByCategory[svc.category] ??= []).push(svc);
      }

      const vendors = await query<{ preferred_rate_currency: string | null }>(
        `SELECT preferred_rate_currency FROM vendors WHERE id = $1 LIMIT 1`,
        [vendor_id],
      );

      return json({
        success: true,
        rates: ratesWithService,
        services_by_category: servicesByCategory,
        preferred_rate_currency: vendors[0]?.preferred_rate_currency ?? "CAD",
      });
    }

    if (action === "add") {
      if (!body.service_id || !body.calculation_unit || !body.rate || !body.currency) {
        return err("service_id, calculation_unit, rate, and currency are required", 400);
      }
      if (body.rate <= 0) return err("Rate must be greater than 0", 400);

      const existing = await query<{ id: string }>(
        `SELECT id FROM vendor_rates
         WHERE vendor_id = $1 AND service_id = $2 AND calculation_unit = $3 AND is_active = true
         LIMIT 1`,
        [vendor_id, body.service_id, body.calculation_unit],
      );
      if (existing[0]) {
        return err(
          "You already have a rate for this service and unit. Edit the existing rate instead.",
          409,
        );
      }

      const inserted = await query<{ id: string }>(
        `INSERT INTO vendor_rates
           (vendor_id, service_id, calculation_unit, rate, currency, minimum_charge, notes,
            source, added_by, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'self_reported', 'vendor', true, now(), now())
         RETURNING id`,
        [
          vendor_id, body.service_id, body.calculation_unit, body.rate, body.currency,
          body.minimum_charge ?? null, body.notes ?? null,
        ],
      );

      return json({ success: true, message: "Rate added successfully", rate_id: inserted[0]?.id });
    }

    if (action === "update") {
      if (!body.rate_id) return err("rate_id is required", 400);

      const owned = await query<{ id: string }>(
        `SELECT id FROM vendor_rates WHERE id = $1 AND vendor_id = $2 LIMIT 1`,
        [body.rate_id, vendor_id],
      );
      if (!owned[0]) return err("Rate not found", 404);

      const sets: string[] = ["updated_at = now()"];
      const params: unknown[] = [];
      const push = (col: string, val: unknown) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };
      if (body.rate !== undefined) {
        if (body.rate <= 0) return err("Rate must be greater than 0", 400);
        push("rate", body.rate);
      }
      if (body.minimum_charge !== undefined) push("minimum_charge", body.minimum_charge || null);
      if (body.notes !== undefined) push("notes", body.notes || null);

      params.push(body.rate_id);
      await query(
        `UPDATE vendor_rates SET ${sets.join(", ")} WHERE id = $${params.length}`,
        params,
      );

      return json({ success: true, message: "Rate updated successfully" });
    }

    if (action === "remove") {
      if (!body.rate_id) return err("rate_id is required", 400);

      const owned = await query<{ id: string }>(
        `SELECT id FROM vendor_rates WHERE id = $1 AND vendor_id = $2 LIMIT 1`,
        [body.rate_id, vendor_id],
      );
      if (!owned[0]) return err("Rate not found", 404);

      await query(
        `UPDATE vendor_rates SET is_active = false, updated_at = now() WHERE id = $1`,
        [body.rate_id],
      );

      return json({ success: true, message: "Rate removed successfully" });
    }

    return err("Invalid action", 400);
  } catch (e) {
    console.error("manage-rates error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
