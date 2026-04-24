/**
 * Inline HTML templates for all CVP transactional email (V1–V17).
 *
 * Each builder returns { subject, html, text } for sendMailgunEmail.
 * Copy changes land here, in PRs, reviewed like code.
 * For operational/ad-hoc emails (daily status digest, OTPs, vendor invites)
 * see the individual edge functions — those render their own HTML.
 */

const BRAND = {
  teal: "#0891B2",
  navy: "#0C2340",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#F9FAFB",
};

function supportEmail(): string {
  return Deno.env.get("CVP_SUPPORT_EMAIL") ?? "vm@cethos.com";
}

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
  footer?: string;
}

function shell({ preheader, heading, body, cta, footer }: ShellArgs): string {
  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>`
    : "";
  const ctaBlock = cta
    ? `<p style="margin:24px 0;">
         <a href="${esc(cta.url)}" style="display:inline-block;background:${BRAND.teal};color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600;font-size:14px;">${esc(cta.label)}</a>
       </p>`
    : "";
  const footerBlock = footer
    ? `<p style="color:${BRAND.muted};font-size:12px;margin-top:32px;border-top:1px solid ${BRAND.border};padding-top:16px;">${footer}</p>`
    : `<p style="color:${BRAND.muted};font-size:12px;margin-top:32px;border-top:1px solid ${BRAND.border};padding-top:16px;">Questions? Reply to this email or contact <a href="mailto:${esc(supportEmail())}" style="color:${BRAND.teal};">${esc(supportEmail())}</a>.</p>`;
  return `
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:${BRAND.bg};padding:24px 12px;">
${preheaderBlock}
<div style="max-width:640px;margin:0 auto;background:#fff;padding:32px 28px;border:1px solid ${BRAND.border};border-radius:8px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <h1 style="color:${BRAND.teal};font-size:20px;margin:0 0 16px;">${esc(heading)}</h1>
  <div style="font-size:14px;line-height:1.55;">${body}</div>
  ${ctaBlock}
  ${footerBlock}
</div>
</body></html>`;
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

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function render(subject: string, args: ShellArgs): RenderedEmail {
  const html = shell(args);
  return { subject, html, text: textify(html) };
}

// ---- V1: Application received ----
export interface V1Params {
  fullName: string;
  applicationNumber: string;
}
export function buildV1ApplicationReceived(p: V1Params): RenderedEmail {
  return render(`We received your application · ${p.applicationNumber}`, {
    preheader: "Thanks for applying to CETHOS — here's what happens next.",
    heading: `Thanks for applying, ${esc(p.fullName.split(" ")[0])}!`,
    body: `
      <p>We've received your application <strong>${esc(p.applicationNumber)}</strong>.</p>
      <p>Our AI pre-screen runs in the next few minutes. You'll hear from us again with either a test invitation or a status update within 1–2 business days.</p>
    `,
  });
}

// ---- V2: Prescreen passed ----
export interface V2Params {
  fullName: string;
  applicationNumber: string;
  roleType: string;
}
export function buildV2PrescreenPassed(p: V2Params): RenderedEmail {
  return render(`Your application moved forward · ${p.applicationNumber}`, {
    preheader: "You've cleared pre-screen. A test invitation is on its way.",
    heading: "You've cleared pre-screen",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>Good news — application <strong>${esc(p.applicationNumber)}</strong> (${esc(p.roleType)}) has cleared our AI pre-screen.</p>
      <p>You'll receive a separate email shortly with a test invitation. Each test link is valid for 48 hours.</p>
    `,
  });
}

