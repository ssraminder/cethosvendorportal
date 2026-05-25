/**
 * Netlify Function: accept-direct-assign
 * Vendor accepts a directly-assigned step (status = "assigned").
 * Moves the step to "accepted" and sets accepted_at.
 *
 * POST /sb/accept-direct-assign
 * Body: { session_token: string, step_id: string }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      step_id?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const stepId = body.step_id;
    if (!stepId) return err("Missing step_id", 400);

    // Fetch the step and verify it belongs to this vendor and is in "assigned" status
    const steps = await query<{
      id: string;
      vendor_id: string;
      status: string;
      workflow_id: string;
    }>(
      `SELECT id, vendor_id, status, workflow_id
       FROM order_workflow_steps
       WHERE id = $1 LIMIT 1`,
      [stepId],
    );
    const step = steps[0];

    if (!step) {
      return json({ success: false, error: "Step not found" }, 404);
    }

    if (step.vendor_id !== vendor_id) {
      return json(
        { success: false, error: "This step is not assigned to you" },
        403,
      );
    }

    if (step.status !== "assigned") {
      return json(
        {
          success: false,
          error: `Step is in "${step.status}" status, not "assigned"`,
        },
        409,
      );
    }

    // Accept: move to "accepted" and set accepted_at
    await query(
      `UPDATE order_workflow_steps
       SET status = 'accepted', accepted_at = now()
       WHERE id = $1`,
      [stepId],
    );

    // Ensure workflow is in_progress
    if (step.workflow_id) {
      await query(
        `UPDATE order_workflows SET status = 'in_progress'
         WHERE id = $1 AND status = 'not_started'`,
        [step.workflow_id],
      );
    }

    // Send admin notification + write the audit row. Both are wrapped so
    // an audit/email failure can't roll back or surface to the vendor —
    // the step is already 'accepted' at this point.
    try {
      const adminEmail = "pm@cethoscorp.com";
      const adminPortalUrl =
        process.env.ADMIN_PORTAL_URL || "https://portal.cethos.com";

      // Fetch everything the admin needs to make sense of the acceptance
      // in one round-trip per relation. Step+order+service+vendor+language
      // join through their FKs; we resolve language uuids to display names
      // so the email reads "English → Hindi" instead of two opaque uuids.
      const vendorRows = await query<{ full_name: string; email: string }>(
        `SELECT full_name, email FROM vendors WHERE id = $1 LIMIT 1`,
        [vendor_id],
      );
      const vendor = vendorRows[0];

      const stepInfoRows = await query<{
        name: string;
        order_id: string;
        step_number: number;
        workflow_id: string | null;
        service_id: string | null;
        source_language: string | null;
        target_language: string | null;
        vendor_rate: string | number | null;
        vendor_rate_unit: string | null;
        vendor_total: string | number | null;
        vendor_currency: string | null;
        deadline: string | null;
      }>(
        `SELECT name, order_id, step_number, workflow_id, service_id,
                source_language, target_language,
                vendor_rate, vendor_rate_unit, vendor_total, vendor_currency,
                deadline
         FROM order_workflow_steps WHERE id = $1 LIMIT 1`,
        [stepId],
      );
      const stepInfo = stepInfoRows[0];

      // Parallel lookups for the things stepInfo only carries by FK.
      const [orderRow, serviceRow, langRows, totalStepsRow] = await Promise.all([
        stepInfo
          ? query<{ order_number: string }>(
              `SELECT order_number FROM orders WHERE id = $1 LIMIT 1`,
              [stepInfo.order_id],
            )
          : Promise.resolve([]),
        stepInfo?.service_id
          ? query<{ name: string }>(
              `SELECT name FROM services WHERE id = $1 LIMIT 1`,
              [stepInfo.service_id],
            )
          : Promise.resolve([]),
        stepInfo &&
        (stepInfo.source_language || stepInfo.target_language)
          ? query<{ id: string; name: string }>(
              `SELECT id, name FROM languages WHERE id = ANY($1::uuid[])`,
              [
                [stepInfo.source_language, stepInfo.target_language].filter(
                  Boolean,
                ),
              ],
            )
          : Promise.resolve([]),
        stepInfo?.workflow_id
          ? query<{ n: string }>(
              `SELECT COUNT(*)::text AS n FROM order_workflow_steps WHERE workflow_id = $1`,
              [stepInfo.workflow_id],
            )
          : Promise.resolve([]),
      ]);

      const order = orderRow[0];
      const service = serviceRow[0];
      const totalSteps = totalStepsRow[0]?.n ? Number(totalStepsRow[0].n) : null;

      const langMap = new Map<string, string>();
      for (const r of langRows) langMap.set(r.id, r.name);
      const srcName = stepInfo?.source_language
        ? langMap.get(stepInfo.source_language) ?? null
        : null;
      const tgtName = stepInfo?.target_language
        ? langMap.get(stepInfo.target_language) ?? null
        : null;
      const languagePair =
        srcName && tgtName ? `${srcName} → ${tgtName}` : srcName || tgtName;

      const fmtRateUnit = (u: string | null | undefined): string =>
        u === "per_word"
          ? "per word"
          : u === "per_page"
            ? "per page"
            : u === "per_hour"
              ? "per hour"
              : u === "flat"
                ? "flat"
                : u
                  ? u.replace(/_/g, " ")
                  : "unit";
      const fmtMoney = (
        amount: string | number | null | undefined,
        currency: string | null | undefined,
      ): string => {
        if (amount == null) return "—";
        const n = typeof amount === "string" ? parseFloat(amount) : amount;
        if (!Number.isFinite(n)) return "—";
        try {
          return new Intl.NumberFormat("en-CA", {
            style: "currency",
            currency: currency || "CAD",
          }).format(n);
        } catch {
          return `${n.toFixed(2)} ${currency ?? ""}`.trim();
        }
      };
      const fmtDate = (iso: string | null | undefined): string => {
        if (!iso) return "—";
        try {
          return new Date(iso).toLocaleString("en-CA", {
            timeZone: "America/Edmonton",
            dateStyle: "medium",
            timeStyle: "short",
          });
        } catch {
          return iso;
        }
      };
      const escapeHtml = (s: string | null | undefined): string =>
        String(s ?? "").replace(/[&<>"']/g, (c) =>
          c === "&"
            ? "&amp;"
            : c === "<"
              ? "&lt;"
              : c === ">"
                ? "&gt;"
                : c === '"'
                  ? "&quot;"
                  : "&#39;",
        );

      const stepPositionLabel =
        stepInfo && totalSteps
          ? `${stepInfo.step_number} of ${totalSteps}`
          : stepInfo
            ? `Step ${stepInfo.step_number}`
            : null;
      const stepRowValue =
        stepPositionLabel && stepInfo?.name
          ? `${stepPositionLabel} — ${stepInfo.name}`
          : stepInfo?.name ?? stepPositionLabel ?? "—";

      const rateUnitLabel = fmtRateUnit(stepInfo?.vendor_rate_unit);
      const rateText =
        stepInfo?.vendor_rate == null
          ? null
          : stepInfo?.vendor_rate_unit === "flat"
            ? `${fmtMoney(stepInfo.vendor_rate, stepInfo.vendor_currency)} (flat)`
            : `${fmtMoney(stepInfo.vendor_rate, stepInfo.vendor_currency)} /${rateUnitLabel}`;

      const subject = `Vendor accepted: ${order?.order_number ?? "Order"} — ${stepInfo?.name ?? "step"}${languagePair ? ` (${languagePair})` : ""}`;
      let logStatus: "sent" | "failed" | "skipped" = "skipped";
      let errorMessage: string | null = null;

      const BREVO_KEY = process.env.BREVO_API_KEY;
      if (BREVO_KEY && vendor && stepInfo) {
        const accent = "#0f766e";
        const detailRows: Array<[string, string]> = [
          ["Order", order?.order_number ?? "—"],
          ["Step", stepRowValue],
        ];
        if (languagePair) detailRows.push(["Languages", languagePair]);
        if (service?.name) detailRows.push(["Service", service.name]);
        if (rateText) {
          detailRows.push(["Rate", rateText]);
          detailRows.push([
            "Total",
            fmtMoney(stepInfo.vendor_total, stepInfo.vendor_currency),
          ]);
        }
        if (stepInfo.deadline)
          detailRows.push(["Deadline", fmtDate(stepInfo.deadline)]);

        const detailsHtml = detailRows
          .map(
            ([k, v]) =>
              `<tr>
                <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">${escapeHtml(k)}</td>
                <td style="padding:8px 0;color:#111827;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(v)}</td>
              </tr>`,
          )
          .join("");

        const htmlBody = `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:${accent};padding:28px 28px 22px;color:#ffffff;">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;opacity:0.85;">Cethos Translation Services</div>
          <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;line-height:1.3;">Vendor accepted assignment</h1>
          ${languagePair ? `<div style="margin-top:8px;font-size:14px;opacity:0.95;">${escapeHtml(languagePair)}</div>` : ""}
        </td></tr>
        <tr><td style="padding:24px 28px 8px;color:#111827;">
          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;">
            <strong>${escapeHtml(vendor.full_name)}</strong>
            (<a href="mailto:${escapeHtml(vendor.email)}" style="color:${accent};text-decoration:none;">${escapeHtml(vendor.email)}</a>)
            has accepted the direct assignment. The step is now in <strong>Accepted</strong> status.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 8px;" />
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsHtml}</table>
          <div style="margin:28px 0 8px;text-align:center;">
            <a href="${escapeHtml(adminPortalUrl)}/admin/orders/${escapeHtml(stepInfo.order_id)}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open order in admin portal</a>
          </div>
          <p style="margin:8px 0 0;color:#6b7280;font-size:12px;line-height:1.5;text-align:center;">No action required — the vendor will deliver before the deadline above.</p>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.55;text-align:center;">
          Automated notification from the Cethos portal.<br />
          Reply to this email or contact <a href="mailto:vendor@cethos.com" style="color:${accent};text-decoration:none;">vendor@cethos.com</a> for questions.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

        try {
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": BREVO_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: "Cethos Translation Services", email: "donotreply@cethos.com" },
              replyTo: { email: "vendor@cethos.com", name: "Cethos Vendor Ops" },
              to: [{ email: adminEmail }],
              subject,
              htmlContent: htmlBody,
              tags: ["vendor-direct-accept", `order-${order?.order_number ?? "unknown"}`],
            }),
          });
          if (res.ok) {
            logStatus = "sent";
          } else {
            logStatus = "failed";
            errorMessage = `Brevo ${res.status}`;
          }
        } catch (brevoErr: any) {
          logStatus = "failed";
          errorMessage = brevoErr?.message || String(brevoErr);
        }
      }

      // Audit row with all NOT NULL columns populated. recipient_type
      // is 'admin' because the email goes to pm@cethoscorp.com, not to
      // the vendor.
      try {
        await query(
          `INSERT INTO notification_log
             (event_type, recipient_type, recipient_email, recipient_id,
              step_id, order_id, subject, status, error_message, metadata, created_at)
           VALUES ('vendor_direct_accept', 'admin', $1, NULL,
              $2, $3, $4, $5, $6, $7, now())`,
          [
            adminEmail,
            stepId,
            stepInfo?.order_id ?? null,
            subject,
            logStatus,
            errorMessage,
            JSON.stringify({
              vendor_id,
              vendor_name: vendor?.full_name ?? null,
              vendor_email: vendor?.email ?? null,
              order_number: order?.order_number ?? null,
              language_pair: languagePair ?? null,
              accepted_at: new Date().toISOString(),
            }),
          ],
        );
      } catch (logErr: any) {
        console.error("notification_log insert failed (non-blocking):", logErr?.message || logErr);
      }
    } catch (notifyErr: any) {
      console.error("admin notification block failed (non-blocking):", notifyErr?.message || notifyErr);
    }

    return json({ success: true });
  } catch (e: any) {
    console.error("accept-direct-assign error:", e);
    return err(e.message || "Internal error", 500);
  }
};
