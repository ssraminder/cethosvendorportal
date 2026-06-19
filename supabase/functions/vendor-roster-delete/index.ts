// ============================================================================
// vendor-roster-delete
//
// Remove a roster linguist. Soft-deletes (is_active=false) if the linguist
// is referenced by any delivery (preserve the audit trail); hard-deletes
// otherwise (cascades children + removes the CV file).
//
// Body: { id, session_token? }. Auth: vendor_sessions token. Agency-only.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  corsHeaders, json, getServiceClient, resolveVendorId, requireAgency,
} from "../_shared/roster-shared.ts";

const CV_BUCKET = "vendor-roster-cvs";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

    const supabase = getServiceClient();
    const vendorId = await resolveVendorId(supabase, req, body.session_token as string | undefined);
    if (!vendorId) return json({ error: "Invalid or expired session" }, 401);

    const agency = await requireAgency(supabase, vendorId);
    if (!agency.ok) return json({ error: "Roster is available for agency accounts only" }, 403);

    const id = String(body.id ?? "").trim();
    if (!id) return json({ error: "id is required" }, 400);

    const { data: linguist } = await supabase
      .from("vendor_roster_linguists")
      .select("id, cv_path")
      .eq("id", id).eq("vendor_id", vendorId).maybeSingle();
    if (!linguist) return json({ error: "Linguist not found" }, 404);

    const { count } = await supabase
      .from("step_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("roster_linguist_id", id);

    if ((count ?? 0) > 0) {
      // Referenced by deliveries → soft-delete to keep the audit trail intact.
      const { error } = await supabase
        .from("vendor_roster_linguists")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id).eq("vendor_id", vendorId);
      if (error) return json({ error: "soft_delete_failed", detail: error.message }, 400);
      return json({ success: true, mode: "soft_deleted" });
    }

    // Not referenced → hard delete (children cascade) and drop the CV file.
    if (linguist.cv_path) {
      await supabase.storage.from(CV_BUCKET).remove([linguist.cv_path as string]).catch(() => undefined);
    }
    const { error } = await supabase
      .from("vendor_roster_linguists").delete().eq("id", id).eq("vendor_id", vendorId);
    if (error) return json({ error: "delete_failed", detail: error.message }, 400);

    return json({ success: true, mode: "deleted" });
  } catch (err) {
    console.error("vendor-roster-delete error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
