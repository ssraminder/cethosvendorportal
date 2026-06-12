// vendor-submit-client-declaration
//
// NDA clause 3.4: a vendor declares a pre-existing client relationship
// (with supporting evidence) for staff review. Files go to the private
// `vendor-declarations` bucket via service-role; the row lands in
// vendor_client_declarations with status 'pending'.
//
// Body (multipart/form-data):
//   client_name           string required
//   relationship_details  string optional — nature/history of the relationship
//   first_engaged_date    string optional, YYYY-MM-DD — when the relationship began
//   evidence              File[] optional, up to 5 — PDF, PNG/JPEG, DOCX, EML, TXT, ≤ 10 MB each
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
const MAX_FILES = 5;
const BUCKET = "vendor-declarations";
// Mirrors storage.buckets.allowed_mime_types — bucket limits enforce
// independently, keep both in lockstep.
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "message/rfc822",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

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

    const clientName = (form.get("client_name") as string | null)?.trim();
    if (!clientName) return json({ success: false, error: "client_name_required" }, 400);
    const details = (form.get("relationship_details") as string | null)?.trim() || null;
    const firstEngagedRaw = (form.get("first_engaged_date") as string | null)?.trim() || null;
    if (firstEngagedRaw && !/^\d{4}-\d{2}-\d{2}$/.test(firstEngagedRaw)) {
      return json({ success: false, error: "first_engaged_date_must_be_yyyy_mm_dd" }, 400);
    }

    const files = form.getAll("evidence").filter((f): f is File => f instanceof File);
    if (files.length > MAX_FILES) {
      return json({ success: false, error: `max_${MAX_FILES}_evidence_files` }, 400);
    }
    for (const f of files) {
      if (f.size > MAX_SIZE_BYTES) return json({ success: false, error: "file_too_large", file: f.name }, 400);
      if (f.type && !ALLOWED_TYPES.has(f.type)) {
        return json({ success: false, error: "unsupported_file_type", file: f.name, type: f.type }, 400);
      }
    }

    const declarationId = crypto.randomUUID();
    const evidence: { path: string; name: string; size_bytes: number; content_type: string }[] = [];

    for (const f of files) {
      const safeName = f.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
      const path = `${vendorId}/${declarationId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, f, { contentType: f.type || "application/octet-stream" });
      if (upErr) {
        return json({ success: false, error: "upload_failed", detail: upErr.message, file: f.name }, 500);
      }
      evidence.push({ path, name: f.name, size_bytes: f.size, content_type: f.type || "application/octet-stream" });
    }

    const { error: insErr } = await supabase.from("vendor_client_declarations").insert({
      id: declarationId,
      vendor_id: vendorId,
      client_name: clientName,
      relationship_details: details,
      first_engaged_date: firstEngagedRaw,
      evidence_files: evidence,
      status: "pending",
    });
    if (insErr) {
      return json({ success: false, error: "insert_failed", detail: insErr.message }, 500);
    }

    return json({ success: true, declaration_id: declarationId, evidence_count: evidence.length });
  } catch (e) {
    console.error("vendor-submit-client-declaration error:", e);
    return json(
      { success: false, error: "internal_error", detail: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
