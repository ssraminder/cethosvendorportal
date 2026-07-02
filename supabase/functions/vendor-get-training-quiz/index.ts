// vendor-get-training-quiz
// Returns the ANSWER-FREE knowledge-check questions for a training, but only if
// the training is quiz_enabled AND targeted to the logged-in vendor. The
// correct_option never leaves the DB (cvp_get_training_quiz strips it).
// Service-role; session-token auth. Companion to vendor-grade-training.

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
    let body: { session_token?: string; training_id?: string } = {};
    try { body = await req.json(); } catch { /* */ }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") || body.session_token;
    if (!token) return json({ success: false, error: "auth_required" }, 401);
    if (!body.training_id) return json({ success: false, error: "training_id_required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: session } = await supabase
      .from("vendor_sessions").select("vendor_id")
      .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!session) return json({ success: false, error: "invalid_session" }, 401);

    // Authorize: the training must be in this vendor's targeted set.
    const { data: visible } = await supabase.rpc("cvp_linguist_trainings_for_vendor", { p_vendor_id: session.vendor_id });
    const match = (visible ?? []).find((t: { training_id: string }) => t.training_id === body.training_id);
    if (!match) return json({ success: false, error: "not_available" }, 403);

    const { data: training } = await supabase
      .from("cvp_trainings").select("id, quiz_enabled, pass_threshold")
      .eq("id", body.training_id).maybeSingle();
    if (!training?.quiz_enabled) return json({ success: false, error: "no_quiz" }, 400);

    // Answer-free question set (correct_option stays server-side).
    const { data: questions, error: qErr } = await supabase.rpc("cvp_get_training_quiz", {
      p_training_id: body.training_id,
    });
    if (qErr) return json({ success: false, error: "load_failed", detail: qErr.message }, 500);

    return json({
      success: true,
      threshold: training.pass_threshold ?? 80,
      questions: questions ?? [],
    });
  } catch (e) {
    return json({ success: false, error: "internal_error", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