// ---- V3: Test invitation ----
export interface V3Params {
  fullName: string;
  applicationNumber: string;
  testCount: number;
  testLinksHtml: string; // pre-rendered <ul>…</ul> of test links
  expiryHours: number;
}
export function buildV3TestInvitation(p: V3Params): RenderedEmail {
  return render(`Your CETHOS test${p.testCount > 1 ? "s are" : " is"} ready · ${p.applicationNumber}`, {
    preheader: `Open within ${p.expiryHours} hours.`,
    heading: `Your test${p.testCount > 1 ? "s" : ""} ${p.testCount > 1 ? "are" : "is"} ready`,
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>You have <strong>${p.testCount}</strong> test${p.testCount > 1 ? "s" : ""} to complete for application <strong>${esc(p.applicationNumber)}</strong>.</p>
      <p>${p.testLinksHtml}</p>
      <p><strong>Each link expires in ${p.expiryHours} hours.</strong> One submission per link. If you miss the window, reply and we'll issue a new one.</p>
    `,
  });
}

// ---- V4: Test reminder 24h ----
export interface V4Params {
  fullName: string;
  applicationNumber: string;
  testLink: string;
  hoursRemaining: number;
}
export function buildV4TestReminder24hr(p: V4Params): RenderedEmail {
  return render(`Reminder: your CETHOS test expires in ${p.hoursRemaining}h`, {
    preheader: "Your test link hasn't been submitted yet.",
    heading: "Your test link is about to expire",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>We noticed you haven't submitted your test yet for <strong>${esc(p.applicationNumber)}</strong>. The link expires in about <strong>${p.hoursRemaining} hours</strong>.</p>
    `,
    cta: { label: "Open test", url: p.testLink },
    footer: `If you're no longer interested, you can ignore this email.`,
  });
}

// ---- V5: Test expired ----
export interface V5Params {
  fullName: string;
  applicationNumber: string;
}
export function buildV5TestExpired(p: V5Params): RenderedEmail {
  return render(`Your test link expired · ${p.applicationNumber}`, {
    preheader: "Reply to this email and we can issue a new one.",
    heading: "Your test link has expired",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>Your test link for <strong>${esc(p.applicationNumber)}</strong> has expired.</p>
      <p>If you'd still like to complete the test, reply to this email and we'll send a fresh link.</p>
    `,
  });
}

// ---- V6: Final chance day 7 ----
export interface V6Params {
  fullName: string;
  applicationNumber: string;
}
export function buildV6FinalChanceDay7(p: V6Params): RenderedEmail {
  return render(`Final check-in on application ${p.applicationNumber}`, {
    preheader: "One more chance to complete your CETHOS test.",
    heading: "Last chance to complete your test",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>It's been a week since we sent your test link for <strong>${esc(p.applicationNumber)}</strong> and we haven't received a submission.</p>
      <p>If you'd still like to continue, reply to this email within 3 days. Otherwise we'll archive the application.</p>
    `,
  });
}

// ---- V7: Test received ----
export interface V7Params {
  fullName: string;
  applicationNumber: string;
}
export function buildV7TestReceived(p: V7Params): RenderedEmail {
  return render(`We received your test · ${p.applicationNumber}`, {
    preheader: "Your submission is in review.",
    heading: "Test received — thanks",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>We've received your test submission for <strong>${esc(p.applicationNumber)}</strong>. Our AI assessment runs in the next few minutes, then a human reviewer takes a look.</p>
      <p>Expect to hear back within 2–3 business days.</p>
    `,
  });
}

// ---- V8: Under manual review ----
export interface V8Params {
  fullName: string;
  applicationNumber: string;
  roleType: string;
}
export function buildV8UnderManualReview(p: V8Params): RenderedEmail {
  return render(`Your application is under manual review · ${p.applicationNumber}`, {
    preheader: "A human reviewer is taking a closer look.",
    heading: "Under manual review",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>Your ${esc(p.roleType)} application <strong>${esc(p.applicationNumber)}</strong> is being reviewed by one of our team members rather than our automated process. This usually means we want to weigh something carefully.</p>
      <p>We'll be in touch within 3–5 business days.</p>
    `,
  });
}

