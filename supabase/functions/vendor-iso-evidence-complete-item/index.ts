// ============================================================================
// vendor-iso-evidence-complete-item
//
// Marks a single item on a vendor_document_requests row as completed.
// The page calls this after the upload / profile-edit action has
// successfully written to the underlying store (vendor_cvs, vendors, etc.)
//
// Two auth modes are accepted so the page can call this even when the
// vendor hasn't completed Supabase OTP — possession of the unexpired
// request_token is sufficient (the token was emailed to the vendor's
// verified address). If a session token is also present, we cross-check
// that the request belongs to the session's vendor for defence-in-depth.
//
// POST /functions/v1/vendor-iso-evidence-complete-item
// Body: { token: string, slug: string }
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
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

  let body: { token?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  const token = (body.token ?? "").trim();
  const slug = (body.slug ?? "").trim();
  if (!token || !slug) return json({ success: false, error: "token_and_slug_required" }, 400);

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
  if (new Date(request.request_token_expires_at).getTime() < Date.now()) {
    return json({ success: false, error: "request_expired" }, 410);
  }
  if (["completed", "expired", "superseded"].includes(request.status)) {
    return json({ success: false, error: "request_closed", status: request.status }, 410);
  }

  // Optional cross-check: if caller provided a vendor session, the request
  // must belong to that vendor. This blocks cross-vendor token misuse.
  const authHeader = req.headers.get("Authorization");
  const sessionToken = authHeader?.replace("Bearer ", "");
  if (sessionToken) {
    const { data: session } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", sessionToken)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (session && session.vendor_id !== request.vendor_id) {
      return json({ success: false, error: "vendor_mismatch" }, 403);
    }
  }

  const items = Array.isArray(request.requested_items) ? request.requested_items as Array<Record<string, unknown>> : [];
  const nowIso = new Date().toISOString();
  let touched = false;
  const updatedItems = items.map((it) => {
    if (it.slug === slug && !it.completed_at) {
      touched = true;
      return { ...it, completed_at: nowIso };
    }
    return it;
  });

  if (!touched) {
    // Either the slug doesn't exist on this request or it's already
    // completed — return success idempotently so the page can keep going.
    return json({
      success: true,
      data: { request_id: request.id, status: request.status, idempotent: true, item_count: items.length },
    });
  }

  // "Resolved" = completed_at OR declined_at. The /iso-evidence page also
  // lets vendors decline an item with a written reason; for the request to
  // close, every item just needs to be in one of those two terminal states.
  const completedCount = updatedItems.filter((it) => !!it.completed_at || !!it.declined_at).length;
  const allDone = completedCount === updatedItems.length;
  const nextStatus = allDone ? "completed" : "partial";
  const completedAt = allDone ? nowIso : null;

  const { error: updErr } = await supabase
    .from("vendor_document_requests")
    .update({
      requested_items: updatedItems,
      status: nextStatus,
      completed_at: completedAt,
    })
    .eq("id", request.id);
  if (updErr) {
    return json({ success: false, error: "update_failed", detail: updErr.message }, 500);
  }

  // Phase 3 — fire the ISO assessment again so the admin's verdict
  // refreshes without manual intervention. Fire-and-forget; the page
  // doesn't need to wait. Service-role JWT satisfies verify_jwt on the
  // assess function.
  let reassessTriggered = false;
  if (allDone) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRole) {
        // Don't await — let the assess function run in the background.
        // The vendor portal only needs confirmation that completion was
        // recorded; the assessment refresh happens on the admin side.
        fetch(`${supabaseUrl}/functions/v1/vendor-iso17100-assess`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRole}`,
            apikey: serviceRole,
          },
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
      completed_count: completedCount,
      total_count: updatedItems.length,
      all_done: allDone,
      reassess_triggered: reassessTriggered,
    },
  });
});
