// ============================================================================
// vendor-list-guides
//
// Lists the published Guides a vendor may view — embeddable how-to videos
// (Guidde / YouTube iframes) and/or uploaded reference documents. Powers the
// "Guides" section in the vendor portal (/guides).
//
// Body: { session_token? }. Auth: vendor_sessions token (header or body).
// Deployed --no-verify-jwt.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, json, getServiceClient, resolveVendorId } from "../_shared/roster-shared.ts";

const BUCKET = "cvp-guides";
const TTL = 3600;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* allow empty */ }

    const supabase = getServiceClient();
    const vendorId = await resolveVendorId(supabase, req, body.session_token as string | undefined);
    if (!vendorId) return json({ error: "Invalid or expired session" }, 401);

    const { data: rows, error } = await supabase
      .from("cvp_guides")
      .select("id, title, category, description, embed_url, file_path, file_name, file_size, mime_type, updated_at")
      .eq("is_published", true)
      .eq("is_archived", false)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (error) return json({ error: "load_failed", detail: error.message }, 500);

    const guides = [];
    for (const g of rows ?? []) {
      let url: string | null = null;
      if (g.file_path) {
        const { data: signed } = await supabase.storage
          .from(BUCKET).createSignedUrl(g.file_path, TTL, { download: g.file_name ?? undefined });
        url = signed?.signedUrl ?? null;
      }
      guides.push({
        id: g.id,
        title: g.title,
        category: g.category,
        description: g.description,
        embed_url: g.embed_url,
        file_name: g.file_name,
        file_size: g.file_size,
        mime_type: g.mime_type,
        updated_at: g.updated_at,
        url,
      });
    }

    return json({ success: true, guides });
  } catch (err) {
    console.error("vendor-list-guides error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
