// vendor-upload-cv
//
// Vendor uploads a new CV from the portal. Bumps version, marks prior
// versions superseded, stores the file in the private `vendor-cvs`
// bucket via service-role. Multipart/form-data body so the browser
// doesn't preflight (form-data is CORS-safelisted).
//
// Body (multipart/form-data):
//   cv           File   required, PDF only, ≤ 10 MB
//   source_docx  File   optional, .docx ≤ 10 MB — the original Word doc
//                       the vendor picked, when the PDF in `cv` was
//                       converted client-side. We keep both so the
//                       source is preserved for ISO 17100 evidence and
//                       so we can re-render if the converter improves.
//   notes        string optional, vendor-supplied note about what changed
//
// Auth: vendor session token in Authorization: Bearer <token>.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const BUCKET = "vendor-cvs";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ success: false, error: "auth_required" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error: sessionErr } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionErr || !session) {
      return json({ success: false, error: "invalid_session" }, 401);
    }
    const vendorId = session.vendor_id as string;

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ success: false, error: "expected_multipart_form" }, 400);
    }
    const file = form.get("cv");
    const sourceDocx = form.get("source_docx");
    const notes = (form.get("notes") as string | null)?.trim() || null;
    if (!(file instanceof File)) {
      return json({ success: false, error: "cv_file_required" }, 400);
    }
    if (file.type && file.type !== "application/pdf") {
      return json({ success: false, error: "pdf_only" }, 400);
    }
    if (file.size > MAX_SIZE_BYTES) {
      return json({ success: false, error: "file_too_large", limit_bytes: MAX_SIZE_BYTES }, 400);
    }
    // Optional companion .docx — validate type + size separately so a bad
    // source doesn't fail the whole upload silently.
    let sourceDocxFile: File | null = null;
    if (sourceDocx instanceof File && sourceDocx.size > 0) {
      const isDocxByMime = sourceDocx.type === DOCX_MIME;
      const isDocxByName = /\.docx$/i.test(sourceDocx.name);
      if (!isDocxByMime && !isDocxByName) {
        return json({ success: false, error: "source_docx_must_be_docx" }, 400);
      }
      if (sourceDocx.size > MAX_SIZE_BYTES) {
        return json({ success: false, error: "source_docx_too_large", limit_bytes: MAX_SIZE_BYTES }, 400);
      }
      sourceDocxFile = sourceDocx;
    }

    // Compute next version atomically-ish (vendors won't double-submit
    // in practice; UNIQUE constraint catches races).
    const { data: latest } = await supabase
      .from("vendor_cvs")
      .select("version")
      .eq("vendor_id", vendorId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((latest?.version as number | undefined) ?? 0) + 1;

    const safeOriginalName = (file.name || "cv.pdf").replace(/[^\w.\-]+/g, "_").slice(0, 80);
    const storagePath = `${vendorId}/v${nextVersion}-${Date.now()}-${safeOriginalName}`;

    const upload = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upload.error) {
      return json({ success: false, error: "storage_upload_failed", detail: upload.error.message }, 500);
    }

    // Upload the companion .docx if one was provided. Stored under a
    // /source/ subpath next to the PDF so it's easy to spot in the bucket.
    let sourceDocxPath: string | null = null;
    let sourceDocxName: string | null = null;
    if (sourceDocxFile) {
      const safeDocxName = (sourceDocxFile.name || "cv.docx").replace(/[^\w.\-]+/g, "_").slice(0, 80);
      const docxPath = `${vendorId}/source/v${nextVersion}-${Date.now()}-${safeDocxName}`;
      const docxUpload = await supabase.storage
        .from(BUCKET)
        .upload(docxPath, sourceDocxFile, { contentType: DOCX_MIME, upsert: false });
      if (docxUpload.error) {
        // Don't fail the whole upload over the source — log and continue.
        // The PDF is the canonical artifact; missing source is recoverable.
        console.error("vendor-upload-cv: source_docx upload failed", docxUpload.error);
      } else {
        sourceDocxPath = docxPath;
        sourceDocxName = safeDocxName;
      }
    }

    // Mark prior current row(s) as superseded.
    const nowIso = new Date().toISOString();
    await supabase
      .from("vendor_cvs")
      .update({ is_current: false, superseded_at: nowIso })
      .eq("vendor_id", vendorId)
      .eq("is_current", true);

    const { data: inserted, error: insertErr } = await supabase
      .from("vendor_cvs")
      .insert({
        vendor_id: vendorId,
        version: nextVersion,
        file_storage_path: storagePath,
        file_name: safeOriginalName,
        file_size_bytes: file.size,
        content_type: "application/pdf",
        uploaded_by_vendor: true,
        notes,
        is_current: true,
        source_docx_storage_path: sourceDocxPath,
        source_docx_file_size_bytes: sourceDocxFile ? sourceDocxFile.size : null,
        source_docx_original_name: sourceDocxName,
      })
      .select("id, version, file_name, file_size_bytes, notes, created_at, source_docx_storage_path")
      .single();

    if (insertErr) {
      // Best-effort cleanup of the uploaded blob.
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
      return json({ success: false, error: "db_insert_failed", detail: insertErr.message }, 500);
    }

    return json({ success: true, cv: inserted });
  } catch (err) {
    console.error("vendor-upload-cv error:", err);
    return json({ success: false, error: (err as Error).message || "internal_error" }, 500);
  }
});
