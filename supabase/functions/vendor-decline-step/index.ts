// ============================================================================
// vendor-decline-step v1 (rebuilt from scratch — prior bundle unretrievable)
//
// POST { step_id: string, offer_id?: string | null, reason?: string }
// Auth: vendor_sessions bearer token.
//
// Behaviour:
//   * Locates the vendor's pending offer on the step.
//   * Marks it as declined (status='declined', declined_reason=reason,
//     responded_at=now).
//   * Leaves the step itself untouched — sibling offers stay live, admin/PM
//     can still get an acceptance from another vendor. If this was the LAST
//     non-retracted offer, the step is reset to status='pending' / vendor_id
//     null so the admin can re-offer.
//   * Cancels this vendor's pending payable on the step.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Authentication required" }, 401);

    const { data: session } = await sb
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ success: false, error: "Invalid or expired session" }, 401);
    const vendorId = session.vendor_id;

    const body = await req.json().catch(() => ({}));
    const stepId: string | undefined = body?.step_id;
    const offerIdParam: string | undefined = body?.offer_id ?? undefined;
    const reason: string | null = body?.reason ?? null;
    if (!stepId) return json({ success: false, error: "Missing step_id" }, 400);

    let q = sb.from("vendor_step_offers")
      .select("id, vendor_id, status")
      .eq("step_id", stepId)
      .eq("vendor_id", vendorId)
      .eq("status", "pending");
    if (offerIdParam) q = q.eq("id", offerIdParam);
    const { data: offer } = await q.maybeSingle();
    if (!offer) {
      return json({ success: false, error: "No active offer found for you on this step" }, 404);
    }

    const nowIso = new Date().toISOString();
    await sb.from("vendor_step_offers")
      .update({ status: "declined", declined_reason: reason, responded_at: nowIso })
      .eq("id", offer.id);

    await sb.from("vendor_payables")
      .update({ status: "cancelled" })
      .eq("workflow_step_id", stepId)
      .eq("vendor_id", vendorId)
      .eq("status", "pending");

    // If this was the last live offer on the step, reset it so admin can re-offer.
    const { data: remaining } = await sb.from("vendor_step_offers")
      .select("id")
      .eq("step_id", stepId)
      .in("status", ["pending", "offered"]);
    if ((remaining?.length ?? 0) === 0) {
      await sb.from("order_workflow_steps")
        .update({ status: "pending", vendor_id: null, offered_at: null })
        .eq("id", stepId);
    }

    return json({ success: true, declined_at: nowIso, remaining_offers: remaining?.length ?? 0 });
  } catch (err: any) {
    console.error("vendor-decline-step error:", err?.message || err);
    return json({ success: false, error: err?.message || "Internal server error" }, 500);
  }
});
