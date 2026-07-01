// vendor-get-capa-actions — lists the open CAPA/NC escalations Cethos has raised
// to the calling vendor (ISO 17100 §6.1 supplier corrective action).
//
// Returns escalations in status awaiting_ack / acknowledged / returned — i.e.
// the ones the vendor still needs to act on. Once a response is submitted (or
// the escalation is accepted/cancelled) it drops off this list.
//
// POST application/json {}   // no body needed — vendor is resolved from the token
// Auth: vendor_sessions bearer token. Deployed --no-verify-jwt; the gateway
// accepts the random session UUID and validation happens inside.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS: Record<string, string> = {
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

    // qms schema is not exposed over PostgREST — the read goes through the
    // public SECURITY DEFINER RPC, which scopes to this vendor and returns a
    // JSONB array (never client raw text).
    const { data, error } = await sb.rpc("qms_list_vendor_escalations", {
      p_vendor_id: vendorId,
    });
    if (error) {
      console.error("qms_list_vendor_escalations error:", error.message);
      return json({ success: false, error: "Failed to load quality actions" }, 500);
    }

    const escalations = Array.isArray(data) ? data : [];
    return json({ success: true, escalations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("vendor-get-capa-actions error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
