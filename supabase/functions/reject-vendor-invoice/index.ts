// reject-vendor-invoice — staff reject a vendor-raised PO invoice (e.g. the
// vendor uploaded a copy of the Purchase Order instead of a real invoice).
// Rejecting stamps the invoice `rejected` (freeing the PO to be invoiced again)
// and emails the vendor the preset reason + any manual notes.
//
// POST (JSON) {
//   invoice_id: string,          // cvp_payments.id
//   reason: string,              // preset reason (shown to the vendor)
//   note?: string,               // optional free-text staff notes (shown to the vendor)
//   rejected_by?: string         // staff_users.id (audit)
// }
// Invoked from the admin Portal Invoices screen. Deployed --no-verify-jwt.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunOperationalEmail } from "../_shared/mailgun.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderRejectionEmail(params: {
  vendor_name: string;
  po_number: string | null;
  invoice_ref: string;
  reason: string;
  note: string | null;
  portal_url: string;
}): { subject: string; html: string; text: string } {
  const poLabel = params.po_number ? ` for purchase order ${params.po_number}` : "";
  const subject = params.po_number
    ? `Action needed: invoice for ${params.po_number} was not accepted`
    : "Action needed: your invoice was not accepted";

  const noteBlock = params.note
    ? `<p style="margin:12px 0;"><strong>Additional notes from Cethos:</strong><br>${escapeHtml(params.note).replace(/\n/g, "<br>")}</p>`
    : "";

  const html = `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;padding:24px;">
  <h2 style="color:#0891B2;font-size:18px;margin:0 0 12px;">Your invoice needs to be re-submitted</h2>
  <p>Hi ${escapeHtml(params.vendor_name)},</p>
  <p>We reviewed the invoice you submitted${escapeHtml(poLabel)} (reference <strong>${escapeHtml(params.invoice_ref)}</strong>) and it could not be accepted.</p>
  <p style="margin:12px 0;padding:12px 14px;background:#FEF2F2;border-left:3px solid #DC2626;border-radius:4px;">
    <strong>Reason:</strong> ${escapeHtml(params.reason)}
  </p>
  ${noteBlock}
  <p style="margin:12px 0;">The purchase order is open again, so you can submit a corrected invoice from your portal. Please attach a proper invoice document (not a copy of the purchase order) showing your invoice number, date, the amount, and your GST/HST registration details where applicable.</p>
  <p><a href="${params.portal_url}/purchase-orders" style="display:inline-block;background:#0891B2;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600;font-size:14px;">Submit a corrected invoice</a></p>
  <p style="color:#6B7280;font-size:13px;margin-top:16px;">If you have any questions, just reply to this email.</p>
</div>`;

  const text = [
    `Hi ${params.vendor_name},`,
    ``,
    `We reviewed the invoice you submitted${poLabel} (reference ${params.invoice_ref}) and it could not be accepted.`,
    ``,
    `Reason: ${params.reason}`,
    params.note ? `\nAdditional notes from Cethos:\n${params.note}` : ``,
    ``,
    `The purchase order is open again, so you can submit a corrected invoice from your portal at ${params.portal_url}/purchase-orders. Please attach a proper invoice document (not a copy of the purchase order) showing your invoice number, date, the amount, and your GST/HST registration details where applicable.`,
    ``,
    `If you have any questions, just reply to this email.`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body.invoice_id || "").trim();
    const reason = String(body.reason || "").trim();
    const note = body.note != null ? String(body.note).trim() : "";
    const rejectedBy = body.rejected_by ? String(body.rejected_by) : null;

    if (!invoiceId) return json({ success: false, error: "Missing invoice_id" }, 400);
    if (!reason) return json({ success: false, error: "A rejection reason is required" }, 400);

    // Fetch the invoice.
    const { data: inv } = await sb
      .from("cvp_payments")
      .select("id, vendor_id, status, invoice_number, vendor_invoice_number, vendor_purchase_order_id, paid_at")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv) return json({ success: false, error: "Invoice not found" }, 404);
    if (inv.paid_at || inv.status === "paid") {
      return json({ success: false, error: "This invoice has already been paid and cannot be rejected" }, 409);
    }
    if (!["submitted", "approved"].includes(inv.status)) {
      return json({ success: false, error: `This invoice is ${inv.status} and cannot be rejected` }, 409);
    }

    // Mark rejected — this frees the PO to be invoiced again (the one-active-
    // invoice-per-PO unique index excludes 'rejected').
    const nowIso = new Date().toISOString();
    const { error: updErr } = await sb
      .from("cvp_payments")
      .update({
        status: "rejected",
        rejected_at: nowIso,
        rejected_by: rejectedBy,
        rejection_reason: reason,
        rejection_note: note || null,
        updated_at: nowIso,
      })
      .eq("id", invoiceId);
    if (updErr) return json({ success: false, error: `Failed to reject invoice: ${updErr.message}` }, 500);

    // Resolve the PO number and vendor contact for the email.
    let poNumber: string | null = null;
    if (inv.vendor_purchase_order_id) {
      const { data: po } = await sb
        .from("vendor_purchase_orders")
        .select("po_number")
        .eq("id", inv.vendor_purchase_order_id)
        .maybeSingle();
      poNumber = po?.po_number ?? null;
    }

    const { data: vendor } = await sb
      .from("vendors")
      .select("full_name, email")
      .eq("id", inv.vendor_id)
      .maybeSingle();

    let emailSent = false;
    let emailReason: string | undefined;
    if (vendor?.email) {
      const rendered = renderRejectionEmail({
        vendor_name: vendor.full_name || "there",
        po_number: poNumber,
        invoice_ref: inv.vendor_invoice_number || inv.invoice_number || invoiceId,
        reason,
        note: note || null,
        portal_url: Deno.env.get("VENDOR_PORTAL_URL") || "https://vendor.cethos.com",
      });
      const result = await sendMailgunOperationalEmail({
        to: { email: vendor.email, name: vendor.full_name || undefined },
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: "ap@cethos.com",
        tags: ["invoice-rejected", invoiceId.slice(0, 40)],
      });
      emailSent = result.sent;
      if (!result.sent) emailReason = result.reason;
    } else {
      emailReason = "vendor_has_no_email";
    }

    return json({
      success: true,
      invoice_id: invoiceId,
      status: "rejected",
      po_number: poNumber,
      email_sent: emailSent,
      email_reason: emailReason,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("reject-vendor-invoice error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
