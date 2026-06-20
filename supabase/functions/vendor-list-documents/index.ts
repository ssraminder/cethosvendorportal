// ============================================================================
// vendor-list-documents
//
// Lists the published Documents & Manuals a vendor is allowed to see
// (audience 'vendor' or 'all'), each with a short-lived signed download URL.
// Powers the "Guides & Manuals" card in the vendor portal.
//
// Body: { session_token? }. Auth: vendor_sessions token (header or body).
// Deployed --no-verify-jwt.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, json, getServiceClient, resolveVendorId } from "../_shared/roster-shared.ts";

const BUCKET = "portal-documents";
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

    const { data: docs, error } = await supabase
      .from("portal_documents")
      .select("id, doc_code, title, description, category, audience, current_file_id, updated_at")
      .in("audience", ["vendor", "all"])
      .eq("is_published", true)
      .eq("is_archived", false)
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error) return json({ error: "load_failed", detail: error.message }, 500);

    const fileIds = (docs ?? []).map((d) => d.current_file_id).filter(Boolean) as string[];
    let filesById: Record<string, any> = {};
    if (fileIds.length) {
      const { data: files } = await supabase
        .from("portal_document_files")
        .select("id, version, storage_path, file_name, file_size, mime_type")
        .in("id", fileIds);
      filesById = Object.fromEntries((files ?? []).map((f) => [f.id, f]));
    }

    const documents = [];
    for (const d of docs ?? []) {
      const f = d.current_file_id ? filesById[d.current_file_id] : null;
      if (!f?.storage_path) continue; // skip docs with no current file
      const { data: signed } = await supabase.storage
        .from(BUCKET).createSignedUrl(f.storage_path, TTL, { download: f.file_name ?? undefined });
      documents.push({
        id: d.id, doc_code: d.doc_code, title: d.title, description: d.description,
        category: d.category, version: f.version, file_name: f.file_name,
        file_size: f.file_size, mime_type: f.mime_type, updated_at: d.updated_at,
        url: signed?.signedUrl ?? null,
      });
    }

    return json({ success: true, documents });
  } catch (err) {
    console.error("vendor-list-documents error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
