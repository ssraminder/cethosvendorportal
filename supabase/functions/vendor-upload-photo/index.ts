// ============================================================================
// vendor-upload-photo
//
// Vendor uploads a profile photo from their profile page. Stores the image in
// the PUBLIC `vendor-profile-photos` bucket and writes the resulting public URL
// to cvp_translators.profile_photo_url (keyed by the vendor's email, matching
// how get-profile reads it back).
//
// Re-adds the photo uploader that was previously missing (bug reports
// 482f3dfa / c9bd65a5: "no option to upload profile picture"). The photo is an
// optional, non-blocking profile field — it is intentionally NOT part of the
// profile-completeness checklist.
//
// Transport: multipart/form-data (action=upload, file) — same pattern as
// vendor-upload-certification, no base64 bloat.
//
// Auth: vendor session token in Authorization: Bearer <token>. Deployed
// --no-verify-jwt; the gateway accepts the random session UUID and validation
// happens inside via `vendor_sessions`.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — matches the bucket limit.
const BUCKET = "vendor-profile-photos";
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error: sessionErr } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .single();
    if (sessionErr || !session) return json({ error: "Invalid or expired session" }, 401);

    const contentType = req.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return json({ error: "expected multipart/form-data" }, 400);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "invalid_form_data" }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "file is required" }, 400);
    if (file.size > MAX_SIZE_BYTES) {
      return json({ error: "file_too_large", limit_bytes: MAX_SIZE_BYTES }, 400);
    }
    const mime = file.type || "image/jpeg";
    if (!ALLOWED_MIME.has(mime)) {
      return json({ error: "unsupported_type", detail: "Use a PNG, JPEG, or WebP image." }, 400);
    }

    const { data: vendor } = await supabase
      .from("vendors")
      .select("email")
      .eq("id", session.vendor_id)
      .single();
    if (!vendor?.email) return json({ error: "Vendor not found" }, 404);

    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    // Stable path per vendor (upsert) so old photos don't accumulate.
    const path = `${session.vendor_id}/profile.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (uploadErr) {
      console.error("profile photo upload failed:", uploadErr);
      return json({ error: "storage_upload_failed", detail: uploadErr.message }, 500);
    }

    // Public bucket → stable public URL. Cache-bust with the upload time so the
    // browser refetches after a re-upload to the same path.
    const publicUrl =
      `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from("cvp_translators")
      .update({ profile_photo_url: publicUrl })
      .eq("email", vendor.email);
    if (updateErr) {
      console.error("failed to set profile_photo_url:", updateErr);
      return json({ error: "Failed to save profile photo" }, 500);
    }

    return json({ success: true, profile_photo_url: publicUrl });
  } catch (err) {
    console.error("vendor-upload-photo error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
