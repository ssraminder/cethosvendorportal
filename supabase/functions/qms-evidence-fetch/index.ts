/**
 * qms-evidence-fetch
 *
 * Returns a short-lived signed URL for a QMS competence evidence file or NDA
 * stored in the private `qms-evidence` bucket. Used by admin and vendor-manager
 * UIs to preview/download evidence, and by auditors on a time-bounded JWT
 * during the June 29-30, 2026 audit.
 *
 * Bucket layout (briefing §7.8):
 *   qms-evidence/{vendor_id}/evidence/{evidence_id}-{slug}.{ext}
 *   qms-evidence/{vendor_id}/nda/{nda_id}-{slug}.pdf
 *
 * Request body (POST, JSON):
 *   {
 *     kind: "evidence" | "nda",
 *     recordId: string,           // qms.competence_evidence.id or qms.nda_agreements.id
 *     expirySeconds?: number      // default 600, clamped to [60, 3600]
 *   }
 *
 * Authorisation:
 *   - Caller must present a Supabase JWT (Authorization: Bearer ...).
 *   - We verify the JWT against staff_users + qms.staff_role_assignments.
 *   - qms_admin or qms_vendor_manager: full access.
 *   - qms_auditor: read access (signed URL issued).
 *   - The vendor themselves (vendors.auth_user_id = jwt sub) can fetch their
 *     own evidence/NDA.
 *   - Anyone else: 403.
 *
 * Service role is used to query Storage; the authorisation gate is implemented
 * here rather than relying on storage RLS.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
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

interface Body {
  kind?: "evidence" | "nda";
  recordId?: string;
  expirySeconds?: number;
}

const BUCKET = "qms-evidence";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ success: false, error: "missing_jwt" }, 401);
  }
  const jwt = authHeader.slice(7).trim();

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  const kind = body.kind;
  const recordId = body.recordId;
  if (kind !== "evidence" && kind !== "nda") {
    return json({ success: false, error: "kind_must_be_evidence_or_nda" }, 400);
  }
  if (!recordId) {
    return json({ success: false, error: "recordId_required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  // Resolve the caller's auth_user_id from the JWT.
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userResp, error: userErr } = await authClient.auth.getUser(jwt);
  if (userErr || !userResp?.user) {
    return json({ success: false, error: "invalid_jwt" }, 401);
  }
  const authUserId = userResp.user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Look up the record + storage path.
  let storagePath: string | null = null;
  let vendorId: string | null = null;
  let fileName: string | null = null;
  if (kind === "evidence") {
    const { data, error } = await admin
      .from("competence_evidence")
      .select("storage_path, vendor_id, file_name")
      .eq("id", recordId)
      .maybeSingle();
    if (error) return json({ success: false, error: error.message }, 500);
    if (!data) return json({ success: false, error: "record_not_found" }, 404);
    storagePath = (data.storage_path as string | null) ?? null;
    vendorId = data.vendor_id as string;
    fileName = (data.file_name as string | null) ?? null;
  } else {
    const { data, error } = await admin
      .from("nda_agreements")
      .select("storage_path, vendor_id, template_version")
      .eq("id", recordId)
      .maybeSingle();
    if (error) return json({ success: false, error: error.message }, 500);
    if (!data) return json({ success: false, error: "record_not_found" }, 404);
    storagePath = (data.storage_path as string | null) ?? null;
    vendorId = data.vendor_id as string;
    fileName = `nda-${(data.template_version as string | null) ?? "current"}.pdf`;
  }

  if (!storagePath) {
    return json({ success: false, error: "no_file_on_record" }, 404);
  }

  // Authorisation gate.
  // (1) Is this caller a QMS-active staff user with admin/vendor_manager/auditor role?
  const { data: staff, error: staffErr } = await admin
    .from("staff_users")
    .select("id, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (staffErr) return json({ success: false, error: staffErr.message }, 500);

  let hasStaffAccess = false;
  if (staff && (staff.is_active as boolean)) {
    const { data: assignments, error: aErr } = await admin
      .schema("qms")
      .from("staff_role_assignments")
      .select("qms_role")
      .eq("staff_user_id", staff.id)
      .is("revoked_at", null);
    if (aErr) return json({ success: false, error: aErr.message }, 500);
    const allowed = new Set(["qms_admin", "qms_vendor_manager", "qms_auditor"]);
    hasStaffAccess = (assignments ?? []).some(
      (r: { qms_role: string }) => allowed.has(r.qms_role),
    );
  }

  // (2) If not staff, is this the vendor themselves?
  let isSelf = false;
  if (!hasStaffAccess) {
    const { data: vendor, error: vErr } = await admin
      .from("vendors")
      .select("id, auth_user_id")
      .eq("id", vendorId)
      .maybeSingle();
    if (vErr) return json({ success: false, error: vErr.message }, 500);
    isSelf = !!vendor && (vendor.auth_user_id as string | null) === authUserId;
  }

  if (!hasStaffAccess && !isSelf) {
    return json({ success: false, error: "forbidden" }, 403);
  }

  const expiry = Math.min(Math.max(Number(body.expirySeconds ?? 600), 60), 3600);

  // Issue signed URL.
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiry, {
      download: fileName ?? storagePath.split("/").pop() ?? "evidence",
    });
  if (signErr || !signed?.signedUrl) {
    return json(
      { success: false, error: signErr?.message ?? "signed_url_failed" },
      500,
    );
  }

  const { data: inlineSigned } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiry);

  return json({
    success: true,
    data: {
      signedUrl: signed.signedUrl,
      previewUrl: inlineSigned?.signedUrl ?? signed.signedUrl,
      path: storagePath,
      filename: fileName ?? storagePath.split("/").pop() ?? "evidence",
      expiresInSeconds: expiry,
    },
  });
});
