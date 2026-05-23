/**
 * Netlify Function: accept-step
 * Port of vendor-accept-step. Vendor accepts a pending offer on a step.
 *
 * POST /sb/accept-step
 * Body: { session_token: string, step_id: string, offer_id?: string }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { sendMailgun } from "./_lib/mailgun";
import { renderJobAssignedEmail } from "./_lib/email-job-assigned";

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

    const offerSql = offerIdParam
      ? `SELECT id, step_id, vendor_id, status, vendor_rate, vendor_rate_unit,
                vendor_total, vendor_currency, deadline, expires_at, instructions
         FROM vendor_step_offers
         WHERE step_id = $1 AND vendor_id = $2 AND status = 'pending' AND id = $3
         LIMIT 1`
      : `SELECT id, step_id, vendor_id, status, vendor_rate, vendor_rate_unit,
                vendor_total, vendor_currency, deadline, expires_at, instructions
         FROM vendor_step_offers
         WHERE step_id = $1 AND vendor_id = $2 AND status = 'pending'
         LIMIT 1`;
    const offerParams = offerIdParam ? [stepId, vendor_id, offerIdParam] : [stepId, vendor_id];

    const offers = await query<{
      id: string; vendor_rate: number | null; vendor_rate_unit: string | null;
      vendor_total: number | null; vendor_currency: string | null;
      deadline: string | null; expires_at: string | null; instructions: string | null;
    }>(offerSql, offerParams);
    const offer = offers[0];
    if (!offer) {
      return json({ success: false, error: "No active offer found for you on this step" }, 404);
    }

    if (offer.expires_at && new Date(offer.expires_at).getTime() < Date.now()) {
      await query(
        `UPDATE vendor_step_offers SET status = 'expired', responded_at = now() WHERE id = $1`,
        [offer.id],
      );
      return json({ success: false, error: "Offer has expired" }, 409);
    }

    const nowIso = new Date().toISOString();

    await query(
      `UPDATE vendor_step_offers SET status = 'accepted', responded_at = now() WHERE id = $1`,
      [offer.id],
    );

    await query(
      `UPDATE vendor_step_offers
       SET status = 'retracted', responded_at = now()
       WHERE step_id = $1 AND id <> $2 AND status IN ('pending', 'offered')`,
      [stepId, offer.id],
    );

    const stepRows = await query<{ id: string; workflow_id: string }>(
      `SELECT id, workflow_id FROM order_workflow_steps WHERE id = $1 LIMIT 1`,
      [stepId],
    );
    const stepRow = stepRows[0];

    await query(
      `UPDATE order_workflow_steps
       SET status = 'accepted', vendor_id = $2, vendor_rate = $3, vendor_rate_unit = $4,
           vendor_total = $5, vendor_currency = $6, deadline = $7,
           instructions = $8, accepted_at = now()
       WHERE id = $1`,
      [
        stepId, vendor_id, offer.vendor_rate, offer.vendor_rate_unit,
        offer.vendor_total, offer.vendor_currency, offer.deadline, offer.instructions,
      ],
    );

    await query(
      `UPDATE vendor_payables
       SET status = 'approved', approved_at = now()
       WHERE workflow_step_id = $1 AND vendor_id = $2 AND status = 'pending'`,
      [stepId, vendor_id],
    );

    await query(
      `UPDATE vendor_payables
       SET status = 'cancelled'
       WHERE workflow_step_id = $1 AND vendor_id <> $2 AND status = 'pending'`,
      [stepId, vendor_id],
    );

    if (stepRow?.workflow_id) {
      await query(
        `UPDATE order_workflows SET status = 'in_progress'
         WHERE id = $1 AND status = 'not_started'`,
        [stepRow.workflow_id],
      );
    }

    // Fire "job assigned" email to the vendor (best-effort — never block the accept response).
    try {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const [vendors, steps, orders] = await Promise.all([
        query<{ full_name: string; email: string }>(
          `SELECT full_name, email FROM vendors WHERE id = $1 LIMIT 1`,
          [vendor_id],
        ),
        query<{
          name: string; order_id: string; service_id: string | null;
          source_language: string | null; target_language: string | null;
        }>(
          `SELECT name, order_id, service_id, source_language, target_language
           FROM order_workflow_steps WHERE id = $1 LIMIT 1`,
          [stepId],
        ),
      ]);
      const vendor = vendors[0];
      const step = steps[0];

      if (vendor && step) {
        const orderRows = await query<{
          order_number: string; quote_id: string | null;
        }>(
          `SELECT order_number, quote_id FROM orders WHERE id = $1 LIMIT 1`,
          [step.order_id],
        );
        const order = orderRows[0];

        const serviceRows = step.service_id
          ? await query<{ name: string }>(
              `SELECT name FROM services WHERE id = $1 LIMIT 1`,
              [step.service_id],
            )
          : [];

        const langUuids = [step.source_language, step.target_language].filter(
          (v): v is string => !!v && UUID_RE.test(v),
        );
        const langMap = new Map<string, string>();
        if (langUuids.length > 0) {
          const langRows = await query<{ id: string; code: string }>(
            `SELECT id, code FROM languages WHERE id = ANY($1::uuid[])`,
            [langUuids],
          );
          for (const r of langRows) langMap.set(r.id, r.code.toUpperCase());
        }
        const resolveLang = (v: string | null) => {
          if (!v) return "—";
          if (UUID_RE.test(v)) return langMap.get(v) ?? v;
          return v.toUpperCase();
        };

        let wordCount = 0;
        let pageCount = 0;
        let fileCount = 0;
        if (order?.quote_id) {
          const volRows = await query<{ fc: string; wc: string; pc: string }>(
            `SELECT COUNT(*)::text AS fc,
                    COALESCE(SUM(ar.word_count), 0)::text AS wc,
                    COALESCE(SUM(ar.page_count), 0)::text AS pc
             FROM quote_files qf
             LEFT JOIN ai_analysis_results ar ON ar.quote_file_id = qf.id AND ar.deleted_at IS NULL
             WHERE qf.quote_id = $1 AND qf.deleted_at IS NULL
               AND COALESCE(qf.upload_status, '') <> 'failed'`,
            [order.quote_id],
          );
          if (volRows[0]) {
            fileCount = Number(volRows[0].fc) || 0;
            wordCount = Number(volRows[0].wc) || 0;
            pageCount = Number(volRows[0].pc) || 0;
          }
        }

        const rendered = renderJobAssignedEmail({
          vendor_name: vendor.full_name || "there",
          order_number: order?.order_number ?? "—",
          step_name: step.name,
          source_language: resolveLang(step.source_language),
          target_language: resolveLang(step.target_language),
          service_name: serviceRows[0]?.name ?? null,
          word_count: wordCount,
          page_count: pageCount,
          deadline: offer.deadline,
          vendor_rate: offer.vendor_rate,
          vendor_rate_unit: offer.vendor_rate_unit,
          vendor_total: offer.vendor_total,
          vendor_currency: offer.vendor_currency,
          instructions: offer.instructions,
          portal_url: process.env.VITE_VENDOR_URL || "https://vendor.cethos.com",
          file_count: fileCount,
        });

        await sendMailgun({
          to: { email: vendor.email, name: vendor.full_name },
          subject: rendered.subject,
          html: rendered.html,
          tags: ["job-assigned", stepId],
        });
      }
    } catch (emailErr) {
      console.error("accept-step: email send failed (non-blocking):", emailErr);
    }

    return json({
      success: true,
      step_id: stepId,
      offer_id: offer.id,
      accepted_at: nowIso,
    });
  } catch (e) {
    console.error("accept-step error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
