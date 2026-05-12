// ============================================================================
// vendor-counter-offer v1 (rebuilt from scratch — prior bundle unretrievable)
//
// POST {
//   offer_id, step_id,
//   counter_rate, counter_rate_unit, counter_total, counter_currency,
//   counter_deadline, counter_note
// }
// Auth: vendor_sessions bearer token.
//
// Behaviour:
//   * Loads the vendor's pending offer; rejects if not negotiable or not
//     pending or expired.
//   * Auto-accept logic: when the admin set negotiation bounds
//     (max_rate / max_total / latest_deadline) AND
//     auto_accept_within_limits=true, AND the counter falls inside ALL
//     bounds, the function treats the counter as an Accept — applies the
//     counter values to the offer + step + payable, marks
//     counter_status='accepted', and promotes the step the same way
//     vendor-accept-step does. Sibling offers are retracted.
//   * Otherwise the counter is queued for admin review:
//     counter_status='proposed', counter_at=now. The offer stays
//     status='pending' so the admin can review.
//
// Returns: { success, auto_accepted, auto_assigned }
//   auto_accepted=true  → counter was within bounds and applied
//   auto_assigned=true  → step is now assigned to this vendor (set when
//                         auto_accepted=true; allows the UI to switch tabs)
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  notifyAdminCounterProposed,
  notifyCounterAutoAccepted,
} from "../_shared/notify-counter.ts";

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
    const offerId: string | undefined = body?.offer_id;
    const stepId: string | undefined = body?.step_id;
    const counterRate = body?.counter_rate == null ? null : Number(body.counter_rate);
    const counterRateUnit: string | null = body?.counter_rate_unit ?? null;
    const counterTotal = body?.counter_total == null ? null : Number(body.counter_total);
    const counterCurrency: string = body?.counter_currency || "CAD";
    const counterDeadline: string | null = body?.counter_deadline ?? null;
    const counterNote: string = body?.counter_note ?? "";
    if (!offerId || !stepId) return json({ success: false, error: "Missing offer_id or step_id" }, 400);

    const { data: offer } = await sb
      .from("vendor_step_offers")
      .select(
        "id, vendor_id, status, vendor_rate, vendor_rate_unit, vendor_total, vendor_currency, " +
          "deadline, expires_at, instructions, negotiation_allowed, max_rate, max_total, " +
          "latest_deadline, auto_accept_within_limits",
      )
      .eq("id", offerId)
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (!offer) return json({ success: false, error: "Offer not found" }, 404);
    if (offer.status !== "pending") return json({ success: false, error: "Offer is not pending" }, 409);
    if (!offer.negotiation_allowed) return json({ success: false, error: "Negotiation not allowed on this offer" }, 403);
    if (offer.expires_at && new Date(offer.expires_at).getTime() < Date.now()) {
      await sb.from("vendor_step_offers")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", offer.id);
      return json({ success: false, error: "Offer has expired" }, 409);
    }

    // ── Auto-accept evaluation ──
    let withinLimits = true;
    if (offer.max_rate != null && counterRate != null) {
      if (counterRate > Number(offer.max_rate)) withinLimits = false;
    }
    if (offer.max_total != null && counterTotal != null) {
      if (counterTotal > Number(offer.max_total)) withinLimits = false;
    }
    if (offer.latest_deadline && counterDeadline) {
      if (new Date(counterDeadline).getTime() > new Date(offer.latest_deadline).getTime()) {
        withinLimits = false;
      }
    }

    const autoAccept = !!offer.auto_accept_within_limits && withinLimits;
    const nowIso = new Date().toISOString();

    if (autoAccept) {
      // Accept-with-counter-terms path. Apply counter values to the offer
      // and the step, then run the same promotion logic as vendor-accept-step.
      const finalRate = counterRate ?? offer.vendor_rate;
      const finalRateUnit = counterRateUnit ?? offer.vendor_rate_unit;
      const finalTotal = counterTotal ?? offer.vendor_total;
      const finalCurrency = counterCurrency || offer.vendor_currency || "CAD";
      const finalDeadline = counterDeadline ?? offer.deadline;

      await sb.from("vendor_step_offers")
        .update({
          status: "accepted",
          counter_status: "accepted",
          counter_rate: counterRate,
          counter_rate_unit: counterRateUnit,
          counter_total: counterTotal,
          counter_currency: counterCurrency,
          counter_deadline: counterDeadline,
          counter_note: counterNote,
          counter_at: nowIso,
          counter_responded_at: nowIso,
          responded_at: nowIso,
        })
        .eq("id", offer.id);

      // Retract siblings
      await sb.from("vendor_step_offers")
        .update({ status: "retracted", responded_at: nowIso })
        .eq("step_id", stepId)
        .neq("id", offer.id)
        .in("status", ["pending", "offered"]);

      // Promote step with counter values
      const { data: step } = await sb
        .from("order_workflow_steps")
        .select("workflow_id")
        .eq("id", stepId)
        .maybeSingle();
      await sb.from("order_workflow_steps")
        .update({
          status: "accepted",
          vendor_id: vendorId,
          vendor_rate: finalRate,
          vendor_rate_unit: finalRateUnit,
          vendor_total: finalTotal,
          vendor_currency: finalCurrency,
          deadline: finalDeadline,
          accepted_at: nowIso,
        })
        .eq("id", stepId);

      // Reconcile payables — update this vendor's pending payable to
      // counter values, approve it, cancel other vendors' pending payables.
      await sb.from("vendor_payables")
        .update({
          rate: finalRate,
          rate_unit: finalRateUnit || "flat",
          subtotal: finalTotal,
          total: finalTotal,
          currency: finalCurrency,
          status: "approved",
          approved_at: nowIso,
        })
        .eq("workflow_step_id", stepId)
        .eq("vendor_id", vendorId)
        .eq("status", "pending");
      await sb.from("vendor_payables")
        .update({ status: "cancelled" })
        .eq("workflow_step_id", stepId)
        .neq("vendor_id", vendorId)
        .eq("status", "pending");

      if (step?.workflow_id) {
        const { data: workflow } = await sb.from("order_workflows")
          .select("status").eq("id", step.workflow_id).maybeSingle();
        if (workflow?.status === "not_started") {
          await sb.from("order_workflows")
            .update({ status: "in_progress" }).eq("id", step.workflow_id);
        }
      }

      // Fire-and-forget email notifications.
      await fireCounterEmails(sb, "auto_accepted", offer, stepId, vendorId, {
        counterRate, counterRateUnit, counterTotal, counterCurrency,
        counterDeadline, counterNote,
      });

      return json({ success: true, auto_accepted: true, auto_assigned: true });
    }

    // ── Queued for admin review ──
    await sb.from("vendor_step_offers")
      .update({
        counter_status: "proposed",
        counter_rate: counterRate,
        counter_rate_unit: counterRateUnit,
        counter_total: counterTotal,
        counter_currency: counterCurrency,
        counter_deadline: counterDeadline,
        counter_note: counterNote,
        counter_at: nowIso,
      })
      .eq("id", offer.id);

    await fireCounterEmails(sb, "proposed", offer, stepId, vendorId, {
      counterRate, counterRateUnit, counterTotal, counterCurrency,
      counterDeadline, counterNote,
    });

    // Wake the AI negotiator asynchronously. It will read negotiation_settings
    // and either auto-execute or sit as a HITL recommendation. Fire-and-forget;
    // we don't block the vendor's counter-submit response on it.
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        // Don't await — let the vendor's request return immediately.
        fetch(`${supabaseUrl}/functions/v1/vendor-negotiate-counter`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ offer_id: offer.id, trigger_event: "vendor_countered" }),
        }).catch((e) => console.error("Failed to wake negotiator:", e));
      }
    } catch (err) {
      console.error("Negotiator wake-up failed (non-fatal):", err);
    }

    return json({ success: true, auto_accepted: false, auto_assigned: false });
  } catch (err: any) {
    console.error("vendor-counter-offer error:", err?.message || err);
    return json({ success: false, error: err?.message || "Internal server error" }, 500);
  }
});

