/**
 * Netlify Function: get-job-detail
 * Port of vendor-get-job-detail. Direct Postgres queries; signs storage
 * URLs locally with SUPABASE_JWT_SECRET (no Supabase HTTPS round-trip).
 *
 * POST /sb/get-job-detail
 * Body: { session_token: string, step_id: string, offer_id?: string }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { signStorageUrl, signSourceFile } from "./_lib/storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FileRow {
  storage_path: string;
  filename: string;
  file_size: number | null;
  mime_type: string | null;
  source: string;
  download_url: string | null;
  word_count?: number;
  page_count?: number;
  file_label?: string | null;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      step_id?: string;
      offer_id?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const stepId = body.step_id;
    const offerIdParam = body.offer_id;
    if (!stepId) return err("Missing step_id", 400);

    const stepRows = await query<{
      id: string; workflow_id: string; step_number: number; name: string;
      actor_type: string; status: string; service_id: string | null;
      order_id: string; vendor_id: string | null;
      source_language: string | null; target_language: string | null;
      vendor_rate: number | null; vendor_rate_unit: string | null;
      vendor_total: number | null; vendor_currency: string | null;
      pricing_mode: string | null; deadline: string | null;
      offered_at: string | null; accepted_at: string | null;
      started_at: string | null; delivered_at: string | null;
      approved_at: string | null; instructions: string | null;
      rejection_reason: string | null; revision_count: number | null;
      requires_file_upload: boolean | null; notes_from_vendor: string | null;
    }>(
      `SELECT id, workflow_id, step_number, name, actor_type, status, service_id,
              order_id, vendor_id, source_language, target_language,
              vendor_rate, vendor_rate_unit, vendor_total, vendor_currency, pricing_mode,
              deadline, offered_at, accepted_at, started_at, delivered_at,
              approved_at, instructions, rejection_reason, revision_count,
              requires_file_upload, notes_from_vendor
       FROM order_workflow_steps WHERE id = $1 LIMIT 1`,
      [stepId],
    );
    const step = stepRows[0];
    if (!step) return err("Step not found", 404);

    const isAssigned = step.vendor_id === vendor_id;

    // Vendor file package (Dropbox) — only surfaced to the assigned vendor.
    let dropboxPackage: {
      dropbox_download_link: string | null;
      dropbox_upload_link: string | null;
      current_version: number | null;
    } | null = null;
    if (isAssigned) {
      const pkgRows = await query<{
        dropbox_download_link: string | null;
        dropbox_upload_link: string | null;
        current_version: number | null;
      }>(
        `SELECT dropbox_download_link, dropbox_upload_link, current_version
         FROM vendor_step_packages WHERE step_id = $1 LIMIT 1`,
        [stepId],
      );
      dropboxPackage = pkgRows[0] ?? null;
    }

    let stepOffer: {
      id: string;
      status: string;
      vendor_rate?: number | null;
      vendor_rate_unit?: string | null;
      vendor_total?: number | null;
      vendor_currency?: string | null;
      pricing_mode?: string | null;
      deadline?: string | null;
      expires_at: string | null;
      instructions?: string | null;
      offered_at?: string | null;
      negotiation_allowed: boolean | null;
    } | null = null;

    if (!isAssigned) {
      const offers = await query<typeof stepOffer & object>(
        `SELECT id, status, vendor_rate, vendor_rate_unit, vendor_total, vendor_currency,
                pricing_mode, deadline, expires_at, instructions, offered_at, negotiation_allowed
         FROM vendor_step_offers
         WHERE step_id = $1 AND vendor_id = $2 LIMIT 1`,
        [stepId, vendor_id],
      );
      if (!offers[0]) return err("Not authorized for this step", 403);
      stepOffer = offers[0];
    } else if (offerIdParam) {
      const offers = await query<{
        id: string; status: string; expires_at: string | null; negotiation_allowed: boolean | null;
      }>(
        `SELECT id, status, expires_at, negotiation_allowed
         FROM vendor_step_offers
         WHERE id = $1 AND vendor_id = $2 LIMIT 1`,
        [offerIdParam, vendor_id],
      );
      stepOffer = offers[0]
        ? { ...offers[0], negotiation_allowed: offers[0].negotiation_allowed }
        : null;
    }

    const [workflows, orders, services] = await Promise.all([
      query<{ id: string; total_steps: number | null; template_code: string | null }>(
        `SELECT id, total_steps, template_code FROM order_workflows WHERE id = $1 LIMIT 1`,
        [step.workflow_id],
      ),
      query<{
        id: string; order_number: string; internal_project_id: string | null;
        quote_id: string | null; is_rush: boolean | null;
        estimated_delivery_date: string | null; estimated_delivery_at: string | null;
      }>(
        `SELECT id, order_number, internal_project_id, quote_id, is_rush,
                estimated_delivery_date::text AS estimated_delivery_date,
                estimated_delivery_at
         FROM orders WHERE id = $1 LIMIT 1`,
        [step.order_id],
      ),
      step.service_id
        ? query<{ id: string; name: string }>(
            `SELECT id, name FROM services WHERE id = $1 LIMIT 1`,
            [step.service_id],
          )
        : Promise.resolve([] as { id: string; name: string }[]),
    ]);
    const workflow = workflows[0];
    const order = orders[0];
    const service = services[0];

    const langUuids = [step.source_language, step.target_language].filter(
      (v): v is string => !!v && UUID_RE.test(v),
    );
    const langMap = new Map<string, string>();
    if (langUuids.length > 0) {
      const rows = await query<{ id: string; code: string }>(
        `SELECT id, code FROM languages WHERE id = ANY($1::uuid[])`,
        [langUuids],
      );
      for (const r of rows) langMap.set(r.id, r.code.toUpperCase());
    }
    const resolveLang = (v: string | null) => {
      if (!v) return null;
      if (UUID_RE.test(v)) return langMap.get(v) ?? v;
      return v.toUpperCase();
    };

    let workflowTemplateName: string | null = null;
    let totalSteps: number | null = workflow?.total_steps ?? null;
    if (workflow?.template_code) {
      const tpls = await query<{ name: string }>(
        `SELECT name FROM workflow_templates WHERE code = $1 LIMIT 1`,
        [workflow.template_code],
      );
      workflowTemplateName = tpls[0]?.name ?? null;
    }
    if (totalSteps == null) {
      const c = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM order_workflow_steps WHERE workflow_id = $1`,
        [step.workflow_id],
      );
      totalSteps = Number(c[0]?.n ?? "0");
    }

    let projectInfo: { project_number: string; vendor_notes: string | null; prior_task_count: number } | null = null;
    let glossaryPath: string | null = null;
    let styleGuidePath: string | null = null;
    if (order?.internal_project_id) {
      const projs = await query<{
        project_number: string | null; vendor_notes: string | null;
        glossary_storage_path: string | null; style_guide_storage_path: string | null;
      }>(
        `SELECT project_number, vendor_notes, glossary_storage_path, style_guide_storage_path
         FROM internal_projects WHERE id = $1 LIMIT 1`,
        [order.internal_project_id],
      );
      const proj = projs[0];
      if (proj?.project_number) {
        projectInfo = {
          project_number: proj.project_number,
          vendor_notes: proj.vendor_notes ?? null,
          prior_task_count: 0,
        };
        glossaryPath = proj.glossary_storage_path;
        styleGuidePath = proj.style_guide_storage_path;
        const prior = await query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM orders WHERE internal_project_id = $1 AND id <> $2`,
          [order.internal_project_id, order.id],
        );
        projectInfo.prior_task_count = Number(prior[0]?.n ?? "0");
      }
    }

    const sourceFiles: FileRow[] = [];
    let totalWords = 0;
    let totalPages = 0;
    const documents: Array<{ filename: string; word_count: number; page_count: number }> = [];

    if (order?.quote_id) {
      // Step-split scoping: if step_files rows exist for this step, the
      // vendor only sees their assigned subset; otherwise (legacy / unsplit
      // steps) they see the whole quote. The OR-NOT-EXISTS subquery keeps
      // the behaviour additive — no change for any step that hasn't been
      // through the split flow.
      const qfiles = await query<{
        id: string; original_filename: string; storage_path: string;
        file_size: number | null; mime_type: string | null;
        category_name: string | null; custom_label: string | null;
      }>(
        `SELECT qf.id, qf.original_filename, qf.storage_path, qf.file_size, qf.mime_type,
                fc.name AS category_name, qf.custom_label
         FROM quote_files qf
         LEFT JOIN file_categories fc ON fc.id = qf.file_category_id
         WHERE qf.quote_id = $1 AND qf.deleted_at IS NULL AND COALESCE(qf.upload_status, '') <> 'failed'
           AND (
             NOT EXISTS (SELECT 1 FROM step_files WHERE step_id = $2)
             OR EXISTS (SELECT 1 FROM step_files sf WHERE sf.step_id = $2 AND sf.quote_file_id = qf.id)
           )
         ORDER BY qf.sort_order ASC NULLS LAST, qf.created_at ASC`,
        [order.quote_id, stepId],
      );

      if (qfiles.length > 0) {
        // ai_analysis_results stores word/page counts in two shapes:
        //   1. Per-file rows (newer): quote_file_id set, one row per file
        //   2. Quote-level rows (older): quote_file_id null, one row per
        //      quote covering all files
        // We sum at the quote level for accurate totals, then attempt a
        // per-file split using quote_file_id where available.
        const aiRows = await query<{
          quote_file_id: string | null;
          word_count: number | null;
          page_count: number | null;
        }>(
          `SELECT quote_file_id, word_count, page_count
           FROM ai_analysis_results
           WHERE quote_id = $1 AND deleted_at IS NULL`,
          [order.quote_id],
        );

        const aiByFile: Record<string, { wc: number; pc: number }> = {};
        let unassignedWords = 0;
        let unassignedPages = 0;
        for (const a of aiRows) {
          const wc = Number(a.word_count) || 0;
          const pc = Number(a.page_count) || 0;
          if (a.quote_file_id) {
            aiByFile[a.quote_file_id] = { wc, pc };
          } else {
            unassignedWords += wc;
            unassignedPages += pc;
          }
        }

        // Apportion quote-level totals across files that don't have a
        // per-file match, evenly. Better than displaying 0 everywhere.
        const unmatchedFiles = qfiles.filter((f) => !aiByFile[f.id]);
        const perFileWords = unmatchedFiles.length > 0
          ? Math.round(unassignedWords / unmatchedFiles.length)
          : 0;
        const perFilePages = unmatchedFiles.length > 0
          ? Math.round((unassignedPages / unmatchedFiles.length) * 10) / 10
          : 0;

        for (const f of qfiles) {
          const wc = aiByFile[f.id]?.wc ?? perFileWords;
          const pc = aiByFile[f.id]?.pc ?? perFilePages;
          sourceFiles.push({
            storage_path: f.storage_path,
            filename: f.original_filename,
            file_size: f.file_size,
            mime_type: f.mime_type,
            source: "order",
            download_url: signSourceFile(f.storage_path),
            word_count: wc,
            page_count: pc,
            file_label: f.custom_label || f.category_name || null,
          });
          totalWords += wc;
          totalPages += pc;
          documents.push({ filename: f.original_filename, word_count: wc, page_count: pc });
        }
      }
    }

    const referenceFiles: FileRow[] = [];
    if (glossaryPath) {
      referenceFiles.push({
        storage_path: glossaryPath,
        filename: glossaryPath.split("/").pop() || "Glossary",
        file_size: null,
        mime_type: null,
        source: "project_glossary",
        download_url: signStorageUrl("project-assets", glossaryPath),
      });
    }
    if (styleGuidePath) {
      referenceFiles.push({
        storage_path: styleGuidePath,
        filename: styleGuidePath.split("/").pop() || "Style guide",
        file_size: null,
        mime_type: null,
        source: "project_style_guide",
        download_url: signStorageUrl("project-assets", styleGuidePath),
      });
    }

    const deliveredFiles: FileRow[] = [];
    // step_deliveries stores delivered files in `file_paths` (text[]) —
    // not a `files` jsonb column the original Supabase function referenced.
    // Filenames are the last segment of the storage path; we lose file
    // size + mime type for delivered files, which the UI tolerates.
    const deliveries = await query<{ id: string; version: number; file_paths: string[] | null }>(
      `SELECT id, version, file_paths FROM step_deliveries
       WHERE step_id = $1 ORDER BY version DESC LIMIT 1`,
      [step.id],
    );
    const latest = deliveries[0];
    const paths: string[] = Array.isArray(latest?.file_paths) ? latest!.file_paths : [];
    for (const p of paths) {
      if (!p) continue;
      deliveredFiles.push({
        storage_path: p,
        filename: p.split("/").pop() || "delivered_file",
        file_size: null,
        mime_type: null,
        source: "delivered",
        download_url: signStorageUrl("step-deliveries", p),
      });
    }

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
        estimated_delivery_at: order?.estimated_delivery_at ?? null,
        service_name: service?.name ?? null,
        source_language: resolveLang(step.source_language),
        target_language: resolveLang(step.target_language),
        // Prefer the active offer's rate fields when present — the
        // step row's vendor_rate columns are only authoritative once a
        // vendor accepts (accept-step copies offer rate onto the step).
        // For status='offered' the step row often carries stale rate
        // values left over from a prior direct_assign / accepted offer
        // that was later retracted. The get-jobs list view already reads
        // from the offer row; this aligns the detail modal with that.
        vendor_rate: stepOffer?.vendor_rate ?? step.vendor_rate,
        vendor_rate_unit: stepOffer?.vendor_rate_unit ?? step.vendor_rate_unit,
        vendor_total: stepOffer?.vendor_total ?? step.vendor_total,
        vendor_currency: stepOffer?.vendor_currency ?? step.vendor_currency,
        pricing_mode: stepOffer?.pricing_mode ?? step.pricing_mode ?? "per_unit",
        deadline: stepOffer?.deadline ?? step.deadline,
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
        // Vendor file package (Dropbox) links — assigned vendor only.
        dropbox_download_link: dropboxPackage?.dropbox_download_link ?? null,
        dropbox_upload_link: dropboxPackage?.dropbox_upload_link ?? null,
        package_version: dropboxPackage?.current_version ?? null,
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
  } catch (e) {
    console.error("get-job-detail error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
