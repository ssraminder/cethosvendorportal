// ============================================================================
// vendor-iso-evidence-explain-item
//
// "I don't have this document" path on the /iso-evidence/:token page.
// Marks a requested item as declined-with-reason instead of completed.
// Resolved-count math treats completed_at and declined_at equivalently,
// so the request can still flip to status=completed once every item is
// in one of those two terminal states.
//
// POST /functions/v1/vendor-iso-evidence-explain-item
// Body: { token: string, slug: string, reason: string }
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: { token?: string; slug?: string; reason?: string };
  try { body = await req.json(); } catch { return json({ success: false, error: "invalid_json" }, 400); }
  const token = (body.token ?? "").trim();
  const slug = (body.slug ?? "").trim();
  const reason = (body.reason ?? "").trim();
  if (!token || !slug) return json({ success: false, error: "token_and_slug_required" }, 400);
  if (reason.length < 3) return json({ success: false, error: "reason_too_short" }, 400);
  if (reason.length > 2000) return json({ success: false, error: "reason_too_long" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: request, error: reqErr } = await supabase
    .from("vendor_document_requests")
    .select("id, vendor_id, requested_items, request_token_expires_at, status")
    .eq("request_token", token)
    .maybeSingle();
  if (reqErr || !request) return json({ success: false, error: "request_not_found" }, 404);
  if (new Date(request.request_token_expires_at).getTime() < Date.now()) return json({ success: false, error: "request_expired" }, 410);
  if (["completed", "expired", "superseded"].includes(request.status)) return json({ success: false, error: "request_closed", status: request.status }, 410);

  // Cross-check vendor session if present.
  const sessionToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (sessionToken) {
    const { data: session } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", sessionToken)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (session && session.vendor_id !== request.vendor_id) return json({ success: false, error: "vendor_mismatch" }, 403);
  }

  const items = Array.isArray(request.requested_items) ? (request.requested_items as Array<Record<string, unknown>>) : [];
  const nowIso = new Date().toISOString();
  let touched = false;
  const updatedItems = items.map((it) => {
    if (it.slug === slug && !it.completed_at && !it.declined_at) {
      touched = true;
      return { ...it, declined_at: nowIso, decline_reason: reason };
    }
    return it;
  });

  if (!touched) {
    return json({ success: true, data: { request_id: request.id, status: request.status, idempotent: true } });
  }

  const resolvedCount = updatedItems.filter((it) => !!it.completed_at || !!it.declined_at).length;
  const allDone = resolvedCount === updatedItems.length;
  const nextStatus = allDone ? "completed" : "partial";
  const completedAt = allDone ? nowIso : null;

  const { error: updErr } = await supabase
    .from("vendor_document_requests")
    .update({ requested_items: updatedItems, status: nextStatus, completed_at: completedAt })
    .eq("id", request.id);
  if (updErr) return json({ success: false, error: "update_failed", detail: updErr.message }, 500);

  // Mirror Phase 3 behaviour — when the last item is resolved (whether
  // completed or declined-with-reason), fire the ISO assessment so the
  // admin's verdict picks up the new state.
  let reassessTriggered = false;
  if (allDone) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRole) {
        fetch(`${supabaseUrl}/functions/v1/vendor-iso17100-assess`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}`, apikey: serviceRole },
          body: JSON.stringify({ vendor_id: request.vendor_id }),
        }).catch((e) => console.error("auto-reassess fetch failed:", e));
        reassessTriggered = true;
      }
    } catch (e) {
      console.error("auto-reassess setup failed:", e);
    }
  }

  return json({
    success: true,
    data: {
      request_id: request.id,
      status: nextStatus,
      resolved_count: resolvedCount,
      total_count: updatedItems.length,
      all_done: allDone,
      reassess_triggered: reassessTriggered,
    },
  });
});
