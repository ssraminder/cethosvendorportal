// ============================================================================
// vendor-accept-terms v1 (rebuilt from scratch — prior bundle unretrievable)
//
// Two actions on one endpoint:
//
// POST { action: "get_terms", offer_id, service_id? }
//   → returns { success, has_terms, terms?, already_accepted? }
//   terms = { id, title, content, version }
//   already_accepted is true when the calling vendor already recorded an
//   acceptance for this offer at the same terms version.
//
// POST {
//   action: "accept_terms",
//   terms_id, offer_id, step_id, order_id, service_id?,
//   action_type: "accept_offer" | "submit_counter",
//   acceptance_type: "immediate" | "conditional"
// }
//   → inserts a vendor_terms_acceptances row, returns { success, acceptance_id }
//   is_binding = (acceptance_type === "immediate"); binding_at set when
//   immediate. Conditional acceptances become binding only when the
//   admin accepts the counter (caller's responsibility to flip).
//
// Auth: vendor_sessions bearer token.
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
    const action: string = body?.action;

    // ── Resolve the active service_terms row, if any ──
    async function resolveActiveTerms(offerId?: string | null, serviceIdHint?: string | null) {
      let serviceId: string | null = serviceIdHint ?? null;
      if (!serviceId && offerId) {
        const { data: offerRow } = await sb
          .from("vendor_step_offers")
          .select("step_id")
          .eq("id", offerId)
          .maybeSingle();
        if (offerRow?.step_id) {
          const { data: stepRow } = await sb
            .from("order_workflow_steps")
            .select("service_id")
            .eq("id", offerRow.step_id)
            .maybeSingle();
          serviceId = stepRow?.service_id ?? null;
        }
      }
      if (!serviceId) return null;
      const { data: terms } = await sb
        .from("service_terms")
        .select("id, title, content, version")
        .eq("service_id", serviceId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return terms ?? null;
    }

    if (action === "get_terms") {
      const offerId: string | undefined = body?.offer_id;
      const serviceIdHint: string | null = body?.service_id ?? null;
      const terms = await resolveActiveTerms(offerId, serviceIdHint);
      if (!terms) return json({ success: true, has_terms: false });

      // Already accepted? Look for any prior acceptance by this vendor for
      // the same offer at the same terms version.
      let alreadyAccepted = false;
      if (offerId) {
        const { data: prior } = await sb
          .from("vendor_terms_acceptances")
          .select("id")
          .eq("vendor_id", vendorId)
          .eq("offer_id", offerId)
          .eq("service_terms_id", terms.id)
          .eq("terms_version", terms.version)
          .limit(1)
          .maybeSingle();
        alreadyAccepted = !!prior;
      }

      return json({
        success: true,
        has_terms: true,
        already_accepted: alreadyAccepted,
        terms,
      });
    }

    if (action === "accept_terms") {
      const termsId: string | undefined = body?.terms_id;
      const offerId: string | undefined = body?.offer_id;
      const stepId: string | undefined = body?.step_id;
      const orderId: string | undefined = body?.order_id;
      const actionType: string = body?.action_type || "accept_offer";
      const acceptanceType: string = body?.acceptance_type || "immediate";
      if (!termsId || !offerId) {
        return json({ success: false, error: "Missing terms_id or offer_id" }, 400);
      }

      // Re-fetch the terms to capture its version at acceptance time.
      const { data: terms } = await sb
        .from("service_terms")
        .select("id, version")
        .eq("id", termsId)
        .maybeSingle();
      if (!terms) return json({ success: false, error: "Terms not found" }, 404);

      const nowIso = new Date().toISOString();
      const isBinding = acceptanceType === "immediate";
      const { data: inserted, error: insertErr } = await sb
        .from("vendor_terms_acceptances")
        .insert({
          vendor_id: vendorId,
          service_terms_id: terms.id,
          terms_version: terms.version,
          offer_id: offerId,
          step_id: stepId ?? null,
          order_id: orderId ?? null,
          action: actionType,
          acceptance_type: acceptanceType,
          is_binding: isBinding,
          binding_at: isBinding ? nowIso : null,
          accepted_at: nowIso,
        })
        .select("id")
        .single();
      if (insertErr) {
        return json({ success: false, error: insertErr.message }, 500);
      }
      return json({ success: true, acceptance_id: inserted.id });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("vendor-accept-terms error:", err?.message || err);
    return json({ success: false, error: err?.message || "Internal server error" }, 500);
  }
});
