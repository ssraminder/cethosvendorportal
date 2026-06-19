// vendor-get-trainings
// Lists the linguist trainings targeted to the logged-in vendor (universal +
// subject-matter-matched) with completion status. Service-role read; vendor
// identified by session token (Authorization: Bearer, or body.session_token).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: Record<string, unknown>, s = 200): Response {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);
  try {
    let body: { session_token?: string } = {};
    try { body = await req.json(); } catch { /* empty ok */ }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") || body.session_token;
    if (!token) return json({ success: false, error: "auth_required" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: session } = await supabase
      .from("vendor_sessions").select("vendor_id")
      .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!session) return json({ success: false, error: "invalid_session" }, 401);

    const { data, error } = await supabase.rpc("cvp_linguist_trainings_for_vendor", { p_vendor_id: session.vendor_id });
    if (error) return json({ success: false, error: "load_failed", detail: error.message }, 500);
    return json({ success: true, trainings: data ?? [] });
  } catch (e) {
    return json({ success: false, error: "internal_error", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
