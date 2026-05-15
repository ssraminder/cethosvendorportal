// ============================================================================
// notify-step-lifecycle.ts (vendor repo)
// Shared Brevo helpers for the vendor-portal-fired emails that go TO the admin:
//   - notifyAdminVendorAccepted  → vendor-accept-step
//   - notifyAdminVendorDeclined  → vendor-decline-step
//   - notifyAdminVendorDelivered → vendor-deliver-step
//
// Same pattern as notify-counter.ts: pulls admin recipients from
// notification_recipients (notification_type='all' or event-specific),
// writes notification_log audit rows for each send.
// ============================================================================

const ADMIN_PORTAL_URL =
  Deno.env.get("ADMIN_PORTAL_URL") || "https://portal.cethos.com";

const escapeHtml = (s: string | null | undefined): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });

const fmtMoney = (amount: number | null | undefined, currency: string | null | undefined): string => {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
};

interface SendArgs {
  supabase: any;
  eventType: string;
  recipientEmail: string;
  recipientName?: string | null;
  recipientId?: string | null;
  ccEmails?: string[];
  subject: string;
  htmlContent: string;
  metadata?: Record<string, unknown>;
  orderId?: string | null;
  stepId?: string | null;
  offerId?: string | null;
}

async function sendOne(args: SendArgs): Promise<void> {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) {
    console.warn("notify-step-lifecycle: BREVO_API_KEY not set, skipping send");
    return;
  }
  const payload: Record<string, unknown> = {
    to: [{ email: args.recipientEmail, name: args.recipientName || args.recipientEmail }],
    sender: { name: "Cethos Translation Services", email: "donotreply@cethos.com" },
    replyTo: { email: "vendor@cethos.com", name: "Cethos Vendor Ops" },
    subject: args.subject,
    htmlContent: args.htmlContent,
    tags: [args.eventType],
  };
  if (args.ccEmails && args.ccEmails.length > 0) {
    payload.cc = args.ccEmails.map((e) => ({ email: e }));
  }
  let status: "sent" | "failed" = "sent";
  let errorMsg: string | null = null;
  let brevoMessageId: string | null = null;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      status = "failed";
      errorMsg = `Brevo ${res.status}: ${JSON.stringify(result).slice(0, 500)}`;
      console.error("notify-step-lifecycle Brevo error:", errorMsg);
    } else {
      brevoMessageId = result?.messageId ?? null;
    }
  } catch (err: any) {
    status = "failed";
    errorMsg = err?.message || String(err);
    console.error("notify-step-lifecycle threw:", errorMsg);
  }
  try {
    await args.supabase.from("notification_log").insert({
      event_type: args.eventType,
      recipient_type: "admin",
      recipient_email: args.recipientEmail,
      recipient_name: args.recipientName ?? null,
      recipient_id: args.recipientId ?? null,
      order_id: args.orderId ?? null,
      step_id: args.stepId ?? null,
      offer_id: args.offerId ?? null,
      subject: args.subject,
      status,
      error_message: errorMsg,
      metadata: {
        ...(args.metadata ?? {}),
        brevo_message_id: brevoMessageId,
        cc: args.ccEmails ?? [],
      },
    });
  } catch (e: any) {
    console.error("notify-step-lifecycle notification_log insert failed:", e?.message || e);
  }
}

async function getAdminRecipients(
  supabase: any,
  eventTypes: string[],
): Promise<Array<{ email: string; name: string | null }>> {
  const { data } = await supabase
    .from("notification_recipients")
    .select("email, name, notification_type, is_active")
    .eq("is_active", true)
    .in("notification_type", ["all", ...eventTypes]);
  return (data ?? []).map((r: any) => ({ email: r.email, name: r.name }));
}

function emailShell(title: string, lead: string, detailsHtml: string, noteHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `
<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:20px 24px;background:#0f766e;color:#ffffff;">
          <div style="font-size:18px;font-weight:600;">Cethos Translation Services</div>
          <div style="font-size:13px;opacity:0.85;margin-top:2px;">${escapeHtml(title)}</div>
        </td></tr>
        <tr><td style="padding:24px;color:#111827;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">${lead}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">${detailsHtml}</table>
          ${noteHtml}
          <p style="margin:24px 0 0;text-align:center;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:10px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">${escapeHtml(ctaLabel)}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
          Internal notification — replies go to vendor@cethos.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

function rows(items: Array<[string, string]>): string {
  return items
    .map(([k, v]) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111827;font-size:14px;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
}

function noteBlock(label: string, body: string): string {
  if (!body) return "";
  return `<div style="margin-top:16px;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;color:#374151;font-size:13px;line-height:1.5;white-space:pre-wrap;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(body)}</div>`;
}

export interface VendorActionContext {
  supabase: any;
  vendor: { id: string; full_name: string | null; email: string };
  order: { id: string; order_number: string };
  step: { id: string; name: string | null; step_number?: number | null };
  offer?: {
    id: string;
    rate?: number | null;
    total?: number | null;
    currency?: string | null;
  } | null;
  note?: string | null;
}

