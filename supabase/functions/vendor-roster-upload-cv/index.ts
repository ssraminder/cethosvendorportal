// ============================================================================
// vendor-roster-upload-cv
//
// Upload a (blinded) CV for one roster linguist. Stores to the private
// vendor-roster-cvs bucket and sets cv_path / cv_original_filename /
// cv_uploaded_at on the linguist row. Blinding (removing the linguist's
// identifying info) is the agency's responsibility — Cethos never reads
// the file unless the agency releases it under a formal evidence demand.
//
// Transport: multipart/form-data { roster_linguist_id, file }.
// Auth: vendor_sessions token (Authorization header). Agency-only.
// Deployed --no-verify-jwt. Model: vendor-upload-certification.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  corsHeaders, json, getServiceClient, resolveVendorId, requireAgency,
} from "../_shared/roster-shared.ts";

const BUCKET = "vendor-roster-cvs";
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const contentType = req.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return json({ error: "multipart_required" }, 400);
    }

    let form: FormData;
    try { form = await req.formData(); } catch { return json({ error: "invalid_form_data" }, 400); }

    const rosterLinguistId = String(form.get("roster_linguist_id") ?? "").trim();
    const file = form.get("file");
    const bodyToken = (form.get("session_token") as string | null) ?? null;

    if (!rosterLinguistId) return json({ error: "roster_linguist_id is required" }, 400);
    if (!(file instanceof File)) return json({ error: "file is required" }, 400);
    if (file.size > MAX_SIZE_BYTES) return json({ error: "file_too_large", limit_bytes: MAX_SIZE_BYTES }, 400);

    const supabase = getServiceClient();
    const vendorId = await resolveVendorId(supabase, req, bodyToken);
    if (!vendorId) return json({ error: "Invalid or expired session" }, 401);

    const agency = await requireAgency(supabase, vendorId);
    if (!agency.ok) return json({ error: "Roster is available for agency accounts only" }, 403);

    // Ownership check
    const { data: linguist } = await supabase
      .from("vendor_roster_linguists")
      .select("id, cv_path")
      .eq("id", rosterLinguistId).eq("vendor_id", vendorId).maybeSingle();
    if (!linguist) return json({ error: "Linguist not found" }, 404);

    const safeName = (file.name || "cv.pdf").replace(/[^\w.\-]+/g, "_").slice(0, 80);
    const path = `${vendorId}/${rosterLinguistId}/${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET).upload(path, bytes, { contentType: file.type || "application/pdf", upsert: false });
    if (uploadErr) return json({ error: "storage_upload_failed", detail: uploadErr.message }, 500);

    // Remove the previous CV (one current CV per linguist).
    if (linguist.cv_path && linguist.cv_path !== path) {
      await supabase.storage.from(BUCKET).remove([linguist.cv_path as string]).catch(() => undefined);
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("vendor_roster_linguists")
      .update({ cv_path: path, cv_original_filename: file.name, cv_uploaded_at: nowIso, updated_at: nowIso })
      .eq("id", rosterLinguistId).eq("vendor_id", vendorId);
    if (updErr) return json({ error: "update_failed", detail: updErr.message }, 500);

    const { data: eligible } = await supabase.rpc("roster_linguist_is_eligible", { p_id: rosterLinguistId });

    return json({ success: true, cv_original_filename: file.name, cv_uploaded_at: nowIso, is_eligible: !!eligible });
  } catch (err) {
    console.error("vendor-roster-upload-cv error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
