// vendor-grade-training
// Grades a vendor's knowledge-check answers server-side (correct_option never
// leaves the DB) via cvp_grade_vendor_training. On a passing score the RPC
// records a completion (method=online_quiz) with quiz_score + client IP/UA; on a
// failing score nothing is recorded, so the vendor can retake. Returns the score
// breakdown either way. Service-role; session-token auth.

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
    let body: { session_token?: string; training_id?: string; answers?: Record<string, string> } = {};
    try { body = await req.json(); } catch { /* */ }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") || body.session_token;
    if (!token) return json({ success: false, error: "auth_required" }, 401);
    if (!body.training_id) return json({ success: false, error: "training_id_required" }, 400);
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: session } = await supabase
      .from("vendor_sessions").select("vendor_id")
      .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!session) return json({ success: false, error: "invalid_session" }, 401);

    // Authorize: the training must be in this vendor's targeted set.
    const { data: visible } = await supabase.rpc("cvp_linguist_trainings_for_vendor", { p_vendor_id: session.vendor_id });
    const match = (visible ?? []).find((t: { training_id: string }) => t.training_id === body.training_id);
    if (!match) return json({ success: false, error: "not_available" }, 403);

    // Capture the client IP + user-agent server-side (recorded alongside a pass).
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent") || null;

    const { data: result, error } = await supabase.rpc("cvp_grade_vendor_training", {
      p_vendor_id: session.vendor_id,
      p_training_id: body.training_id,
      p_answers: answers,
      p_ip: ip,
      p_user_agent: ua,
    });
    if (error) return json({ success: false, error: "grade_failed", detail: error.message }, 500);

    return json({ success: true, data: result });
  } catch (e) {
    return json({ success: false, error: "internal_error", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
