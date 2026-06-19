// ============================================================================
// vendor-roster-release-evidence
//
// The agency responds to a Cethos evidence demand by uploading the
// supporting documents for the roster linguist. Files land in the private
// roster-evidence-locker (staff-readable audit locker, immutable), a
// roster_evidence_releases row is recorded per file, and the demand is
// marked released.
//
// Transport: multipart/form-data {
//   demand_id, evidence_kind?, files (one or more)
// }
// Auth: vendor_sessions token (Authorization header). Agency-only.
// Deployed --no-verify-jwt.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  corsHeaders, json, getServiceClient, resolveVendorId, requireAgency,
} from "../_shared/roster-shared.ts";

const LOCKER = "roster-evidence-locker";
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per file

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

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

    const demandId = String(form.get("demand_id") ?? "").trim();
    const evidenceKind = ((form.get("evidence_kind") as string | null) ?? null)?.trim() || null;
    const bodyToken = (form.get("session_token") as string | null) ?? null;
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (!demandId) return json({ error: "demand_id is required" }, 400);
    if (files.length === 0) return json({ error: "At least one file is required" }, 400);

    const supabase = getServiceClient();
    const vendorId = await resolveVendorId(supabase, req, bodyToken);
    if (!vendorId) return json({ error: "Invalid or expired session" }, 401);
    const agency = await requireAgency(supabase, vendorId);
    if (!agency.ok) return json({ error: "Roster is available for agency accounts only" }, 403);

    // Demand must belong to this vendor and be open.
    const { data: demand } = await supabase
      .from("roster_evidence_demands")
      .select("id, vendor_id, roster_linguist_id, status")
      .eq("id", demandId).eq("vendor_id", vendorId).maybeSingle();
    if (!demand) return json({ error: "Demand not found" }, 404);
    if (demand.status !== "open") return json({ error: `Demand is already ${demand.status}` }, 409);

    const releaseRows: Array<Record<string, unknown>> = [];
    for (const file of files) {
      if (file.size > MAX_SIZE_BYTES) {
        return json({ error: "file_too_large", file: file.name, limit_bytes: MAX_SIZE_BYTES }, 400);
      }
      const path = `${vendorId}/${demandId}/${Date.now()}-${sanitize(file.name)}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from(LOCKER).upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) return json({ error: "storage_upload_failed", detail: upErr.message }, 500);
      releaseRows.push({
        demand_id: demandId,
        vendor_id: vendorId,
        evidence_kind: evidenceKind,
        locker_path: path,
        original_filename: file.name,
        file_mime: file.type || null,
        file_size: file.size,
      });
    }

    const { error: insErr } = await supabase.from("roster_evidence_releases").insert(releaseRows);
    if (insErr) return json({ error: "release_record_failed", detail: insErr.message }, 500);

    const { error: updErr } = await supabase
      .from("roster_evidence_demands")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", demandId).eq("vendor_id", vendorId);
    if (updErr) return json({ error: "demand_update_failed", detail: updErr.message }, 500);

    return json({ success: true, released_count: releaseRows.length });
  } catch (err) {
    console.error("vendor-roster-release-evidence error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