// ──────────────────────────────────────────────────────────────────────────
// 1. notifyAdminVendorAccepted — vendor accepted the offer.
// Tells admin the step is now assigned and work can proceed.
// ──────────────────────────────────────────────────────────────────────────
export async function notifyAdminVendorAccepted(ctx: VendorActionContext): Promise<void> {
  const admins = await getAdminRecipients(ctx.supabase, ["vendor_offers"]);
  if (admins.length === 0) return;
  const subject = `Vendor accepted: ${ctx.order.order_number} — ${ctx.step.name || "step"}`;
  const lead = `<strong>${escapeHtml(ctx.vendor.full_name || ctx.vendor.email)}</strong> accepted the offer. The step is now assigned to them and ready for work.`;
  const items: Array<[string, string]> = [
    ["Order", ctx.order.order_number],
    ["Step", ctx.step.name || "—"],
    ["Vendor", ctx.vendor.full_name || ctx.vendor.email],
  ];
  if (ctx.offer?.total != null) items.push(["Total", fmtMoney(ctx.offer.total, ctx.offer.currency)]);
  const html = emailShell(
    "Vendor accepted assignment",
    lead,
    rows(items),
    "",
    "Open in admin portal",
    `${ADMIN_PORTAL_URL}/admin/orders/${ctx.order.id}`,
  );
  await Promise.all(
    admins.map((a) =>
      sendOne({
        supabase: ctx.supabase,
        eventType: "vendor_accepted",
        recipientEmail: a.email,
        recipientName: a.name,
        ccEmails: [],
        subject,
        htmlContent: html,
        orderId: ctx.order.id,
        stepId: ctx.step.id,
        offerId: ctx.offer?.id ?? null,
      }),
    ),
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2. notifyAdminVendorDeclined — vendor declined the offer.
// Tells admin the step needs reassignment. Reason (if given) included.
// ──────────────────────────────────────────────────────────────────────────
export async function notifyAdminVendorDeclined(
  ctx: VendorActionContext & { reason?: string | null },
): Promise<void> {
  const admins = await getAdminRecipients(ctx.supabase, ["vendor_offers"]);
  if (admins.length === 0) return;
  const subject = `Vendor declined: ${ctx.order.order_number} — ${ctx.step.name || "step"}`;
  const lead = `<strong>${escapeHtml(ctx.vendor.full_name || ctx.vendor.email)}</strong> declined the offer. The step may need to be reassigned.`;
  const html = emailShell(
    "Vendor declined",
    lead,
    rows([
      ["Order", ctx.order.order_number],
      ["Step", ctx.step.name || "—"],
      ["Vendor", ctx.vendor.full_name || ctx.vendor.email],
    ]),
    noteBlock("Vendor reason", ctx.reason ?? ""),
    "Open in admin portal",
    `${ADMIN_PORTAL_URL}/admin/orders/${ctx.order.id}`,
  );
  await Promise.all(
    admins.map((a) =>
      sendOne({
        supabase: ctx.supabase,
        eventType: "vendor_declined",
        recipientEmail: a.email,
        recipientName: a.name,
        ccEmails: [],
        subject,
        htmlContent: html,
        orderId: ctx.order.id,
        stepId: ctx.step.id,
        offerId: ctx.offer?.id ?? null,
        metadata: { reason: ctx.reason ?? null },
      }),
    ),
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3. notifyAdminVendorDelivered — vendor uploaded delivery files.
// Tells admin the step is ready for review. Carries any vendor-side notes.
// ──────────────────────────────────────────────────────────────────────────
export async function notifyAdminVendorDelivered(
  ctx: VendorActionContext & { fileCount?: number; version?: number },
): Promise<void> {
  const admins = await getAdminRecipients(ctx.supabase, ["vendor_offers"]);
  if (admins.length === 0) return;
  const subject = `Delivery received: ${ctx.order.order_number} — ${ctx.step.name || "step"}`;
  const lead = `<strong>${escapeHtml(ctx.vendor.full_name || ctx.vendor.email)}</strong> delivered files for this step. Please review in the admin portal.`;
  const items: Array<[string, string]> = [
    ["Order", ctx.order.order_number],
    ["Step", ctx.step.name || "—"],
    ["Vendor", ctx.vendor.full_name || ctx.vendor.email],
  ];
  if (ctx.fileCount != null) items.push(["Files", String(ctx.fileCount)]);
  if (ctx.version != null) items.push(["Version", `v${ctx.version}`]);
  const html = emailShell(
    "Vendor delivery received",
    lead,
    rows(items),
    noteBlock("Vendor note", ctx.note ?? ""),
    "Review in admin portal",
    `${ADMIN_PORTAL_URL}/admin/orders/${ctx.order.id}`,
  );
  await Promise.all(
    admins.map((a) =>
      sendOne({
        supabase: ctx.supabase,
        eventType: "vendor_delivered",
        recipientEmail: a.email,
        recipientName: a.name,
        ccEmails: [],
        subject,
        htmlContent: html,
        orderId: ctx.order.id,
        stepId: ctx.step.id,
        metadata: { file_count: ctx.fileCount ?? null, version: ctx.version ?? null },
      }),
    ),
  );
}