// ── Email fan-out ───────────────────────────────────────────────────────────
// Loads the vendor + order + step records and hands them off to the shared
// notify-counter helpers. Wrapped in try/catch so a Brevo or DB hiccup
// never fails the counter-offer write.
async function fireCounterEmails(
  sb: any,
  kind: "proposed" | "auto_accepted",
  offer: any,
  stepId: string,
  vendorId: string,
  counter: {
    counterRate: number | null;
    counterRateUnit: string | null;
    counterTotal: number | null;
    counterCurrency: string;
    counterDeadline: string | null;
    counterNote: string;
  },
): Promise<void> {
  try {
    const [{ data: vendor }, { data: step }] = await Promise.all([
      sb.from("vendors").select("id, full_name, email, additional_emails").eq("id", vendorId).maybeSingle(),
      sb.from("order_workflow_steps").select("id, name, order_id").eq("id", stepId).maybeSingle(),
    ]);
    if (!vendor?.email || !step) return;
    const { data: order } = await sb.from("orders").select("id, order_number").eq("id", step.order_id).maybeSingle();
    if (!order) return;

    const ctx = {
      supabase: sb,
      offerId: offer.id,
      stepId,
      vendor: {
        id: vendor.id,
        full_name: vendor.full_name,
        email: vendor.email,
        additional_emails: Array.isArray(vendor.additional_emails) ? vendor.additional_emails : [],
      },
      order: { id: order.id, order_number: order.order_number },
      step: { id: step.id, name: step.name },
      counter: {
        rate: counter.counterRate,
        rate_unit: counter.counterRateUnit,
        total: counter.counterTotal,
        currency: counter.counterCurrency,
        deadline: counter.counterDeadline,
        note: counter.counterNote,
      },
      original: {
        rate: offer.vendor_rate == null ? null : Number(offer.vendor_rate),
        total: offer.vendor_total == null ? null : Number(offer.vendor_total),
        deadline: offer.deadline ?? null,
      },
    };

    if (kind === "proposed") {
      await notifyAdminCounterProposed(ctx);
    } else {
      await notifyCounterAutoAccepted(ctx);
    }
  } catch (err: any) {
    console.error("fireCounterEmails threw:", err?.message || err);
  }
}
