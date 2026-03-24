import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ManageRatesRequest {
  action: "get" | "add" | "update" | "remove";
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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return json({ error: "Authentication required" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate session
    const { data: session, error: sessionErr } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionErr || !session) {
      return json({ error: "Invalid or expired session" }, 401);
    }

    const body = (await req.json()) as ManageRatesRequest;

    if (!body.action) {
      return json({ error: "action is required" }, 400);
    }

    // ── GET ──────────────────────────────────────────────────────────
    if (body.action === "get") {
      // Fetch vendor's active rates
      const { data: rates } = await supabase
        .from("vendor_rates")
        .select(
          "id, service_id, calculation_unit, rate, currency, minimum_charge, is_active, notes, source"
        )
        .eq("vendor_id", session.vendor_id)
        .eq("is_active", true)
        .order("created_at");

      // Fetch service info for those rates
      const serviceIds = [
        ...new Set(
          (rates || []).map((r: RateRow) => r.service_id).filter(Boolean)
        ),
      ];

      let serviceMap = new Map<string, ServiceRow>();
      if (serviceIds.length > 0) {
        const { data: svcData } = await supabase
          .from("services")
          .select("id, code, name, category, default_calculation_units")
          .in("id", serviceIds);

        if (svcData) {
          serviceMap = new Map(
            svcData.map((s: ServiceRow) => [s.id, s])
          );
        }
      }

      const ratesWithService = (rates || []).map((r: RateRow) => {
        const svc = serviceMap.get(r.service_id);
        return {
          ...r,
          service_name: svc?.name || "Unknown Service",
          service_code: svc?.code || "",
          service_category: svc?.category || "other",
          // Include calculation_unit from rate, not from service
        };
      });

      // Fetch all vendor-facing active services grouped by category
      const { data: allServices } = await supabase
        .from("services")
        .select("id, code, name, category, default_calculation_units")
        .eq("vendor_facing", true)
        .eq("is_active", true)
        .order("sort_order");

      const servicesByCategory: Record<string, ServiceRow[]> = {};
      for (const svc of (allServices || []) as ServiceRow[]) {
        if (!servicesByCategory[svc.category]) {
          servicesByCategory[svc.category] = [];
        }
        servicesByCategory[svc.category].push({
          id: svc.id,
          code: svc.code,
          name: svc.name,
          category: svc.category,
          default_calculation_units: svc.default_calculation_units,
        });
      }

      // Fetch vendor's preferred rate currency
      const { data: vendor } = await supabase
        .from("vendors")
        .select("preferred_rate_currency")
        .eq("id", session.vendor_id)
        .single();

      return json({
        success: true,
        rates: ratesWithService,
        services_by_category: servicesByCategory,
        preferred_rate_currency: vendor?.preferred_rate_currency || "CAD",
      });
    }

    // ── ADD ──────────────────────────────────────────────────────────
    if (body.action === "add") {
      if (!body.service_id || !body.calculation_unit || !body.rate || !body.currency) {
        return json(
          { error: "service_id, calculation_unit, rate, and currency are required" },
          400
        );
      }

      if (body.rate <= 0) {
        return json({ error: "Rate must be greater than 0" }, 400);
      }

      // Duplicate check: same vendor + service + unit + active
      const { data: existing } = await supabase
        .from("vendor_rates")
        .select("id")
        .eq("vendor_id", session.vendor_id)
        .eq("service_id", body.service_id)
        .eq("calculation_unit", body.calculation_unit)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) {
        return json(
          {
            error:
              "You already have a rate for this service and unit. Edit the existing rate instead.",
          },
          409
        );
      }

      const now = new Date().toISOString();
      const { data: newRate, error: insertErr } = await supabase
        .from("vendor_rates")
        .insert({
          vendor_id: session.vendor_id,
          service_id: body.service_id,
          calculation_unit: body.calculation_unit,
          rate: body.rate,
          currency: body.currency,
          minimum_charge: body.minimum_charge || null,
          notes: body.notes || null,
          source: "self_reported",
          added_by: "vendor",
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Failed to add rate:", insertErr);
        return json({ error: "Failed to add rate" }, 500);
      }

      return json({
        success: true,
        message: "Rate added successfully",
        rate_id: newRate?.id,
      });
    }

    // ── UPDATE ───────────────────────────────────────────────────────
    if (body.action === "update") {
      if (!body.rate_id) {
        return json({ error: "rate_id is required" }, 400);
      }

      // Verify rate belongs to vendor
      const { data: existingRate } = await supabase
        .from("vendor_rates")
        .select("id")
        .eq("id", body.rate_id)
        .eq("vendor_id", session.vendor_id)
        .single();

      if (!existingRate) {
        return json({ error: "Rate not found" }, 404);
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (body.rate !== undefined) {
        if (body.rate <= 0) {
          return json({ error: "Rate must be greater than 0" }, 400);
        }
        updates.rate = body.rate;
      }
      if (body.minimum_charge !== undefined) {
        updates.minimum_charge = body.minimum_charge || null;
      }
      if (body.notes !== undefined) {
        updates.notes = body.notes || null;
      }

      const { error: updateErr } = await supabase
        .from("vendor_rates")
        .update(updates)
        .eq("id", body.rate_id);

      if (updateErr) {
        console.error("Failed to update rate:", updateErr);
        return json({ error: "Failed to update rate" }, 500);
      }

      return json({
        success: true,
        message: "Rate updated successfully",
      });
    }

    // ── REMOVE ───────────────────────────────────────────────────────
    if (body.action === "remove") {
      if (!body.rate_id) {
        return json({ error: "rate_id is required" }, 400);
      }

      // Verify rate belongs to vendor
      const { data: existingRate } = await supabase
        .from("vendor_rates")
        .select("id")
        .eq("id", body.rate_id)
        .eq("vendor_id", session.vendor_id)
        .single();

      if (!existingRate) {
        return json({ error: "Rate not found" }, 404);
      }

      // Soft delete
      const { error: removeErr } = await supabase
        .from("vendor_rates")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.rate_id);

      if (removeErr) {
        console.error("Failed to remove rate:", removeErr);
        return json({ error: "Failed to remove rate" }, 500);
      }

      return json({
        success: true,
        message: "Rate removed successfully",
      });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("vendor-manage-rates error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
