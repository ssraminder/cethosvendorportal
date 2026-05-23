/**
 * Branded "Job Assigned" email — sent to vendor when they accept a step
 * (or when a PM assigns them directly). Follows the same BRAND + shell()
 * pattern as the recruitment pipeline emails.
 */

const BRAND = {
  teal: "#0891B2",
  navy: "#0C2340",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#F9FAFB",
  logoUrl:
    "https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/final_logo_light_bg_cethosAsset%201.svg",
};

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface JobAssignedEmailParams {
  vendor_name: string;
  order_number: string;
  step_name: string;
  source_language: string;
  target_language: string;
  service_name: string | null;
  word_count: number;
  page_count: number;
  deadline: string | null;
  vendor_rate: number | null;
  vendor_rate_unit: string | null;
  vendor_total: number | null;
  vendor_currency: string | null;
  instructions: string | null;
  portal_url: string;
  file_count: number;
}

function formatRate(
  rate: number | null,
  unit: string | null,
  total: number | null,
  currency: string | null,
): string {
  const cur = currency ?? "CAD";
  const parts: string[] = [];
  if (rate != null && unit) {
    const r = typeof rate === "string" ? parseFloat(rate) : rate;
    const unitLabel = unit === "per_word" ? "/ word" : unit === "per_page" ? "/ page" : `/ ${unit.replace("per_", "")}`;
    parts.push(`${cur} $${r.toFixed(4)} ${unitLabel}`);
  }
  if (total != null) {
    const t = typeof total === "string" ? parseFloat(total) : total;
    parts.push(`Total: ${cur} $${t.toFixed(2)}`);
  }
  return parts.length > 0 ? parts.join(" &middot; ") : "See portal for details";
}

function formatDeadline(raw: string | null): string {
  if (!raw) return "No deadline set";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  });
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 16px 6px 0;color:${BRAND.muted};font-size:13px;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 0;font-size:14px;font-weight:500;">${value}</td>
  </tr>`;
}

export function renderJobAssignedEmail(p: JobAssignedEmailParams): {
  subject: string;
  html: string;
} {
  const langPair = `${esc(p.source_language)} → ${esc(p.target_language)}`;
  const subject = `Job assigned — ${p.source_language} → ${p.target_language} · ${p.order_number}`;

  const volumeParts: string[] = [];
  if (p.word_count > 0) volumeParts.push(`${p.word_count.toLocaleString("en-CA")} words`);
  if (p.page_count > 0) volumeParts.push(`${p.page_count} pages`);
  if (p.file_count > 0) volumeParts.push(`${p.file_count} file${p.file_count > 1 ? "s" : ""}`);
  const volumeText = volumeParts.length > 0 ? volumeParts.join(" &middot; ") : "—";

  const instructionsBlock = p.instructions
    ? `<div style="margin:20px 0;padding:14px 16px;background:#F0FDFA;border:1px solid #99F6E4;border-radius:6px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${BRAND.teal};text-transform:uppercase;letter-spacing:0.5px;">Instructions</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:${BRAND.text};white-space:pre-wrap;">${esc(p.instructions)}</p>
       </div>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:${BRAND.bg};padding:24px 12px;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">New job assigned: ${esc(p.order_number)} · ${langPair}</div>
<div style="max-width:640px;margin:0 auto;background:#fff;padding:24px 28px 32px;border:1px solid ${BRAND.border};border-radius:8px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <div style="margin:0 0 20px;padding-bottom:16px;border-bottom:1px solid ${BRAND.border};">
    <img src="${BRAND.logoUrl}" alt="Cethos" width="120" height="auto" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:120px;">
  </div>

  <h1 style="color:${BRAND.teal};font-size:20px;margin:0 0 8px;">Job Assigned</h1>
  <p style="font-size:14px;line-height:1.55;margin:0 0 20px;">Hi ${esc(p.vendor_name)}, a job has been assigned to you. Please review the details below and begin working at your earliest convenience.</p>

  <table style="border-collapse:collapse;width:100%;margin:0 0 4px;">
    ${detailRow("Order", esc(p.order_number))}
    ${detailRow("Task", esc(p.step_name))}
    ${detailRow("Language pair", langPair)}
    ${p.service_name ? detailRow("Service", esc(p.service_name)) : ""}
    ${detailRow("Volume", volumeText)}
    ${detailRow("Rate", formatRate(p.vendor_rate, p.vendor_rate_unit, p.vendor_total, p.vendor_currency))}
    ${detailRow("Deadline", `<span style="color:${BRAND.navy};font-weight:600;">${esc(formatDeadline(p.deadline))}</span>`)}
  </table>

  ${instructionsBlock}

  <p style="margin:24px 0 0;">
    <a href="${esc(p.portal_url)}/jobs" style="display:inline-block;background:${BRAND.teal};color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">View Job Details</a>
  </p>

  <p style="color:${BRAND.muted};font-size:12px;margin-top:32px;border-top:1px solid ${BRAND.border};padding-top:16px;">
    Questions? Reply to this email or contact <a href="mailto:vm@cethos.com" style="color:${BRAND.teal};">vm@cethos.com</a>.
  </p>
</div>
</body></html>`;

  return { subject, html };
}
