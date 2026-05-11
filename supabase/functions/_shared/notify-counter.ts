// ============================================================================
// notify-counter.ts (vendor portal copy)
// Shared helpers for counter-offer email notifications. Mirrors the pattern
// in notify-vendor-assignment.ts (admin repo):
//   * POST to Brevo /v3/smtp/email
//   * INSERT a notification_log row per recipient (sent/failed)
//   * Never throw — emails are fire-and-forget; the offer write must
//     succeed regardless of Brevo availability.
//
// Triggers wired by vendor-counter-offer:
//   * `proposed`     — vendor submitted a counter that's outside auto-accept
//                      bounds; emails the admin fanout list.
//   * `auto_accepted` — counter was inside bounds and applied; emails the
//                      vendor (their assignment is live) + admin fanout.
//
// Triggers wired by admin-respond-counter-offer (admin repo, separate copy):
//   * `accepted`     — admin accepted the counter; emails the vendor.
//   * `rejected`     — admin rejected the counter; emails the vendor.
// ============================================================================

const VENDOR_PORTAL_URL =
  Deno.env.get("VENDOR_PORTAL_URL") || "https://vendor.cethos.com";
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

interface SendArgs {
  supabase: any;
  eventType: string;
  recipientType: "vendor" | "admin";
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
    console.warn("notify-counter: BREVO_API_KEY not set, skipping send");
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
      console.error("notify-counter Brevo error:", errorMsg);
    } else {
      brevoMessageId = result?.messageId ?? null;
    }
  } catch (err: any) {
    status = "failed";
    errorMsg = err?.message || String(err);
    console.error("notify-counter threw:", errorMsg);
  }

  // notification_log audit row — fail silently if the insert fails (we
  // don't want to lose the email work on a logging hiccup).
  try {
    await args.supabase.from("notification_log").insert({
      event_type: args.eventType,
      recipient_type: args.recipientType,
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
    console.error("notify-counter notification_log insert failed:", e?.message || e);
  }
}

// ── Public helpers ──────────────────────────────────────────────────────────

interface CounterContext {
  supabase: any;
  offerId: string;
  stepId: string;
  vendor: { id: string; full_name: string | null; email: string; additional_emails?: string[] };
  order: { id: string; order_number: string };
  step: { id: string; name: string | null };
  counter: {
    rate: number | null;
    rate_unit: string | null;
    total: number | null;
    currency: string;
    deadline: string | null;
    note: string;
  };
  original: {
    rate: number | null;
    total: number | null;
    deadline: string | null;
  };
}

function counterSummaryRows(c: CounterContext): string {
  const rows: Array<[string, string]> = [
    ["Order", c.order.order_number],
    ["Step", c.step.name || "—"],
    ["Vendor", c.vendor.full_name || c.vendor.email],
    ["Original rate", fmtMoney(c.original.rate, c.counter.currency)],
    ["Counter rate", fmtMoney(c.counter.rate, c.counter.currency)],
    ["Original total", fmtMoney(c.original.total, c.counter.currency)],
    ["Counter total", fmtMoney(c.counter.total, c.counter.currency)],
  ];
  if (c.counter.deadline) {
    rows.push(["Counter deadline", fmtDate(c.counter.deadline)]);
  }
  return rows
    .map(([k, v]) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111827;font-size:14px;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
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
          Replies to this email go to vendor@cethos.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

async function getAdminRecipients(supabase: any): Promise<Array<{ email: string; name: string | null }>> {
  const { data } = await supabase
    .from("notification_recipients")
    .select("email, name, notification_type, is_active")
    .eq("is_active", true)
    .in("notification_type", ["all", "vendor_offers", "counter_offers"]);
  return (data ?? []).map((r: any) => ({ email: r.email, name: r.name }));
}

function noteBlock(note: string): string {
  if (!note) return "";
  return `<div style="margin-top:16px;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;color:#374151;font-size:13px;line-height:1.5;white-space:pre-wrap;"><strong>Vendor note:</strong> ${escapeHtml(note)}</div>`;
}

// `proposed` — vendor submitted a counter that needs admin review.
export async function notifyAdminCounterProposed(ctx: CounterContext): Promise<void> {
  const admins = await getAdminRecipients(ctx.supabase);
  if (admins.length === 0) return;

  const subject = `Counter proposal: ${ctx.order.order_number} — ${ctx.step.name || "step"}`;
  const lead = `<strong>${escapeHtml(ctx.vendor.full_name || ctx.vendor.email)}</strong> submitted a counter-proposal that exceeds your auto-accept bounds. Please review.`;
  const html = emailShell(
    "Counter proposal pending review",
    lead,
    counterSummaryRows(ctx),
    noteBlock(ctx.counter.note),
    "Review in admin portal",
    `${ADMIN_PORTAL_URL}/admin/orders/${ctx.order.id}`,
  );

  await Promise.all(
    admins.map((a) =>
      sendOne({
        supabase: ctx.supabase,
        eventType: "counter_proposed",
        recipientType: "admin",
        recipientEmail: a.email,
        recipientName: a.name,
        subject,
        htmlContent: html,
        orderId: ctx.order.id,
        stepId: ctx.step.id,
        offerId: ctx.offerId,
        metadata: {
          vendor_id: ctx.vendor.id,
          vendor_name: ctx.vendor.full_name,
          counter_rate: ctx.counter.rate,
          counter_total: ctx.counter.total,
        },
      }),
    ),
  );
}

// `auto_accepted` — counter inside bounds; vendor now assigned. Vendor + admins.
export async function notifyCounterAutoAccepted(ctx: CounterContext): Promise<void> {
  const subject = `Counter accepted — you're assigned: ${ctx.order.order_number}`;
  const lead = `Your counter-proposal was within the admin's auto-accept bounds and has been accepted automatically. The step is now assigned to you.`;
  const vendorHtml = emailShell(
    "Counter accepted — assignment confirmed",
    lead,
    counterSummaryRows(ctx),
    "",
    "View in vendor portal",
    `${VENDOR_PORTAL_URL}/jobs`,
  );

  const ccList = (ctx.vendor.additional_emails ?? [])
    .map((e) => String(e || "").trim())
    .filter((e) => e && e.toLowerCase() !== String(ctx.vendor.email).toLowerCase());

  await sendOne({
    supabase: ctx.supabase,
    eventType: "counter_auto_accepted",
    recipientType: "vendor",
    recipientEmail: ctx.vendor.email,
    recipientName: ctx.vendor.full_name,
    recipientId: ctx.vendor.id,
    ccEmails: ccList,
    subject,
    htmlContent: vendorHtml,
    orderId: ctx.order.id,
    stepId: ctx.step.id,
    offerId: ctx.offerId,
    metadata: {
      counter_rate: ctx.counter.rate,
      counter_total: ctx.counter.total,
    },
  });

  const admins = await getAdminRecipients(ctx.supabase);
  if (admins.length === 0) return;
  const adminSubject = `Counter auto-accepted: ${ctx.order.order_number} — ${ctx.step.name || "step"}`;
  const adminLead = `<strong>${escapeHtml(ctx.vendor.full_name || ctx.vendor.email)}</strong>'s counter was inside the auto-accept bounds and was applied automatically.`;
  const adminHtml = emailShell(
    "Counter auto-accepted",
    adminLead,
    counterSummaryRows(ctx),
    noteBlock(ctx.counter.note),
    "View in admin portal",
    `${ADMIN_PORTAL_URL}/admin/orders/${ctx.order.id}`,
  );
  await Promise.all(
    admins.map((a) =>
      sendOne({
        supabase: ctx.supabase,
        eventType: "counter_auto_accepted",
        recipientType: "admin",
        recipientEmail: a.email,
        recipientName: a.name,
        subject: adminSubject,
        htmlContent: adminHtml,
        orderId: ctx.order.id,
        stepId: ctx.step.id,
        offerId: ctx.offerId,
        metadata: {
          vendor_id: ctx.vendor.id,
          vendor_name: ctx.vendor.full_name,
        },
      }),
    ),
  );
}
