// vendor-get-jobs v36
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve UUID language IDs → uppercase ISO codes ("EN", "ES-419").
// vendor_language_pairs and the frontend LANGUAGES lookup both use uppercase ISO codes.
async function resolveLanguageCodes(sb: any, uuids: string[]): Promise<Map<string, string>> {
  if (uuids.length === 0) return new Map();
  const { data } = await sb.from("languages").select("id, code").in("id", uuids);
  return new Map((data || []).map((r: any) => [r.id as string, (r.code as string).toUpperCase()]));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return jsonResp({ error: "Authentication required" }, 401);

    const { data: session } = await sb
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .single();
    if (!session) return jsonResp({ error: "Invalid or expired session" }, 401);

    const vendorId = session.vendor_id;
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") || "active";
    let jobs: any[] = [];

    if (tab === "offered") {
      // Admin's update-workflow-step writes status='pending' on insert (see
      // admin repo: supabase/functions/update-workflow-step/index.ts:123, :178).
      // 'sent' was never written by any code path. Production distribution
      // confirms: pending/retracted/accepted/expired only.
      const { data: offers, error: offersErr } = await sb
        .from("vendor_step_offers")
        .select(`
          id, step_id, status, vendor_rate, vendor_rate_unit, vendor_total, vendor_currency, pricing_mode,
          deadline, expires_at, instructions, offered_at, offered_by,
          counter_rate, counter_rate_unit, counter_total, counter_currency,
          counter_deadline, counter_note, counter_status, counter_at,
          counter_responded_at, counter_rejection_reason, negotiation_allowed
        `)
        .eq("vendor_id", vendorId)
        .eq("status", "pending")
        .order("offered_at", { ascending: false });

      if (offersErr) return jsonResp({ error: offersErr.message }, 500);

      if (offers && offers.length > 0) {
        const stepIds = [...new Set(offers.map((o: any) => o.step_id))];
        const { data: steps } = await sb
          .from("order_workflow_steps")
          .select("id, step_number, name, actor_type, service_id, order_id, source_language, target_language, source_file_paths, requires_file_upload, revision_count, offer_count, use_cethos_tm")
          .in("id", stepIds);

        const stepMap: Record<string, any> = {};
        for (const s of steps || []) stepMap[s.id] = s;

        const orderIds = [...new Set((steps || []).map((s: any) => s.order_id))];
        const serviceIds = [...new Set((steps || []).filter((s: any) => s.service_id).map((s: any) => s.service_id))];

        // Fix: orders table has no customer_name column — only select existing columns
        const { data: orders } = await sb.from("orders").select("id, order_number, customer_id").in("id", orderIds);
        const orderMap: Record<string, any> = {};
        for (const o of orders || []) orderMap[o.id] = o;

        let serviceMap: Record<string, string> = {};
        if (serviceIds.length > 0) {
          const { data: svcs } = await sb.from("services").select("id, name").in("id", serviceIds);
          for (const s of svcs || []) serviceMap[s.id] = s.name;
        }

        // Resolve UUID language IDs → uppercase ISO codes
        const langUuids = [...new Set([
          ...(steps || []).map((s: any) => s.source_language).filter((l: any) => l && UUID_RE.test(l)),
          ...(steps || []).map((s: any) => s.target_language).filter((l: any) => l && UUID_RE.test(l)),
        ])] as string[];
        const langCodeMap = await resolveLanguageCodes(sb, langUuids);

        const resolveLang = (val: string | null): string | null => {
          if (!val) return null;
          if (UUID_RE.test(val)) return langCodeMap.get(val) ?? val;
          return val.toUpperCase();
        };

        jobs = offers.map((o: any) => {
          const step = stepMap[o.step_id] || {};
          return {
            offer_id: o.id,
            offer_status: o.status,
            vendor_rate: o.vendor_rate,
            vendor_rate_unit: o.vendor_rate_unit,
            vendor_total: o.vendor_total,
            vendor_currency: o.vendor_currency,
            pricing_mode: o.pricing_mode || "per_unit",
            deadline: o.deadline,
            expires_at: o.expires_at,
            instructions: o.instructions,
            offered_at: o.offered_at,
            counter_status: o.counter_status || "none",
            counter_rate: o.counter_rate,
            counter_rate_unit: o.counter_rate_unit,
            counter_total: o.counter_total,
            counter_currency: o.counter_currency,
            counter_deadline: o.counter_deadline,
            counter_note: o.counter_note,
            counter_at: o.counter_at,
            counter_responded_at: o.counter_responded_at,
            counter_rejection_reason: o.counter_rejection_reason,
            negotiation_allowed: o.negotiation_allowed ?? false,
            id: step.id,
            step_number: step.step_number,
            name: step.name,
            actor_type: step.actor_type,
            status: "offered",
            service_id: step.service_id,
            service_name: step.service_id ? (serviceMap[step.service_id] || null) : null,
            source_language: resolveLang(step.source_language),
            target_language: resolveLang(step.target_language),
            source_file_paths: step.source_file_paths,
            requires_file_upload: step.requires_file_upload,
            revision_count: step.revision_count ?? 0,
            offer_count: step.offer_count ?? 1,
            order_id: step.order_id,
            order_number: orderMap[step.order_id]?.order_number || null,
            customer_name: null, // orders table has no customer_name column
            use_cethos_tm: !!step.use_cethos_tm,
          };
        });
      }
    } else {
      const statusFilter =
        tab === "completed"
          ? ["approved", "cancelled"]
          : ["accepted", "in_progress", "delivered", "revision_requested"];

      const { data: steps, error: stepsErr } = await sb
        .from("order_workflow_steps")
        .select(`
          id, step_number, name, actor_type, status, service_id, order_id, order_document_id, workflow_id,
          vendor_rate, vendor_rate_unit, vendor_total, vendor_currency, pricing_mode, source_language, target_language,
          offered_at, accepted_at, started_at, deadline, delivered_at, approved_at,
          instructions, rejection_reason, revision_count, source_file_paths, delivered_file_paths,
          requires_file_upload, notes_from_vendor, offer_count, use_cethos_tm, created_at, updated_at
        `)
        .eq("vendor_id", vendorId)
        .in("status", statusFilter)
        .order(tab === "completed" ? "approved_at" : "accepted_at", { ascending: false });

      if (stepsErr) return jsonResp({ error: stepsErr.message }, 500);

      if (steps && steps.length > 0) {
        const orderIds = [...new Set(steps.map((s: any) => s.order_id))];
        const serviceIds = [...new Set(steps.filter((s: any) => s.service_id).map((s: any) => s.service_id))];

        // Fix: orders table has no customer_name column
        const { data: orders } = await sb.from("orders").select("id, order_number").in("id", orderIds);
        const orderMap: Record<string, any> = {};
        for (const o of orders || []) orderMap[o.id] = o;

        let serviceMap: Record<string, string> = {};
        if (serviceIds.length > 0) {
          const { data: svcs } = await sb.from("services").select("id, name").in("id", serviceIds);
          for (const s of svcs || []) serviceMap[s.id] = s.name;
        }

        // Resolve UUID language IDs → uppercase ISO codes
        const langUuids = [...new Set([
          ...steps.map((s: any) => s.source_language).filter((l: any) => l && UUID_RE.test(l)),
          ...steps.map((s: any) => s.target_language).filter((l: any) => l && UUID_RE.test(l)),
        ])] as string[];
        const langCodeMap = await resolveLanguageCodes(sb, langUuids);

        const resolveLang = (val: string | null): string | null => {
          if (!val) return null;
          if (UUID_RE.test(val)) return langCodeMap.get(val) ?? val;
          return val.toUpperCase();
        };

        jobs = steps.map((s: any) => ({
          ...s,
          source_language: resolveLang(s.source_language),
          target_language: resolveLang(s.target_language),
          order_number: orderMap[s.order_id]?.order_number || null,
          customer_name: null,
          service_name: s.service_id ? (serviceMap[s.service_id] || null) : null,
        }));
      }
    }

    const { data: sentOffers } = await sb.from("vendor_step_offers").select("id").eq("vendor_id", vendorId).eq("status", "pending");
    const { data: activeSteps } = await sb.from("order_workflow_steps").select("status").eq("vendor_id", vendorId).in("status", ["accepted", "in_progress", "delivered", "revision_requested"]);
    const { data: completedSteps } = await sb.from("order_workflow_steps").select("status").eq("vendor_id", vendorId).in("status", ["approved", "cancelled"]);

    return jsonResp({
      success: true,
      jobs,
      counts: {
        offered: (sentOffers || []).length,
        active: (activeSteps || []).length,
        completed: (completedSteps || []).length,
      },
    });
  } catch (err: any) {
    console.error("vendor-get-jobs error:", err);
    return jsonResp({ error: err.message || "Internal server error" }, 500);
  }
});
