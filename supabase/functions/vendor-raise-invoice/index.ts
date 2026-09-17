// vendor-raise-invoice — the vendor raises ONE invoice covering ONE OR MORE
// purchase orders. Nothing is uploaded: Cethos generates the invoice PDF from
// the purchase orders themselves (self-billing), so the document can never
// disagree with the approved payables.
//
// Because every figure comes from an approved payable on delivered, signed-off
// work, there is nothing left for staff to approve. Invoices are created
// already `approved` with approval_mode = 'auto_po_matched' and flow straight
// to the payment run.
//
// POST application/json {
//   po_ids: string[],                  // one or more POs, same entity + currency
//   vendor_invoice_number: string,     // the vendor's own reference (unique for them)
//   invoice_date?: "YYYY-MM-DD",       // defaults to today
//   charges_tax?: boolean,             // vendor is registered and charging tax
//   tax_registration_number?: string,  // saved to their profile when supplied
//   accept_self_billing?: boolean      // required the first time only
// }
// Auth: vendor_sessions bearer token.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SELF_BILLING_VERSION = "self-billing-v1.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// NET terms: due date = invoice date + the vendor's agreed payment_terms_days
// (Cethos default 45).
// deno-lint-ignore no-explicit-any
async function computeDueDate(sb: any, vendorId: string, fromDate: string): Promise<string> {
  const { data } = await sb
    .from("vendor_payment_info")
    .select("payment_terms_days")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  const days = Number(data?.payment_terms_days ?? 45);
  const d = new Date(fromDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (Number.isFinite(days) ? days : 45));
  return d.toISOString().split("T")[0];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Authentication required" }, 401);

    const { data: session } = await sb
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ success: false, error: "Invalid or expired session" }, 401);
    const vendorId = session.vendor_id;

    const body = await req.json().catch(() => ({}));
    const poIds: string[] = Array.isArray(body?.po_ids)
      ? [...new Set(body.po_ids.filter((x: unknown) => typeof x === "string" && x))]
      : [];
    const vendorInvoiceNumber = String(body?.vendor_invoice_number ?? "").trim();
    const chargesTax = body?.charges_tax === true;
    const taxRegInput = String(body?.tax_registration_number ?? "").trim();
    const acceptSelfBilling = body?.accept_self_billing === true;

    if (!poIds.length) return json({ success: false, error: "Select at least one purchase order" }, 400);
    if (!vendorInvoiceNumber) return json({ success: false, error: "Your invoice number is required" }, 400);

    const invoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.invoice_date ?? ""))
      ? String(body.invoice_date)
      : new Date().toISOString().split("T")[0];

    // ── Invoice number must be unused by this vendor ────────────────────────
    // With no rejection flow there is no "reuse after rejection" case: a number
    // is used once, full stop. Voided invoices keep their number reserved so a
    // vendor's own books stay unambiguous.
    const { data: dupe } = await sb
      .from("cvp_payments")
      .select("id, invoice_number")
      .eq("vendor_id", vendorId)
      .eq("vendor_invoice_number", vendorInvoiceNumber)
      .maybeSingle();
    if (dupe) {
      return json({
        success: false,
        code: "INVOICE_NUMBER_USED",
        error: `You have already used invoice number "${vendorInvoiceNumber}".`,
      }, 409);
    }

    // ── Load the POs and check every one is invoiceable ─────────────────────
    const { data: pos } = await sb
      .from("vendor_purchase_orders")
      .select("id, vendor_id, order_id, workflow_step_id, vendor_payable_id, po_number, step_name, service, source_language, target_language, currency, subtotal, total, status")
      .in("id", poIds);

    const found = pos ?? [];
    const missing = poIds.filter((id) => !found.some((p: any) => p.id === id));
    if (missing.length) {
      return json({ success: false, code: "PO_NOT_FOUND", error: "One or more purchase orders could not be found.", po_ids: missing }, 404);
    }
    for (const po of found) {
      if (po.vendor_id !== vendorId) {
        return json({ success: false, code: "PO_NOT_YOURS", error: "One of these purchase orders is not yours." }, 403);
      }
      if (!["sent", "acknowledged", "revised"].includes(po.status)) {
        return json({
          success: false, code: "PO_NOT_OPEN",
          error: `${po.po_number} is ${po.status} and cannot be invoiced.`, po_number: po.po_number,
        }, 409);
      }
    }

    // The gate that replaces staff approval: the cost must already be approved.
    // A PO whose payable is still pending, missing or cancelled is NOT payable,
    // so letting it through would push an unapproved cost straight into a
    // payment run.
    const payableIds = found.map((p: any) => p.vendor_payable_id).filter(Boolean);
    const { data: payables } = payableIds.length
      ? await sb.from("vendor_payables").select("id, status, subtotal, total, currency").in("id", payableIds)
      : { data: [] };
    const payableById = new Map((payables ?? []).map((p: any) => [p.id, p]));

    for (const po of found) {
      const pay = po.vendor_payable_id ? payableById.get(po.vendor_payable_id) : null;
      if (!pay || pay.status !== "approved") {
        return json({
          success: false,
          code: "PO_NOT_READY",
          error: `${po.po_number} is not ready to invoice yet — the cost has not been signed off internally. We will email you when it is.`,
          po_number: po.po_number,
        }, 409);
      }
    }

    // Already billed? Read the LINES, not the header: a multi-PO invoice leaves
    // cvp_payments.vendor_purchase_order_id NULL, so checking the header would
    // miss it and let the same PO be billed twice.
    const { data: existingLines } = await sb
      .from("cvp_invoice_lines")
      .select("vendor_purchase_order_id, payment_id")
      .in("vendor_purchase_order_id", poIds)
      .eq("is_active", true);
    if (existingLines?.length) {
      const clash = found.find((p: any) => existingLines.some((l: any) => l.vendor_purchase_order_id === p.id));
      return json({
        success: false, code: "PO_ALREADY_INVOICED",
        error: `${clash?.po_number ?? "A purchase order"} is already on another invoice.`,
        po_number: clash?.po_number ?? null,
      }, 409);
    }

    // ── One currency, one Cethos entity ─────────────────────────────────────
    const currencies = [...new Set(found.map((p: any) => String(p.currency || "USD").toUpperCase()))];
    if (currencies.length > 1) {
      return json({
        success: false, code: "MIXED_CURRENCY",
        error: `These purchase orders are in different currencies (${currencies.join(", ")}). Raise one invoice per currency.`,
      }, 422);
    }
    const currency = currencies[0];

    const orderIds = [...new Set(found.map((p: any) => p.order_id).filter(Boolean))];
    const { data: orders } = orderIds.length
      ? await sb.from("orders").select("id, order_number, invoicing_branch_id, internal_project_id, actual_delivery_date, estimated_delivery_date").in("id", orderIds)
      : { data: [] };
    const orderById = new Map((orders ?? []).map((o: any) => [o.id, o]));

    const branchIds = [...new Set((orders ?? []).map((o: any) => o.invoicing_branch_id).filter(Boolean))];
    if (branchIds.length > 1) {
      const { data: bs } = await sb.from("branches").select("id, legal_name").in("id", branchIds);
      return json({
        success: false, code: "MIXED_ENTITY",
        error: `These purchase orders belong to different Cethos companies (${(bs ?? []).map((b: any) => b.legal_name).join(", ")}). Each company needs its own invoice.`,
        entities: bs ?? [],
      }, 422);
    }
    if (!branchIds.length) {
      return json({
        success: false, code: "INVOICING_ENTITY_MISSING",
        error: "We cannot tell which Cethos company these purchase orders belong to. Please contact ap@cethos.com.",
      }, 422);
    }
    const branchId = branchIds[0];

    // ── Tax ─────────────────────────────────────────────────────────────────
    const { data: vendor } = await sb
      .from("vendors").select("tax_id, tax_name, tax_rate").eq("id", vendorId).maybeSingle();

    let taxRate = 0;
    let taxRegNumber: string | null = vendor?.tax_id ?? null;
    if (chargesTax) {
      if (taxRegInput) taxRegNumber = taxRegInput;
      if (!taxRegNumber) {
        return json({
          success: false, code: "TAX_REGISTRATION_REQUIRED",
          error: "Add your tax registration number before charging tax.",
        }, 422);
      }
      taxRate = vendor?.tax_rate != null ? Number(vendor.tax_rate) : 0;
      if (!(taxRate > 0)) {
        return json({
          success: false, code: "TAX_RATE_MISSING",
          error: "No tax rate is set on your profile — contact ap@cethos.com before charging tax.",
        }, 422);
      }
      // Persist what they told us so we never have to ask again.
      if (taxRegInput && taxRegInput !== vendor?.tax_id) {
        await sb.from("vendors").update({ tax_id: taxRegInput }).eq("id", vendorId);
      }
    }

    // ── Self-billing agreement ──────────────────────────────────────────────
    const { data: terms } = await sb
      .from("service_terms").select("id, version").eq("version", SELF_BILLING_VERSION).maybeSingle();
    const { data: priorAcceptance } = terms
      ? await sb.from("vendor_terms_acceptances")
          .select("id").eq("vendor_id", vendorId)
          .eq("terms_version", SELF_BILLING_VERSION).eq("action", "accept_self_billing").maybeSingle()
      : { data: null };

    if (!priorAcceptance) {
      if (!acceptSelfBilling) {
        return json({
          success: false, code: "SELF_BILLING_NOT_ACCEPTED",
          error: "Please accept the self-billing agreement so Cethos can raise invoices in your name.",
          terms_version: SELF_BILLING_VERSION,
        }, 428);
      }
      if (terms) {
        await sb.from("vendor_terms_acceptances").insert({
          vendor_id: vendorId,
          service_terms_id: terms.id,
          action: "accept_self_billing",
          acceptance_type: "immediate",
          is_binding: true,
          binding_at: new Date().toISOString(),
          terms_version: SELF_BILLING_VERSION,
          accepted_at: new Date().toISOString(),
        });
      }
    }

    // ── Build the lines ─────────────────────────────────────────────────────
    const projectIds = [...new Set((orders ?? []).map((o: any) => o.internal_project_id).filter(Boolean))];
    const { data: projects } = projectIds.length
      ? await sb.from("internal_projects").select("id, project_number").in("id", projectIds)
      : { data: [] };
    const projectById = new Map((projects ?? []).map((p: any) => [p.id, p]));

    const lineRows = found.map((po: any) => {
      const order = po.order_id ? orderById.get(po.order_id) : null;
      const project = order?.internal_project_id ? projectById.get(order.internal_project_id) : null;
      const payable = po.vendor_payable_id ? payableById.get(po.vendor_payable_id) : null;
      // The approved payable is authoritative; the PO is the fallback.
      const sub = round2(Number(payable?.subtotal ?? payable?.total ?? po.subtotal ?? po.total ?? 0));
      const tax = chargesTax ? round2(sub * (taxRate / 100)) : 0;
      const desc = [
        po.step_name || po.service,
        po.source_language && po.target_language ? `${po.source_language} to ${po.target_language}` : null,
      ].filter(Boolean).join(", ");
      return {
        vendor_purchase_order_id: po.id,
        vendor_payable_id: po.vendor_payable_id ?? null,
        workflow_step_id: po.workflow_step_id ?? null,
        order_id: po.order_id ?? null,
        po_number: po.po_number,
        project_number: project?.project_number ?? order?.order_number ?? null,
        description: desc || null,
        delivered_on: order?.actual_delivery_date ?? order?.estimated_delivery_date ?? null,
        subtotal: sub,
        tax_amount: tax,
        total: round2(sub + tax),
        currency,
      };
    });

    const subtotal = round2(lineRows.reduce((s, l) => s + l.subtotal, 0));
    const taxAmount = round2(lineRows.reduce((s, l) => s + l.tax_amount, 0));
    const totalAmount = round2(subtotal + taxAmount);
    if (!(totalAmount > 0)) {
      return json({ success: false, code: "ZERO_TOTAL", error: "These purchase orders have no payable amount." }, 422);
    }

    // ── Create the invoice ──────────────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const dueDate = await computeDueDate(sb, vendorId, invoiceDate);
    const invoiceNum = "PAY-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const poNumbers = lineRows.map((l) => l.po_number).filter(Boolean);

    const { data: inserted, error: insErr } = await sb
      .from("cvp_payments")
      .insert({
        vendor_id: vendorId,
        // Kept only for single-PO invoices so legacy readers still resolve;
        // NULL for multi-PO, where cvp_invoice_lines is the truth.
        vendor_purchase_order_id: lineRows.length === 1 ? lineRows[0].vendor_purchase_order_id : null,
        step_id: lineRows.length === 1 ? lineRows[0].workflow_step_id : null,
        invoice_number: invoiceNum,
        amount: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency,
        // No approval step: the work is signed off and the cost approved.
        status: "approved",
        approval_mode: "auto_po_matched",
        invoicing_branch_id: branchId,
        self_billing_terms_version: SELF_BILLING_VERSION,
        invoice_date: invoiceDate,
        due_date: dueDate,
        vendor_invoice_number: vendorInvoiceNumber,
        order_reference: poNumbers.join(", ").slice(0, 500),
        description: lineRows.length === 1 ? lineRows[0].description : `${lineRows.length} purchase orders`,
        submitted_at: nowIso,
        notes: chargesTax
          ? `${vendor?.tax_name || "Tax"} ${taxRate}% on ${subtotal}`
          : "No tax charged",
      })
      .select("id, invoice_number")
      .single();

    if (insErr) {
      return json({ success: false, error: `Could not raise the invoice: ${insErr.message}` }, 500);
    }

    const { error: linesErr } = await sb
      .from("cvp_invoice_lines")
      .insert(lineRows.map((l) => ({ ...l, payment_id: inserted.id })));

    if (linesErr) {
      // A unique-index clash means another request billed one of these POs
      // between our check and this insert. Roll the header back so no empty
      // invoice is left holding an invoice number.
      await sb.from("cvp_payments").delete().eq("id", inserted.id);
      if (linesErr.code === "23505") {
        return json({
          success: false, code: "PO_ALREADY_INVOICED",
          error: "One of these purchase orders was just invoiced. Refresh and try again.",
        }, 409);
      }
      return json({ success: false, error: `Could not raise the invoice: ${linesErr.message}` }, 500);
    }

    // ── Generate the PDF ────────────────────────────────────────────────────
    // Best-effort: the invoice is already valid and payable without it, so a
    // rendering hiccup must not cost the vendor their submission. The staff
    // screen can regenerate.
    let pdfPath: string | null = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-vendor-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ payment_id: inserted.id }),
      });
      const out = await r.json().catch(() => ({}));
      if (out?.success) pdfPath = out.pdf_storage_path ?? null;
      else console.error("generate-vendor-invoice failed:", out?.error);
    } catch (e) {
      console.error("generate-vendor-invoice unreachable:", (e as Error).message);
    }

    return json({
      success: true,
      invoice_id: inserted.id,
      invoice_number: inserted.invoice_number,
      vendor_invoice_number: vendorInvoiceNumber,
      po_count: lineRows.length,
      po_numbers: poNumbers,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      currency,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: "approved",
      pdf_storage_path: pdfPath,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("vendor-raise-invoice error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
