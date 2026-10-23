// vendor-get-training-detail
// Returns one training's lessons for the logged-in vendor, but only if the
// training is targeted to them (universal or subject-matter-matched). Quiz is
// NOT served here while quiz_enabled is off. Service-role; session-token auth.

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
      .from("cvp_trainings").select("id, slug, title, description, category, quiz_enabled")
      .eq("id", body.training_id).maybeSingle();
    const { data: lessons, error: lErr } = await supabase
      .from("cvp_training_lessons")
      .select("id, order_index, slug, title, body_markdown, key_rules, estimated_minutes, content_blocks")
      .eq("training_id", body.training_id)
      .order("order_index", { ascending: true });
    if (lErr) return json({ success: false, error: "load_failed", detail: lErr.message }, 500);

    // Image blocks may reference the PRIVATE training-assets-private bucket by
    // storage_path (e.g. third-party client-portal screenshots). Vendors have no
    // Supabase auth, so sign them here (1h) and hand the UI a plain src.
    const signed = await Promise.all((lessons ?? []).map(async (l) => {
      if (!Array.isArray(l.content_blocks)) return l;
      const blocks = await Promise.all(l.content_blocks.map(async (b: Record<string, unknown>) => {
        if (b?.type !== "image" || b.src || typeof b.storage_path !== "string") return b;
        const { data } = await supabase.storage.from("training-assets-private").createSignedUrl(b.storage_path, 3600);
        const { storage_path: _path, ...rest } = b;
        return data?.signedUrl ? { ...rest, src: data.signedUrl } : null;
      }));
      return { ...l, content_blocks: blocks.filter(Boolean) };
    }));

    return json({
      success: true,
      training,
      lessons: signed,
      completed: match.completed === true,
      completed_at: match.completed_at ?? null,
    });
  } catch (e) {
    return json({ success: false, error: "internal_error", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
