// ============================================================================
// vendor-accept-step v1 (rebuilt from scratch — prior bundle unretrievable)
//
// POST { step_id: string, offer_id?: string | null }
// Auth: vendor_sessions bearer token.
//
// Behaviour:
//   * Locates the vendor's pending offer on the step (status='pending').
//   * Marks the offer as accepted (responded_at=now).
//   * Retracts every sibling offer on the same step.
//   * Promotes the step: status='accepted', vendor_id=this vendor, copies
//     vendor_rate / vendor_total / vendor_currency / deadline from the offer,
//     sets accepted_at=now.
//   * Approves the vendor_payable row this vendor already has on the step
//     (created by update-workflow-step when the offer was made) and cancels
//     any pending payables on the step that belonged to other vendors.
//   * Promotes order_workflows from 'not_started' → 'in_progress' if needed.
//
// Status filter is 'pending' (the canonical admin-write value). Older code
// filtered 'sent' which has never been written — that was the bug.
// Date: 2026-05-11
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { notifyAdminVendorAccepted } from "../_shared/notify-step-lifecycle.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Auth ──
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

    // ── Inputs ──
    const body = await req.json().catch(() => ({}));
    const stepId: string | undefined = body?.step_id;
    const offerIdParam: string | undefined = body?.offer_id ?? undefined;
    if (!stepId) return json({ success: false, error: "Missing step_id" }, 400);

    // ── Locate this vendor's pending offer on the step ──
    let offerQuery = sb
      .from("vendor_step_offers")
      .select(
        "id, step_id, vendor_id, status, vendor_rate, vendor_rate_unit, " +
          "vendor_total, vendor_currency, deadline, expires_at, instructions",
      )
      .eq("step_id", stepId)
      .eq("vendor_id", vendorId)
      .eq("status", "pending");
    if (offerIdParam) offerQuery = offerQuery.eq("id", offerIdParam);

    const { data: offer } = await offerQuery.maybeSingle();
    if (!offer) {
      return json({ success: false, error: "No active offer found for you on this step" }, 404);
    }

    // Reject if expired.
    if (offer.expires_at && new Date(offer.expires_at).getTime() < Date.now()) {
      await sb.from("vendor_step_offers")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", offer.id);
      return json({ success: false, error: "Offer has expired" }, 409);
    }

    const nowIso = new Date().toISOString();

    // ── Accept this offer ──
    await sb.from("vendor_step_offers")
      .update({ status: "accepted", responded_at: nowIso })
      .eq("id", offer.id);

    // ── Retract sibling offers on the same step ──
    await sb.from("vendor_step_offers")
      .update({ status: "retracted", responded_at: nowIso })
      .eq("step_id", stepId)
      .neq("id", offer.id)
      .in("status", ["pending", "offered"]);

    // ── Promote the step ──
    const { data: step } = await sb
      .from("order_workflow_steps")
      .select("id, name, step_number, workflow_id, order_id")
      .eq("id", stepId)
      .maybeSingle();

    await sb.from("order_workflow_steps")
      .update({
        status: "accepted",
        vendor_id: vendorId,
        vendor_rate: offer.vendor_rate,
        vendor_rate_unit: offer.vendor_rate_unit,
        vendor_total: offer.vendor_total,
        vendor_currency: offer.vendor_currency,
        deadline: offer.deadline,
        instructions: offer.instructions ?? null,
        accepted_at: nowIso,
      })
      .eq("id", stepId);

    // ── Reconcile vendor_payables for this step ──
    // Approve the accepting vendor's payable (created at offer time);
    // cancel any pending payables belonging to other vendors on the step.
    await sb.from("vendor_payables")
      .update({ status: "approved", approved_at: nowIso })
      .eq("workflow_step_id", stepId)
      .eq("vendor_id", vendorId)
      .eq("status", "pending");

    await sb.from("vendor_payables")
      .update({ status: "cancelled" })
      .eq("workflow_step_id", stepId)
      .neq("vendor_id", vendorId)
      .eq("status", "pending");

    // ── Workflow status bump ──
    if (step?.workflow_id) {
      const { data: workflow } = await sb
        .from("order_workflows")
        .select("status")
        .eq("id", step.workflow_id)
        .maybeSingle();
      if (workflow?.status === "not_started") {
        await sb.from("order_workflows")
          .update({ status: "in_progress" })
          .eq("id", step.workflow_id);
      }
    }

    // Fire-and-forget admin notification. Loads vendor + order in parallel;
    // wrapped so a Brevo / DB hiccup never fails the accept write.
    try {
      const [{ data: vendor }, { data: order }] = await Promise.all([
        sb.from("vendors").select("id, full_name, email").eq("id", vendorId).maybeSingle(),
        step?.order_id
          ? sb.from("orders").select("id, order_number").eq("id", step.order_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (vendor && order) {
        await notifyAdminVendorAccepted({
          supabase: sb,
          vendor: { id: vendor.id, full_name: vendor.full_name, email: vendor.email },
          order: { id: order.id, order_number: order.order_number },
          step: { id: stepId, name: step?.name ?? null, step_number: step?.step_number ?? null },
          offer: {
            id: offer.id,
            rate: offer.vendor_rate == null ? null : Number(offer.vendor_rate),
            total: offer.vendor_total == null ? null : Number(offer.vendor_total),
            currency: offer.vendor_currency ?? null,
          },
        });
      }
    } catch (e: any) {
      console.error("vendor_accepted email fan-out failed:", e?.message || e);
    }

    return json({
      success: true,
      step_id: stepId,
      offer_id: offer.id,
      accepted_at: nowIso,
    });
  } catch (err: any) {
    console.error("vendor-accept-step error:", err?.message || err);
    return json({ success: false, error: err?.message || "Internal server error" }, 500);
  }
});
