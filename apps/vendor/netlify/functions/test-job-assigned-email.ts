/**
 * Netlify Function: test-job-assigned-email
 * Sends a test "Job Assigned" email. Accepts optional overrides for every
 * field so callers can preview with real job data.
 *
 * POST /sb/test-job-assigned-email
 * Body: { session_token, to_email?, step_id?, ...field overrides }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { sendMailgun } from "./_lib/mailgun";
import {
  renderJobAssignedEmail,
  type JobAssignedEmailParams,
} from "./_lib/email-job-assigned";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test endpoint, loose body shape
    const body = parseBody(event.body, event.isBase64Encoded) as any;
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;

    const toEmail: string = body.to_email || "ss.raminder@gmail.com";
    const toName: string = body.to_name || "Raminder";

    // If step_id is provided, pull real data from the database.
    let params: JobAssignedEmailParams;

    if (body.step_id) {
      const stepRows = await query<{
        id: string; name: string; order_id: string; service_id: string | null;
        source_language: string | null; target_language: string | null;
        vendor_id: string | null; vendor_rate: number | null;
        vendor_rate_unit: string | null; vendor_total: number | null;
        vendor_currency: string | null; deadline: string | null;
        instructions: string | null;
      }>(
        `SELECT id, name, order_id, service_id, source_language, target_language,
                vendor_id, vendor_rate, vendor_rate_unit, vendor_total,
                vendor_currency, deadline, instructions
         FROM order_workflow_steps WHERE id = $1 LIMIT 1`,
        [body.step_id],
      );
      const step = stepRows[0];
      if (!step) return err("Step not found", 404);

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

      // Resolve language UUIDs
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

      // Volume
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

      // Vendor name for "Hi {name}"
      let vendorName = toName;
      if (step.vendor_id) {
        const vRows = await query<{ full_name: string }>(
          `SELECT full_name FROM vendors WHERE id = $1 LIMIT 1`,
          [step.vendor_id],
        );
        if (vRows[0]) vendorName = vRows[0].full_name || vendorName;
      }

      params = {
        vendor_name: vendorName,
        order_number: order?.order_number ?? "—",
        step_name: step.name,
        source_language: resolveLang(step.source_language),
        target_language: resolveLang(step.target_language),
        service_name: serviceRows[0]?.name ?? null,
        word_count: wordCount,
        page_count: pageCount,
        deadline: step.deadline,
        vendor_rate: step.vendor_rate,
        vendor_rate_unit: step.vendor_rate_unit,
        vendor_total: step.vendor_total,
        vendor_currency: step.vendor_currency,
        instructions: step.instructions,
        portal_url: process.env.VITE_VENDOR_URL || "https://vendor.cethos.com",
        file_count: fileCount,
      };
    } else {
      // Fallback: sample data
      params = {
        vendor_name: toName,
        order_number: "ORD-2026-10226",
        step_name: "Translation",
        source_language: "EN",
        target_language: "FR",
        service_name: "Certified Translation",
        word_count: 2450,
        page_count: 8,
        deadline: "2026-05-28",
        vendor_rate: 0.12,
        vendor_rate_unit: "per_word",
        vendor_total: 294.0,
        vendor_currency: "CAD",
        instructions:
          "Please use the glossary provided in the reference files. Ensure all legal terminology follows the Canadian French standard. Deliver in DOCX format.",
        portal_url: process.env.VITE_VENDOR_URL || "https://vendor.cethos.com",
        file_count: 2,
      };
    }

    const rendered = renderJobAssignedEmail(params);

    const result = await sendMailgun({
      to: { email: toEmail, name: toName },
      subject: rendered.subject,
      html: rendered.html,
      tags: ["job-assigned", "test"],
    });

    if (!result.sent) {
      return err(`Email not sent: ${result.reason}`, 502);
    }

    return json({ success: true, sent_to: toEmail, params });
  } catch (e) {
    console.error("test-job-assigned-email error:", e);
    return err("Internal server error", 500, {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
};