// ---- V9: Negotiation offer ----
export interface V9Params {
  fullName: string;
  applicationNumber: string;
  offeredRate: string;
  currency: string;
  negotiateLink: string;
  offerExpiresAt: string;
}
export function buildV9NegotiationOffer(p: V9Params): RenderedEmail {
  return render(`Rate offer for application ${p.applicationNumber}`, {
    preheader: `Our offer: ${p.offeredRate} ${p.currency}.`,
    heading: "Our rate offer",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>Based on your test and experience, we'd like to offer a starting rate of <strong>${esc(p.offeredRate)} ${esc(p.currency)}</strong> for <strong>${esc(p.applicationNumber)}</strong>.</p>
      <p>You can accept or submit one counter-offer at the link below. This offer expires <strong>${esc(p.offerExpiresAt)}</strong>.</p>
    `,
    cta: { label: "Review & respond", url: p.negotiateLink },
  });
}

// ---- V10: Rate agreed ----
export interface V10Params {
  fullName: string;
  applicationNumber: string;
  agreedRate: string;
  currency: string;
}
export function buildV10RateAgreed(p: V10Params): RenderedEmail {
  return render(`Rate agreed · ${p.applicationNumber}`, {
    preheader: "We're moving to the final approval step.",
    heading: "Rate agreed",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>We've agreed on a rate of <strong>${esc(p.agreedRate)} ${esc(p.currency)}</strong> for <strong>${esc(p.applicationNumber)}</strong>.</p>
      <p>You'll receive a welcome email with your vendor portal access shortly.</p>
    `,
  });
}

// Optional AI-generated personal note from staff. Appended to V11/V13 bodies
// when the staff member added context in the decision modal.
function staffMessageBlock(message?: string | null): string {
  if (!message || message.trim().length === 0) return "";
  return `<blockquote style="border-left:3px solid ${BRAND.teal};padding-left:12px;color:${BRAND.muted};margin:16px 0;">${message
    .split(/\n\n+/)
    .map((p) => `<p style="margin:6px 0;">${esc(p)}</p>`)
    .join("")}</blockquote>`;
}

// ---- V11: Approved / welcome ----
export interface V11Params {
  fullName: string;
  applicationNumber: string;
  vendorPortalUrl: string;
  passwordSetupLink: string;
  passwordSetupExpiryHours: number;
  approvedCombinationsList: string; // pre-rendered <ul>…</ul>
  staffMessage?: string | null;     // optional AI-rephrased staff note
}
export function buildV11ApprovedWelcome(p: V11Params): RenderedEmail {
  return render(`Welcome to CETHOS · ${p.applicationNumber}`, {
    preheader: "Your application is approved. Set up your password to get started.",
    heading: `Welcome to CETHOS, ${esc(p.fullName.split(" ")[0])}!`,
    body: `
      <p>Great news — your application <strong>${esc(p.applicationNumber)}</strong> is approved.</p>
      <p><strong>Approved for:</strong></p>
      ${p.approvedCombinationsList}
      ${staffMessageBlock(p.staffMessage)}
      <p>Set your password to activate your vendor portal access. The link expires in <strong>${p.passwordSetupExpiryHours} hours</strong>.</p>
    `,
    cta: { label: "Set up your password", url: p.passwordSetupLink },
    footer: `Your vendor portal: <a href="${esc(p.vendorPortalUrl)}" style="color:${BRAND.teal};">${esc(p.vendorPortalUrl)}</a>. Questions? <a href="mailto:${esc(supportEmail())}" style="color:${BRAND.teal};">${esc(supportEmail())}</a>.`,
  });
}

