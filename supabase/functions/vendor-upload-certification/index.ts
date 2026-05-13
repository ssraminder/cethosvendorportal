// ============================================================================
// vendor-upload-certification v2
//
// Vendor uploads a certification document (degree, professional cert,
// language proficiency, etc.) from /iso-evidence/:token or from their
// profile page. Stores the file in the private `vendor-certifications`
// bucket and appends a record to vendors.certifications jsonb.
//
// Two transport modes are supported so this can grow without breaking
// existing callers:
//
//   multipart/form-data  (preferred for any "add" with a file)
//     Fields: action=add, cert_name, expiry_date?, file
//     No base64 bloat — files stream straight to storage. Avoids the
//     1MB-ish JSON body limit that produced 546 errors on real PDFs.
//
//   application/json     (legacy + non-file actions)
//     Body: { action: "add" | "remove", cert_name, expiry_date?,
//             file_base64?, file_name?, file_type? }
//     Kept for the existing base64 callers and any future "remove"
//     path that doesn't ship a file.
//
// Auth: vendor session token in Authorization: Bearer <token>. Function
// is deployed --no-verify-jwt; the gateway accepts the random session
// UUID and validation happens inside via `vendor_sessions`.
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

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — generous; matches CV.
const BUCKET = "vendor-certifications";

interface ParsedRequest {
  action: "add" | "remove";
  cert_name: string;
  expiry_date: string | null;
  file: File | null;
  file_base64: string | null;
  file_name: string | null;
  file_type: string | null;
}

async function parseRequest(req: Request): Promise<{ ok: true; data: ParsedRequest } | { ok: false; error: string }> {
  const contentType = req.headers.get("Content-Type") ?? "";

  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, error: "invalid_form_data" };
    }
    const action = String(form.get("action") ?? "add") as "add" | "remove";
    const cert_name = String(form.get("cert_name") ?? "").trim();
    const expiry_date = (form.get("expiry_date") as string | null)?.trim() || null;
    const file = form.get("file");
    return {
      ok: true,
      data: {
        action,
        cert_name,
        expiry_date,
        file: file instanceof File ? file : null,
        file_base64: null,
        file_name: file instanceof File ? file.name : null,
        file_type: file instanceof File ? file.type : null,
      },
    };
  }

  // JSON path (legacy / remove).
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  return {
    ok: true,
    data: {
      action: ((body.action as string) ?? "add") as "add" | "remove",
      cert_name: String(body.cert_name ?? "").trim(),
      expiry_date: (body.expiry_date as string | null)?.trim() || null,
      file: null,
      file_base64: (body.file_base64 as string | null) ?? null,
      file_name: (body.file_name as string | null) ?? null,
      file_type: (body.file_type as string | null) ?? null,
    },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error: sessionErr } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .single();
    if (sessionErr || !session) return json({ error: "Invalid or expired session" }, 401);

    const parsed = await parseRequest(req);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const body = parsed.data;

    if (!body.action || !body.cert_name) {
      return json({ error: "action and cert_name are required" }, 400);
    }

    const { data: vendor } = await supabase
      .from("vendors")
      .select("certifications, email")
      .eq("id", session.vendor_id)
      .single();
    if (!vendor) return json({ error: "Vendor not found" }, 404);

    const certs = (vendor.certifications as Array<Record<string, unknown>>) || [];

    if (body.action === "add") {
      let storagePath: string | null = null;

      // Multipart path — preferred. File is already a streamable File
      // instance; Supabase storage handles the upload natively without
      // base64 round-tripping.
      if (body.file) {
        if (body.file.size > MAX_SIZE_BYTES) {
          return json({ error: "file_too_large", limit_bytes: MAX_SIZE_BYTES }, 400);
        }
        const safeName = (body.file_name || "cert.pdf").replace(/[^\w.\-]+/g, "_").slice(0, 80);
        const path = `${session.vendor_id}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, body.file, {
            contentType: body.file.type || "application/pdf",
            upsert: false,
          });
        if (uploadErr) {
          console.error("multipart cert upload failed:", uploadErr);
          return json({ error: "storage_upload_failed", detail: uploadErr.message }, 500);
        }
        storagePath = path;
      }
      // Legacy base64 path. Kept so older clients still work — but the
      // multipart path above is what /iso-evidence uses now.
      else if (body.file_base64 && body.file_name) {
        try {
          const fileData = Uint8Array.from(atob(body.file_base64), (c) => c.charCodeAt(0));
          if (fileData.byteLength > MAX_SIZE_BYTES) {
            return json({ error: "file_too_large", limit_bytes: MAX_SIZE_BYTES }, 400);
          }
          const safeName = body.file_name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
          const path = `${session.vendor_id}/${Date.now()}-${safeName}`;
          const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, fileData, {
              contentType: body.file_type || "application/pdf",
              upsert: false,
            });
          if (uploadErr) {
            console.error("base64 cert upload failed:", uploadErr);
            // Continue without file — cert record is still useful.
          } else {
            storagePath = path;
          }
        } catch (e) {
          console.error("base64 decode failed:", e);
        }
      }

      const newCert: Record<string, unknown> = {
        name: body.cert_name,
        expiry_date: body.expiry_date || null,
        storage_path: storagePath,
        added_at: new Date().toISOString(),
        verified: false,
      };
      certs.push(newCert);
    } else if (body.action === "remove") {
      const index = certs.findIndex((c) => c.name === body.cert_name);
      if (index === -1) return json({ error: "Certification not found" }, 404);

      const removedCert = certs[index];
      if (removedCert.storage_path) {
        await supabase.storage
          .from(BUCKET)
          .remove([removedCert.storage_path as string])
          .catch(() => undefined);
      }
      certs.splice(index, 1);
    }

    const { error: updateErr } = await supabase
      .from("vendors")
      .update({ certifications: certs, updated_at: new Date().toISOString() })
      .eq("id", session.vendor_id);
    if (updateErr) {
      console.error("Failed to update certifications:", updateErr);
      return json({ error: "Failed to update certifications" }, 500);
    }

    if (vendor.email) {
      await supabase
        .from("cvp_translators")
        .update({ certifications: certs })
        .eq("email", vendor.email);
    }

    return json({ success: true, certifications: certs });
  } catch (err) {
    console.error("vendor-upload-certification error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
