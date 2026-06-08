/**
 * Notify Cethos staff when a vendor accepts a step.
 *
 * Recipients: the step's assigned_staff_id (the PM who set up the
 * assignment) plus the shared pm@cethoscorp.com inbox. When assigned_staff_id
 * is null we still ship to the shared inbox so nothing is silently dropped.
 *
 * One Brevo email per recipient (clean inbox filtering) and one
 * notification_log audit row per recipient. The whole block is best-effort —
 * the caller has already committed the acceptance to the database, so any
 * failure here is logged and swallowed.
 */

import { query } from "./db";

type AcceptKind = "offer" | "direct";

const SHARED_PM_EMAIL = "pm@cethoscorp.com";

interface NotifyArgs {
  stepId: string;
  vendorId: string;
  kind: AcceptKind;
  offerId?: string | null;
}

interface StepRow {
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
  assigned_staff_id: string | null;
}

interface Recipient {
  email: string;
  name: string | null;
  staff_id: string | null;
}

export async function notifyStaffOfStepAccept(args: NotifyArgs): Promise<void> {
  const { stepId, vendorId, kind, offerId = null } = args;
  const eventType = kind === "direct" ? "vendor_direct_accept" : "vendor_accepted";
  const adminPortalUrl = process.env.ADMIN_PORTAL_URL || "https://portal.cethos.com";

  try {
    const [vendorRows, stepRows] = await Promise.all([
      query<{ full_name: string; email: string }>(
        `SELECT full_name, email FROM vendors WHERE id = $1 LIMIT 1`,
        [vendorId],
      ),
      query<StepRow>(
        `SELECT name, order_id, step_number, workflow_id, service_id,
                source_language, target_language,
                vendor_rate, vendor_rate_unit, vendor_total, vendor_currency,
                deadline, assigned_staff_id
         FROM order_workflow_steps WHERE id = $1 LIMIT 1`,
        [stepId],
      ),
    ]);
    const vendor = vendorRows[0];
    const step = stepRows[0];
    if (!step) return;

    const [orderRow, serviceRow, langRows, totalStepsRow, staffRow] = await Promise.all([
      query<{ order_number: string }>(
        `SELECT order_number FROM orders WHERE id = $1 LIMIT 1`,
        [step.order_id],
      ),
      step.service_id
        ? query<{ name: string }>(
            `SELECT name FROM services WHERE id = $1 LIMIT 1`,
            [step.service_id],
          )
        : Promise.resolve([] as Array<{ name: string }>),
      step.source_language || step.target_language
        ? query<{ id: string; name: string }>(
            `SELECT id, name FROM languages WHERE id = ANY($1::uuid[])`,
            [[step.source_language, step.target_language].filter(Boolean)],
          )
        : Promise.resolve([] as Array<{ id: string; name: string }>),
      step.workflow_id
        ? query<{ n: string }>(
            `SELECT COUNT(*)::text AS n FROM order_workflow_steps WHERE workflow_id = $1`,
            [step.workflow_id],
          )
        : Promise.resolve([] as Array<{ n: string }>),
      step.assigned_staff_id
        ? query<{ email: string; full_name: string }>(
            `SELECT email, full_name FROM staff_users
             WHERE id = $1 AND is_active = true LIMIT 1`,
            [step.assigned_staff_id],
          )
        : Promise.resolve([] as Array<{ email: string; full_name: string }>),
    ]);

    const order = orderRow[0];
    const service = serviceRow[0];
    const totalSteps = totalStepsRow[0]?.n ? Number(totalStepsRow[0].n) : null;
    const staff = staffRow[0];

    const recipients: Recipient[] = [];
    const seen = new Set<string>();
    const addRecipient = (
      email: string | null | undefined,
      name: string | null,
      staff_id: string | null,
    ) => {
      if (!email) return;
      const normalized = email.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      recipients.push({ email: normalized, name, staff_id });
    };
    addRecipient(staff?.email, staff?.full_name ?? null, step.assigned_staff_id);
    addRecipient(SHARED_PM_EMAIL, "Cethos PM", null);
    if (recipients.length === 0) return;

    const langMap = new Map<string, string>();
    for (const r of langRows) langMap.set(r.id, r.name);
    const srcName = step.source_language ? langMap.get(step.source_language) ?? null : null;
    const tgtName = step.target_language ? langMap.get(step.target_language) ?? null : null;
    const languagePair = srcName && tgtName ? `${srcName} → ${tgtName}` : srcName || tgtName;

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

    const stepPositionLabel = totalSteps
      ? `${step.step_number} of ${totalSteps}`
      : `Step ${step.step_number}`;
    const stepRowValue = step.name ? `${stepPositionLabel} — ${step.name}` : stepPositionLabel;

    const rateUnitLabel = fmtRateUnit(step.vendor_rate_unit);
    const rateText =
      step.vendor_rate == null
        ? null
        : step.vendor_rate_unit === "flat"
          ? `${fmtMoney(step.vendor_rate, step.vendor_currency)} (flat)`
          : `${fmtMoney(step.vendor_rate, step.vendor_currency)} /${rateUnitLabel}`;

    const acceptPhrase = kind === "direct" ? "direct assignment" : "job offer";
    const subject = `Vendor accepted: ${order?.order_number ?? "Order"} — ${step.name ?? "step"}${languagePair ? ` (${languagePair})` : ""}`;
    const accent = "#0f766e";
    const detailRows: Array<[string, string]> = [
      ["Order", order?.order_number ?? "—"],
      ["Step", stepRowValue],
    ];
    if (languagePair) detailRows.push(["Languages", languagePair]);
    if (service?.name) detailRows.push(["Service", service.name]);
    if (rateText) {
      detailRows.push(["Rate", rateText]);
      detailRows.push(["Total", fmtMoney(step.vendor_total, step.vendor_currency)]);
    }
    if (step.deadline) detailRows.push(["Deadline", fmtDate(step.deadline)]);
    if (staff?.full_name) detailRows.push(["Assigned by", staff.full_name]);

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
            <strong>${escapeHtml(vendor?.full_name ?? "")}</strong>
            ${vendor?.email ? `(<a href="mailto:${escapeHtml(vendor.email)}" style="color:${accent};text-decoration:none;">${escapeHtml(vendor.email)}</a>)` : ""}
            has accepted the ${acceptPhrase}. The step is now in <strong>Accepted</strong> status.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 8px;" />
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsHtml}</table>
          <div style="margin:28px 0 8px;text-align:center;">
            <a href="${escapeHtml(adminPortalUrl)}/admin/orders/${escapeHtml(step.order_id)}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open order in admin portal</a>
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

    const BREVO_KEY = process.env.BREVO_API_KEY;
    const acceptedAt = new Date().toISOString();
    const tag = kind === "direct" ? "vendor-direct-accept" : "vendor-offer-accept";

    for (const r of recipients) {
      let logStatus: "sent" | "failed" | "skipped" = "skipped";
      let errorMessage: string | null = null;

      if (BREVO_KEY) {
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
              to: [r.name ? { email: r.email, name: r.name } : { email: r.email }],
              subject,
              htmlContent: htmlBody,
              tags: [tag, `order-${order?.order_number ?? "unknown"}`],
            }),
          });
          if (res.ok) {
            logStatus = "sent";
          } else {
            logStatus = "failed";
            errorMessage = `Brevo ${res.status}`;
          }
        } catch (brevoErr: unknown) {
          logStatus = "failed";
          errorMessage = brevoErr instanceof Error ? brevoErr.message : String(brevoErr);
        }
      }

      try {
        await query(
          `INSERT INTO notification_log
             (event_type, recipient_type, recipient_email, recipient_name, recipient_id,
              step_id, order_id, offer_id, subject, status, error_message, metadata, created_at)
           VALUES ($1, 'admin', $2, $3, $4,
              $5, $6, $7, $8, $9, $10, $11, now())`,
          [
            eventType,
            r.email,
            r.name,
            r.staff_id,
            stepId,
            step.order_id,
            offerId,
            subject,
            logStatus,
            errorMessage,
            JSON.stringify({
              kind,
              vendor_id: vendorId,
              vendor_name: vendor?.full_name ?? null,
              vendor_email: vendor?.email ?? null,
              order_number: order?.order_number ?? null,
              language_pair: languagePair ?? null,
              accepted_at: acceptedAt,
              assigned_staff_id: step.assigned_staff_id,
              assigned_staff_name: staff?.full_name ?? null,
            }),
          ],
        );
      } catch (logErr: unknown) {
        console.error(
          "notification_log insert failed (non-blocking):",
          logErr instanceof Error ? logErr.message : logErr,
        );
      }
    }
  } catch (notifyErr: unknown) {
    console.error(
      "notifyStaffOfStepAccept failed (non-blocking):",
      notifyErr instanceof Error ? notifyErr.message : notifyErr,
    );
  }
}
