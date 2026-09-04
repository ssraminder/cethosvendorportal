// ============================================================================
// vendor-get-selfcheck v1
//
// POST { session_token: string, step_id: string }
//
// Returns the vendor-facing subset of the pre-release QA checklist that
// applies to this step (SOP-043 v2 §6 / QA-CL-001 — sections A–H; internal
// reviewer items are excluded server-side), plus any answers the vendor has
// already saved. { template: null } when no checklist applies, so the deliver
// flow renders nothing.
//
// The self-check is a vendor declaration completed before delivery. It never
// satisfies the internal release gate, which requires the named independent
// reviewer's own checklist at the QA Review step.
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

    const body = await req.json().catch(() => ({}));
    const token = String(body.session_token || "").trim() ||
      (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const stepId = String(body.step_id || "");
    if (!token) return json({ success: false, error: "Authentication required" }, 401);
    if (!stepId) return json({ success: false, error: "Missing step_id" }, 400);

    const { data: session } = await sb
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ success: false, error: "Invalid or expired session" }, 401);

    const { data: step } = await sb
      .from("order_workflow_steps")
      .select("id, vendor_id")
      .eq("id", stepId)
      .maybeSingle();
    if (!step) return json({ success: false, error: "Step not found" }, 404);
    if (step.vendor_id !== session.vendor_id) {
      return json({ success: false, error: "Not authorized for this step" }, 403);
    }

    const { data, error } = await sb.rpc("qms_get_step_selfcheck", { p_step_id: stepId });
    if (error) throw error;
    return json({ success: true, ...((data as Record<string, unknown>) || { template: null }) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("vendor-get-selfcheck error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
