// ============================================================================
// vendor-get-job-detail v1 (rebuilt from scratch — original bundle was lost)
// Returns the full job detail payload that JobDetailModal needs:
//   { job, project, volume, source_files, reference_files, delivered_files }
//
// Fixes vs the previous deployed bundle:
//   * order_workflow_steps.{source,target}_language are UUIDs (FKs to
//     `languages`). Resolve them to uppercase ISO codes before returning,
//     matching what vendor_language_pairs and the client LANGUAGES lookup
//     expect.
//   * source_files were always [] before — now we pull from quote_files
//     (the customer-uploaded order documents) and mint signed URLs
//     scoped to a 1-hour TTL.
//   * reference_files include the project's glossary + style guide
//     uploaded under internal_projects.{glossary,style_guide}_storage_path.
//   * delivered_files come from step_deliveries for the step.
//   * volume is computed from quote_files instead of always returning 0.
//
// Auth: vendor_sessions bearer token. Cooperates with the impersonation
// flow because impersonation rows live in the same table.
// Date: 2026-05-09
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGN_TTL = 3600; // 1 hour

interface FileRow {
  storage_path: string;
  // The vendor portal client (JobDetailFile) reads { filename, download_url };
  // keep field names aligned so the modal renders without an extra mapping.
  filename: string;
  file_size: number | null;
  mime_type: string | null;
  source: string;
  download_url: string | null;
  word_count?: number;
  page_count?: number;
}

