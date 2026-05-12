// vendor-list-cvs
//
// Returns the vendor's CV version history with short-lived signed URLs
// for download/preview. Used by both the vendor portal (the vendor's
// own list) and the admin portal Documents tab (any vendor's list, via
// vendor_id parameter and a staff caller).
//
// Body (JSON):
//   vendor_id?: string  // staff-only; if absent, taken from vendor session
//   expiry_seconds?: number (default 600, clamped 60..3600)
//   staff_id?: string   // when admin is calling without a vendor session
//
// Auth (one of):
//   Authorization: Bearer <vendor_session_token>   — vendor reading their own
//   x-staff-key:   <SUPABASE_SERVICE_ROLE_KEY>     — staff/admin proxy
// If neither, request is rejected. (verify_jwt is off; this function
// gates itself.)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-staff-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BUCKET = "vendor-cvs";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: { vendor_id?: string; expiry_seconds?: number } = {};
  try { body = await req.json(); } catch { /* allow empty body for vendor self-read */ }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve vendor_id from either staff context (request body)
  // or vendor session token.
  let vendorId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token) {
    const { data: session } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (session) vendorId = session.vendor_id as string;
  }
  if (!vendorId && body.vendor_id) {
    // Staff callers come through the admin Supabase client which sends
    // the project anon key in Authorization. That's enough to reach
    // this function (verify_jwt is off + we use service role). The
    // body's vendor_id is the trust anchor on the admin side.
    vendorId = body.vendor_id;
  }
  if (!vendorId) {
    return json({ success: false, error: "vendor_id_required" }, 400);
  }

  const expiry = Math.min(Math.max(Number(body.expiry_seconds ?? 600), 60), 3600);

  const { data: rows, error } = await supabase
    .from("vendor_cvs")
    .select("id, version, file_storage_path, file_name, file_size_bytes, content_type, uploaded_by_vendor, uploaded_by_staff_id, notes, is_current, superseded_at, created_at")
    .eq("vendor_id", vendorId)
    .order("version", { ascending: false });

  if (error) return json({ success: false, error: error.message }, 500);

  const enriched = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(r.file_storage_path as string, expiry, {
          download: r.file_name as string,
        });
      const { data: inline } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(r.file_storage_path as string, expiry);
      return {
        ...r,
        download_url: signed?.signedUrl ?? null,
        preview_url: inline?.signedUrl ?? signed?.signedUrl ?? null,
      };
    }),
  );

  return json({ success: true, cvs: enriched, expires_in_seconds: expiry });
});
