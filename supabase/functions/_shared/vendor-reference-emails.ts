// Vendor-flavour reference request emails. Mirrors V18/V19 from
// email-templates.ts but with wording for already-onboarded vendors
// (not applicants).

const BRAND = {
  teal: "#0891B2",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#F9FAFB",
  logoUrl:
    "https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/png_logo_cethos_light_bg.png",
};

const supportEmail = () => Deno.env.get("CVP_SUPPORT_EMAIL") ?? "vm@cethos.com";

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ShellArgs {
  preheader?: string;
  heading: string;
  body: string;
  cta?: { label: string; url: string };
}

function shell({ preheader, heading, body, cta }: ShellArgs): string {
  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>`
    : "";
  const ctaBlock = cta
    ? `<p style="margin:24px 0;"><a href="${esc(cta.url)}" style="display:inline-block;background:${BRAND.teal};color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600;font-size:14px;">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:${BRAND.bg};padding:24px 12px;">${preheaderBlock}
<div style="max-width:640px;margin:0 auto;background:#fff;padding:24px 28px 32px;border:1px solid ${BRAND.border};border-radius:8px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <div style="margin:0 0 20px;padding-bottom:16px;border-bottom:1px solid ${BRAND.border};">
    <img src="${BRAND.logoUrl}" alt="Cethos" width="120" height="auto" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:120px;">
  </div>
  <h1 style="color:${BRAND.teal};font-size:20px;margin:0 0 16px;">${esc(heading)}</h1>
  <div style="font-size:14px;line-height:1.55;">${body}</div>
  ${ctaBlock}
  <p style="color:${BRAND.muted};font-size:12px;margin-top:32px;border-top:1px solid ${BRAND.border};padding-top:16px;">Questions? Reply to this email or contact <a href="mailto:${esc(supportEmail())}" style="color:${BRAND.teal};">${esc(supportEmail())}</a>.</p>
</div></body></html>`;
}

function textify(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gs, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function render(subject: string, args: ShellArgs): { subject: string; html: string; text: string } {
  const html = shell(args);
  return { subject, html, text: textify(html) };
}

export interface VendorReferencesRequestParams {
  vendorFullName: string;
  staffMessage: string | null;
  contactsLinkUrl: string;
  expiryDays: number;
}
export function buildVendorReferencesRequest(p: VendorReferencesRequestParams) {
  const message = p.staffMessage
    ? `<p>${esc(p.staffMessage)}</p>`
    : `<p>We're refreshing our records and would like to add 2–3 current professional references to your Cethos vendor profile. Former clients, project managers, or colleagues who can speak to your recent translation work are ideal.</p>`;
  return render(`Please share your references — Cethos vendor profile`, {
    preheader: "Send us 2–3 contacts and we'll handle the rest.",
    heading: `Hi ${esc(p.vendorFullName.split(" ")[0])} — references, please`,
    body: `${message}
      <p>Click the button below to enter your references' contact details. We'll reach out to them directly with a short questionnaire — you don't need to coordinate anything.</p>
      <p style="color:${BRAND.muted};font-size:13px;">This link expires in ${p.expiryDays} days.</p>`,
    cta: { label: "Add my references", url: p.contactsLinkUrl },
  });
}

export interface VendorReferenceFeedbackRequestParams {
  referenceName: string;
  vendorFullName: string;
  feedbackLinkUrl: string;
  expiryDays: number;
}
export function buildVendorReferenceFeedbackRequest(p: VendorReferenceFeedbackRequestParams) {
  return render(`${p.vendorFullName} listed you as a reference`, {
    preheader: `A short questionnaire about ${p.vendorFullName.split(" ")[0]}'s translation work — under 5 minutes.`,
    heading: `${esc(p.vendorFullName)} listed you as a reference`,
    body: `
      <p>Hi ${esc(p.referenceName.split(" ")[0])},</p>
      <p><strong>${esc(p.vendorFullName)}</strong> works with Cethos as a professional translator and listed you as someone who can speak to their work.</p>
      <p>If you're willing, please answer a few short questions — under 5 minutes — by clicking the link below. Your responses go directly to our vendor-management team and aren't shared with ${esc(p.vendorFullName.split(" ")[0])}.</p>
      <p>If you don't recognise this person or would prefer not to respond, you can decline on the same page — no follow-up.</p>
      <p style="color:${BRAND.muted};font-size:13px;">This link expires in ${p.expiryDays} days.</p>`,
    cta: { label: "Respond now", url: p.feedbackLinkUrl },
  });
}