// ---- V12: Rejected ----
// `reasonSummary` is the AI-rephrased applicant-facing reason produced from
// the staff's raw notes. Never pass raw internal staff notes here.
export interface V12Params {
  fullName: string;
  applicationNumber: string;
  reasonSummary: string;
  reapplyAfterDate: string;
}
export function buildV12Rejected(p: V12Params): RenderedEmail {
  return render(`Update on application ${p.applicationNumber}`, {
    preheader: "Decision on your CETHOS application.",
    heading: "Update on your application",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>Thanks for applying to CETHOS. After reviewing <strong>${esc(p.applicationNumber)}</strong>, we're not moving forward at this time.</p>
      <p><em>${esc(p.reasonSummary)}</em></p>
      <p>You're welcome to reapply after <strong>${esc(p.reapplyAfterDate)}</strong>. We wish you the best.</p>
    `,
  });
}

// ---- V13: Waitlisted ----
export interface V13Params {
  fullName: string;
  applicationNumber: string;
  waitlistPair: string;
  staffMessage?: string | null;     // optional AI-rephrased staff note
}
export function buildV13Waitlisted(p: V13Params): RenderedEmail {
  return render(`You've been waitlisted · ${p.applicationNumber}`, {
    preheader: "We'll be in touch when demand opens up for your language pair.",
    heading: "You're on our waitlist",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>Your application <strong>${esc(p.applicationNumber)}</strong> is a strong fit, but we don't currently have regular work for the <strong>${esc(p.waitlistPair)}</strong> pair.</p>
      ${staffMessageBlock(p.staffMessage)}
      <p>We'll email you directly when demand opens up.</p>
    `,
  });
}

// ---- V14: Profile nudge ----
export interface V14Params {
  fullName: string;
  nudgeType: string;
  actionLabel: string;
  actionLink: string;
  message: string;
}
export function buildV14ProfileNudge(p: V14Params): RenderedEmail {
  return render(`Action needed on your CETHOS vendor profile`, {
    preheader: esc(p.message),
    heading: "A quick thing to update",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>${esc(p.message)}</p>
    `,
    cta: { label: p.actionLabel, url: p.actionLink },
  });
}

// ---- V15: Certification expiry ----
export interface V15Params {
  fullName: string;
  certName: string;
  expiryDate: string;
  profileLink: string;
}
export function buildV15CertExpiry(p: V15Params): RenderedEmail {
  return render(`Certification expiring: ${p.certName}`, {
    preheader: `Expires ${p.expiryDate}.`,
    heading: "Certification expiry reminder",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>Your certification <strong>${esc(p.certName)}</strong> is set to expire on <strong>${esc(p.expiryDate)}</strong>. Please upload an updated copy to keep receiving matching jobs.</p>
    `,
    cta: { label: "Update certifications", url: p.profileLink },
  });
}

// ---- V16: Language pairs check ----
export interface V16Params {
  fullName: string;
  profileLink: string;
}
export function buildV16LanguagePairsCheck(p: V16Params): RenderedEmail {
  return render(`Is your language pair list still accurate?`, {
    preheader: "Quick check-in on your working pairs.",
    heading: "Quick check on your language pairs",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>It's been a while since you updated your language-pair list. Take 30 seconds to confirm it's still accurate so we match you to the right jobs.</p>
    `,
    cta: { label: "Review my pairs", url: p.profileLink },
  });
}

// ---- V17: Request more info ----
export interface V17Params {
  fullName: string;
  applicationNumber: string;
  requestDetails: string;
  infoDeadlineDate: string;
}
export function buildV17RequestMoreInfo(p: V17Params): RenderedEmail {
  return render(`We need a bit more info · ${p.applicationNumber}`, {
    preheader: `Reply by ${p.infoDeadlineDate}.`,
    heading: "A quick follow-up",
    body: `
      <p>Hi ${esc(p.fullName)},</p>
      <p>Before we can move application <strong>${esc(p.applicationNumber)}</strong> forward, we need some additional information:</p>
      <blockquote style="border-left:3px solid ${BRAND.teal};padding-left:12px;color:${BRAND.muted};">${esc(p.requestDetails)}</blockquote>
      <p>Please reply to this email by <strong>${esc(p.infoDeadlineDate)}</strong>.</p>
    `,
  });
}