async function signQuoteFile(
  sb: any,
  bucket: string,
  storagePath: string,
): Promise<string | null> {
  try {
    const { data } = await sb.storage
      .from(bucket)
      .createSignedUrl(storagePath, SIGN_TTL);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Auth: vendor session token ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const { data: session } = await sb
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ error: "Invalid or expired session" }, 401);

    const vendorId = session.vendor_id;

    // ── Inputs ──
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // GET-style fallback
      const u = new URL(req.url);
      body = {
        step_id: u.searchParams.get("step_id"),
        offer_id: u.searchParams.get("offer_id"),
      };
    }
    const stepId: string | undefined = body?.step_id;
    const offerId: string | undefined = body?.offer_id ?? undefined;
    if (!stepId) return json({ error: "Missing step_id" }, 400);

    // ── Step + workflow + order ──
    const { data: step, error: stepErr } = await sb
      .from("order_workflow_steps")
      .select(
        `id, workflow_id, step_number, name, actor_type, status, service_id,
         order_id, vendor_id, source_language, target_language,
         vendor_rate, vendor_rate_unit, vendor_total, vendor_currency,
         deadline, offered_at, accepted_at, started_at, delivered_at,
         approved_at, instructions, rejection_reason, revision_count,
         requires_file_upload, notes_from_vendor`,
      )
      .eq("id", stepId)
      .maybeSingle();
    if (stepErr || !step) return json({ error: "Step not found" }, 404);

    // Authorization: this step must either be assigned to the vendor or
    // there must be a pending offer to this vendor for this step. We
    // intentionally allow any vendor with an offer to peek at the detail
    // so they can decide whether to accept.
    const isAssigned = step.vendor_id === vendorId;
    let stepOffer: any = null;
    if (!isAssigned) {
      const { data: offer } = await sb
        .from("vendor_step_offers")
        .select(
          "id, status, vendor_rate, vendor_rate_unit, vendor_total, vendor_currency, deadline, expires_at, instructions, offered_at, negotiation_allowed",
        )
        .eq("step_id", stepId)
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (!offer) return json({ error: "Not authorized for this step" }, 403);
      stepOffer = offer;
    } else if (offerId) {
      const { data: offer } = await sb
        .from("vendor_step_offers")
        .select(
          "id, status, expires_at, negotiation_allowed",
        )
        .eq("id", offerId)
        .eq("vendor_id", vendorId)
        .maybeSingle();
      stepOffer = offer ?? null;
    }

    const [
      { data: workflow },
      { data: order },
      { data: service },
    ] = await Promise.all([
      sb
        .from("order_workflows")
        .select("id, total_steps, template_code")
        .eq("id", step.workflow_id)
        .maybeSingle(),
      sb
        .from("orders")
        .select(
          "id, order_number, internal_project_id, quote_id, is_rush, estimated_delivery_date",
        )
        .eq("id", step.order_id)
        .maybeSingle(),
      step.service_id
        ? sb
          .from("services")
          .select("id, name")
          .eq("id", step.service_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ── Resolve language UUIDs → uppercase ISO codes ──
    const langUuids = [step.source_language, step.target_language].filter(
      (v: any) => v && UUID_RE.test(v),
    ) as string[];
    let langMap = new Map<string, string>();
    if (langUuids.length > 0) {
      const { data: langs } = await sb
        .from("languages")
        .select("id, code")
        .in("id", langUuids);
      langMap = new Map(
        (langs || []).map((r: any) => [r.id as string, (r.code as string).toUpperCase()]),
      );
    }
    const resolveLang = (v: string | null) => {
      if (!v) return null;
      if (UUID_RE.test(v)) return langMap.get(v) ?? v;
      return v.toUpperCase();
    };

    // ── Workflow template lookup (for total_steps + label) ──
    let workflowTemplateName: string | null = null;
    let totalSteps = workflow?.total_steps ?? null;
    if (workflow?.template_code) {
      const { data: tpl } = await sb
        .from("workflow_templates")
        .select("name")
        .eq("code", workflow.template_code)
        .maybeSingle();
      workflowTemplateName = tpl?.name ?? null;
    }
    if (totalSteps == null) {
      const { count } = await sb
        .from("order_workflow_steps")
        .select("id", { count: "exact", head: true })
        .eq("workflow_id", step.workflow_id);
      totalSteps = count ?? null;
    }

    // ── Project info ──
    let projectInfo: { project_number: string; vendor_notes: string | null; prior_task_count: number } = {
      project_number: "—",
      vendor_notes: null,
      prior_task_count: 0,
    };
    let glossaryPath: string | null = null;
    let styleGuidePath: string | null = null;
    if (order?.internal_project_id) {
      const { data: proj } = await sb
        .from("internal_projects")
        .select(
          "project_number, vendor_notes, glossary_storage_path, style_guide_storage_path",
        )
        .eq("id", order.internal_project_id)
        .maybeSingle();
      if (proj) {
        projectInfo.project_number = proj.project_number ?? "—";
        projectInfo.vendor_notes = proj.vendor_notes ?? null;
        glossaryPath = proj.glossary_storage_path ?? null;
        styleGuidePath = proj.style_guide_storage_path ?? null;
      }
      // Prior task count: distinct prior orders on the same project
      const { count: priorOrderCount } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("internal_project_id", order.internal_project_id)
        .neq("id", order.id);
      projectInfo.prior_task_count = priorOrderCount ?? 0;
    }

    // ── Source files: pull from quote_files, sign each ──
    const sourceFiles: FileRow[] = [];
    let totalWords = 0;
    let totalPages = 0;
    const documents: Array<{ filename: string; word_count: number; page_count: number }> = [];

    if (order?.quote_id) {
      const { data: qfiles } = await sb
        .from("quote_files")
        .select(
          "id, original_filename, storage_path, file_size, mime_type, deleted_at, upload_status",
        )
        .eq("quote_id", order.quote_id)
        .is("deleted_at", null)
        .neq("upload_status", "failed")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (qfiles && qfiles.length > 0) {
        const fileIds = qfiles.map((f: any) => f.id);
        // ai_analysis_results carries word/page counts for analyzed files
        const { data: aiRows } = await sb
          .from("ai_analysis_results")
          .select("file_id, word_count, page_count, deleted_at")
          .in("file_id", fileIds)
          .is("deleted_at", null);
        const aiByFile: Record<string, { wc: number; pc: number }> = {};
        for (const a of aiRows || []) {
          aiByFile[a.file_id] = {
            wc: Number(a.word_count) || 0,
            pc: Number(a.page_count) || 0,
          };
        }

        for (const f of qfiles) {
          const signed = await signQuoteFile(sb, "quote-files", f.storage_path);
          const wc = aiByFile[f.id]?.wc ?? 0;
          const pc = aiByFile[f.id]?.pc ?? 0;
          sourceFiles.push({
            storage_path: f.storage_path,
            filename: f.original_filename,
            file_size: f.file_size,
            mime_type: f.mime_type,
            source: "order",
            download_url: signed,
            word_count: wc,
            page_count: pc,
          });
          totalWords += wc;
          totalPages += pc;
          documents.push({
            filename: f.original_filename,
            word_count: wc,
            page_count: pc,
          });
        }
      }
    }

    // ── Reference files: project glossary + style guide ──
    const referenceFiles: FileRow[] = [];
    if (glossaryPath) {
      const signed = await signQuoteFile(sb, "project-assets", glossaryPath);
      referenceFiles.push({
        storage_path: glossaryPath,
        filename: glossaryPath.split("/").pop() || "Glossary",
        file_size: null,
        mime_type: null,
        source: "project_glossary",
        download_url: signed,
      });
    }
    if (styleGuidePath) {
      const signed = await signQuoteFile(sb, "project-assets", styleGuidePath);
      referenceFiles.push({
        storage_path: styleGuidePath,
        filename: styleGuidePath.split("/").pop() || "Style guide",
        file_size: null,
        mime_type: null,
        source: "project_style_guide",
        download_url: signed,
      });
    }

    // ── Delivered files (current step's deliveries) ──
    const deliveredFiles: FileRow[] = [];
    const { data: deliveries } = await sb
      .from("step_deliveries")
      .select("id, version, files, delivered_at, review_status")
      .eq("step_id", step.id)
      .order("version", { ascending: false });
    const latestDelivery = (deliveries || [])[0];
    const deliveryFileList: any[] = Array.isArray(latestDelivery?.files)
      ? latestDelivery.files
      : [];
    for (const f of deliveryFileList) {
      if (!f?.storage_path) continue;
      const signed = await signQuoteFile(sb, "step-deliveries", f.storage_path);
      deliveredFiles.push({
        storage_path: f.storage_path,
        filename: f.original_filename || f.filename || "delivered_file",
        file_size: f.file_size ?? null,
        mime_type: f.mime_type ?? null,
        source: "delivered",
        download_url: signed,
      });
    }

    // ── Build response ──
    return json({
      success: true,
      job: {
        step_id: step.id,
        step_number: step.step_number,
        step_name: step.name,
        status: step.status,
        actor_type: step.actor_type,
        workflow_position: `Step ${step.step_number} of ${totalSteps ?? "?"}`,
        workflow_template: workflowTemplateName,
        total_steps: totalSteps,
        order_number: order?.order_number ?? null,
        is_rush: !!order?.is_rush,
        estimated_delivery_date: order?.estimated_delivery_date ?? null,
        service_name: service?.name ?? null,
        source_language: resolveLang(step.source_language),
        target_language: resolveLang(step.target_language),
        vendor_rate: step.vendor_rate,
        vendor_rate_unit: step.vendor_rate_unit,
        vendor_total: step.vendor_total,
        vendor_currency: step.vendor_currency,
        deadline: step.deadline,
        expires_at: stepOffer?.expires_at ?? null,
        offered_at: step.offered_at,
        accepted_at: step.accepted_at,
        started_at: step.started_at,
        delivered_at: step.delivered_at,
        approved_at: step.approved_at,
        instructions: step.instructions ?? stepOffer?.instructions ?? null,
        rejection_reason: step.rejection_reason,
        notes_from_vendor: step.notes_from_vendor,
        revision_count: step.revision_count ?? 0,
        requires_file_upload: !!step.requires_file_upload,
        offer_id: stepOffer?.id ?? null,
        offer_status: stepOffer?.status ?? null,
        negotiation_allowed: stepOffer?.negotiation_allowed ?? false,
      },
      project: projectInfo,
      volume: {
        total_files: sourceFiles.length,
        total_word_count: totalWords,
        total_page_count: totalPages,
        documents,
      },
      source_files: sourceFiles,
      reference_files: referenceFiles,
      delivered_files: deliveredFiles,
    });
  } catch (err: any) {
    console.error("vendor-get-job-detail error:", err?.message || err);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
