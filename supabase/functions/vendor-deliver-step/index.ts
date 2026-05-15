// ============================================================================
// vendor-deliver-step v1 (rebuilt from scratch — prior bundle unretrievable)
//
// POST multipart/form-data {
//   step_id: string,
//   notes?: string,
//   files: File[]    // one or more
// }
// Auth: vendor_sessions bearer token.
//
// Behaviour:
//   * Verifies the step is currently assigned to this vendor and in a
//     deliverable state (accepted, in_progress, or revision_requested).
//   * Uploads every file under
//       step-deliveries/<step_id>/v<version>/<sanitized-filename>
//     where <version> is the next step_deliveries.version for the step
//     (1 on first delivery, +1 on each revision).
//   * Inserts a step_deliveries row with file_paths[] + notes.
//   * Updates the workflow step:
//       status='delivered', delivered_at=now,
//       delivered_file_paths=[the new files only],
//       notes_from_vendor=notes (if provided).
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ALLOWED_STATUS = new Set(["accepted", "in_progress", "revision_requested"]);

function sanitize(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);
}

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
      .select("vendor_id, vendor:vendors(id, full_name)")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ success: false, error: "Invalid or expired session" }, 401);
    const vendorId = session.vendor_id;
    const vendorName = (session as any)?.vendor?.full_name ?? null;

    const form = await req.formData().catch(() => null);
    if (!form) return json({ success: false, error: "Expected multipart/form-data" }, 400);

    const stepId = String(form.get("step_id") || "");
    const notes = form.get("notes");
    const notesStr = typeof notes === "string" ? notes : null;
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!stepId) return json({ success: false, error: "Missing step_id" }, 400);
    if (files.length === 0) return json({ success: false, error: "No files provided" }, 400);

    // Verify step belongs to this vendor and is deliverable.
    const { data: step } = await sb
      .from("order_workflow_steps")
      .select("id, vendor_id, status")
      .eq("id", stepId)
      .maybeSingle();
    if (!step) return json({ success: false, error: "Step not found" }, 404);
    if (step.vendor_id !== vendorId) {
      return json({ success: false, error: "Not authorized for this step" }, 403);
    }
    if (!ALLOWED_STATUS.has(step.status)) {
      return json({ success: false, error: `Step status '${step.status}' is not deliverable` }, 409);
    }

    // Determine the next delivery version.
    const { data: prior } = await sb
      .from("step_deliveries")
      .select("version")
      .eq("step_id", stepId)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = (prior?.[0]?.version ?? 0) + 1;

    // Upload every file.
    const uploadedPaths: string[] = [];
    for (const file of files) {
      const path = `${stepId}/v${nextVersion}/${sanitize(file.name)}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await sb.storage
        .from("step-deliveries")
        .upload(path, bytes, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });
      if (upErr) {
        return json({ success: false, error: `Upload failed for ${file.name}: ${upErr.message}` }, 500);
      }
      uploadedPaths.push(path);
    }

    const nowIso = new Date().toISOString();
    const filePayload = uploadedPaths.map((p, i) => ({
      storage_path: p,
      original_filename: files[i].name,
      file_size: files[i].size,
      mime_type: files[i].type || null,
    }));

    // Record the delivery.
    const { data: delivery, error: delErr } = await sb
      .from("step_deliveries")
      .insert({
        step_id: stepId,
        version: nextVersion,
        actor_type: "vendor",
        delivered_by_id: vendorId,
        delivered_by_name: vendorName,
        delivered_at: nowIso,
        file_paths: filePayload,
        notes: notesStr,
        review_status: "pending_review",
      })
      .select("id, version")
      .single();
    if (delErr) {
      return json({ success: false, error: `Failed to record delivery: ${delErr.message}` }, 500);
    }

    // Update the workflow step.
    await sb.from("order_workflow_steps")
      .update({
        status: "delivered",
        delivered_at: nowIso,
        delivered_file_paths: uploadedPaths,
        notes_from_vendor: notesStr,
      })
      .eq("id", stepId);

    return json({
      success: true,
      delivery_id: delivery.id,
      version: delivery.version,
      delivered_at: nowIso,
      file_count: uploadedPaths.length,
    });
  } catch (err: any) {
    console.error("vendor-deliver-step error:", err?.message || err);
    return json({ success: false, error: err?.message || "Internal server error" }, 500);
  }
});
