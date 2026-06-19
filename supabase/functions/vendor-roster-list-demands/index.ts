// ============================================================================
// vendor-roster-list-demands
//
// Returns Cethos's open (and recently released) evidence demands for the
// calling agency: which roster linguist, which order/step, and why. The
// agency responds via vendor-roster-release-evidence.
//
// Body: { session_token?, include_released? }. Agency-only.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  corsHeaders, json, getServiceClient, resolveVendorId, requireAgency,
} from "../_shared/roster-shared.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* allow empty */ }

    const supabase = getServiceClient();
    const vendorId = await resolveVendorId(supabase, req, body.session_token as string | undefined);
    if (!vendorId) return json({ error: "Invalid or expired session" }, 401);
    const agency = await requireAgency(supabase, vendorId);
    if (!agency.ok) return json({ error: "Roster is available for agency accounts only" }, 403);

    const statuses = body.include_released ? ["open", "released"] : ["open"];

    const { data: demands, error } = await supabase
      .from("roster_evidence_demands")
      .select("id, roster_linguist_id, order_id, step_id, reason, status, raised_at, released_at")
      .eq("vendor_id", vendorId)
      .in("status", statuses)
      .order("raised_at", { ascending: false });
    if (error) return json({ error: "load_failed", detail: error.message }, 500);

    const rows = demands ?? [];
    const linguistIds = [...new Set(rows.map((d) => d.roster_linguist_id))];
    const orderIds = [...new Set(rows.map((d) => d.order_id).filter(Boolean))] as string[];
    const stepIds = [...new Set(rows.map((d) => d.step_id).filter(Boolean))] as string[];

    const [linguistsRes, ordersRes, stepsRes] = await Promise.all([
      linguistIds.length ? supabase.from("vendor_roster_linguists").select("id, handle").in("id", linguistIds) : Promise.resolve({ data: [] }),
      orderIds.length ? supabase.from("orders").select("id, order_number").in("id", orderIds) : Promise.resolve({ data: [] }),
      stepIds.length ? supabase.from("order_workflow_steps").select("id, name, step_number").in("id", stepIds) : Promise.resolve({ data: [] }),
    ]);
    const handleOf = (id: string) => (linguistsRes.data ?? []).find((l: any) => l.id === id)?.handle ?? null;
    const orderOf = (id: string | null) => (ordersRes.data ?? []).find((o: any) => o.id === id)?.order_number ?? null;
    const stepOf = (id: string | null) => (stepsRes.data ?? []).find((s: any) => s.id === id) ?? null;

    const demandsOut = rows.map((d) => {
      const step = stepOf(d.step_id);
      return {
        id: d.id,
        roster_linguist_id: d.roster_linguist_id,
        handle: handleOf(d.roster_linguist_id),
        order_number: orderOf(d.order_id),
        step_label: step ? (step.name ?? `Step ${step.step_number ?? ""}`) : null,
        reason: d.reason,
        status: d.status,
        raised_at: d.raised_at,
        released_at: d.released_at,
      };
    });

    return json({ success: true, demands: demandsOut });
  } catch (err) {
    console.error("vendor-roster-list-demands error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
