// vendor-capa-respond — vendor acts on a CAPA/NC escalation Cethos raised to
// them (ISO 17100 §6.1 supplier corrective action). Two actions:
//
//   action=acknowledge   { escalation_id }
//     Marks the escalation acknowledged (awaiting_ack|returned -> acknowledged).
//
//   action=submit         { escalation_id, root_cause, corrective_action,
//                           preventive_action?, file? }
//     Records the vendor's root cause + corrective/preventive action and, if a
//     file is attached, uploads it to the private vendor-capa-evidence bucket
//     first and passes its path to the RPC. root_cause + corrective_action are
//     required; preventive_action + evidence are optional.
//
// Transport: multipart/form-data (preferred for submit-with-file) or
// application/json (acknowledge / submit-without-file). The `action` field is
// read from whichever transport is used.
//
// Auth: vendor_sessions bearer token. Deployed --no-verify-jwt; the gateway
// accepts the random session UUID and validation happens inside. Vendor
// identity is public.vendors(id) resolved from the session token — vendors
// have NO auth.users identity.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function sanitize(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — matches the certifications flow.
const EVIDENCE_BUCKET = "vendor-capa-evidence";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Authentication required" }, 401);

    const { data: session } = await sb
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ success: false, error: "Invalid or expired session" }, 401);
    const vendorId = session.vendor_id;

    // Parse body — multipart (submit-with-file) or JSON (acknowledge / no file).
    let action = "";
    let escalationId = "";
    let rootCause = "";
    let corrective = "";
    let preventive = "";
    let file: File | null = null;

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      action = String(form.get("action") || "");
      escalationId = String(form.get("escalation_id") || "");
      rootCause = String(form.get("root_cause") || "");
      corrective = String(form.get("corrective_action") || "");
      preventive = String(form.get("preventive_action") || "");
      const f = form.get("file");
      if (f instanceof File && f.size > 0) file = f;
    } else {
      const body = await req.json().catch(() => ({}));
      action = String(body.action || "");
      escalationId = String(body.escalation_id || "");
      rootCause = String(body.root_cause || "");
      corrective = String(body.corrective_action || "");
      preventive = String(body.preventive_action || "");
    }

    if (!escalationId) return json({ success: false, error: "Missing escalation_id" }, 400);

    // ── Acknowledge ─────────────────────────────────────────────────────────
    if (action === "acknowledge") {
      const { data, error } = await sb.rpc("qms_vendor_ack_escalation", {
        p_escalation_id: escalationId,
        p_vendor_id: vendorId,
      });
      if (error) return rpcError(error, "Failed to acknowledge");
      return json({ success: true, escalation: data });
    }

    // ── Submit response ───────────────────────────────────────────────────────
    if (action === "submit") {
      if (!rootCause.trim()) return json({ success: false, error: "Root cause is required" }, 400);
      if (!corrective.trim()) return json({ success: false, error: "Corrective action is required" }, 400);

      // Upload optional evidence file first, then pass its path to the RPC.
      let evidencePath: string | null = null;
      if (file) {
        if (file.size > MAX_SIZE_BYTES) {
          return json({ success: false, error: "Evidence file exceeds 10 MB limit" }, 400);
        }
        const path = `${vendorId}/${escalationId}/${Date.now()}-${sanitize(file.name)}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await sb.storage.createBucket(EVIDENCE_BUCKET, { public: false }).catch(() => {});
        const { error: upErr } = await sb.storage
          .from(EVIDENCE_BUCKET)
          .upload(path, bytes, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) {
          console.error("capa evidence upload failed:", upErr.message);
          return json({ success: false, error: `Evidence upload failed: ${upErr.message}` }, 500);
        }
        evidencePath = path;
      }

      const { data, error } = await sb.rpc("qms_vendor_submit_escalation", {
        p_escalation_id: escalationId,
        p_vendor_id: vendorId,
        p_root_cause: rootCause,
        p_corrective: corrective,
        p_preventive: preventive.trim() ? preventive : null,
        p_evidence_path: evidencePath,
      });
      if (error) return rpcError(error, "Failed to submit response");
      return json({ success: true, escalation: data });
    }

    return json({ success: false, error: "Unknown action — expected 'acknowledge' or 'submit'" }, 400);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("vendor-capa-respond error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

// Surface the RPC's own validation/authorisation messages to the vendor.
// The SECURITY DEFINER functions raise "Not authorised…", "Root cause is
// required.", "…not awaiting acknowledgement…" etc. — pass those through so the
// UI can show the real reason. 403 for authz, 400 otherwise.
function rpcError(error: { message: string }, fallback: string): Response {
  const msg = error?.message || fallback;
  const status = /authoris|not authorized/i.test(msg) ? 403 : 400;
  console.error("vendor-capa-respond RPC error:", msg);
  return json({ success: false, error: msg }, status);
}
