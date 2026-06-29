// vendor-raise-invoice — vendor raises an invoice against a PO that has been
// sent to them. One invoice per PO. The PO total is the agreed pre-tax fee; the
// vendor adds GST/HST (from their registered rate) on top. Invoice document
// upload is MANDATORY.
//
// POST multipart/form-data {
//   po_id: string,
//   vendor_invoice_number: string,   // vendor's own accounting reference (required)
//   apply_gst: "true" | "false",     // charge GST/HST at the vendor's registered rate
//   file: File                       // invoice PDF/scan (required)
// }
// Auth: vendor_sessions bearer token.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

function sanitize(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return json({ success: false, error: "Invoice document is required — send as multipart/form-data" }, 400);
    }
    const form = await req.formData();
    const poId = String(form.get("po_id") || "");
    const vendorInvoiceNumber = String(form.get("vendor_invoice_number") || "").trim();
    const applyGst = String(form.get("apply_gst") || "false") === "true";
    const f = form.get("file");
    const file = f instanceof File && f.size > 0 ? f : null;

    if (!poId) return json({ success: false, error: "Missing po_id" }, 400);
    if (!vendorInvoiceNumber) return json({ success: false, error: "Your invoice number is required" }, 400);
    // Document upload is mandatory.
    if (!file) return json({ success: false, error: "An invoice document (PDF/scan) is required" }, 400);

    // Fetch PO + verify ownership and that it has been sent.
    const { data: po } = await sb
      .from("vendor_purchase_orders")
      .select("id, vendor_id, order_id, workflow_step_id, po_number, step_name, source_language, target_language, currency, subtotal, total, status")
      .eq("id", poId)
      .maybeSingle();
    if (!po) return json({ success: false, error: "Purchase order not found" }, 404);
    if (po.vendor_id !== vendorId) return json({ success: false, error: "Not authorized for this purchase order" }, 403);
    if (!["sent", "acknowledged", "revised"].includes(po.status)) {
      return json({ success: false, error: `This PO is ${po.status} and cannot be invoiced` }, 409);
    }

    // One invoice per PO.
    const { data: existing } = await sb
      .from("cvp_payments")
      .select("id, status, invoice_number")
      .eq("vendor_purchase_order_id", poId)
      .neq("status", "cancelled")
      .maybeSingle();
    if (existing) {
      return json({ success: false, error: `An invoice (${existing.invoice_number}) has already been raised for ${po.po_number}` }, 409);
    }

    // Duplicate vendor invoice reference guard (same vendor, same ref).
    const { data: dup } = await sb
      .from("cvp_payments")
      .select("id, invoice_number")
      .eq("vendor_id", vendorId)
      .eq("vendor_invoice_number", vendorInvoiceNumber)
      .maybeSingle();
    if (dup) {
      return json({ success: false, error: `Invoice reference "${vendorInvoiceNumber}" is already used on ${dup.invoice_number}` }, 409);
    }

    // Amounts. PO total is the agreed pre-tax fee.
    const subtotal = round2(Number(po.subtotal ?? po.total ?? 0));
    if (!(subtotal > 0)) return json({ success: false, error: "This PO has no payable amount" }, 422);

    let taxAmount = 0;
    let taxRate = 0;
    let taxName: string | null = null;
    if (applyGst) {
      const { data: vendor } = await sb
        .from("vendors")
        .select("tax_id, tax_name, tax_rate")
        .eq("id", vendorId)
        .maybeSingle();
      taxRate = vendor?.tax_rate != null ? Number(vendor.tax_rate) : 0;
      taxName = vendor?.tax_name ?? "GST";
      if (!vendor?.tax_id) {
        return json({ success: false, error: "Add your GST/HST registration number under Payment before charging tax" }, 422);
      }
      if (!(taxRate > 0)) {
        return json({ success: false, error: "No tax rate is set on your profile — contact Cethos before charging tax" }, 422);
      }
      taxAmount = round2(subtotal * (taxRate / 100));
    }
    const totalAmount = round2(subtotal + taxAmount);

    // Upload the (mandatory) invoice document.
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) return json({ success: false, error: "Invoice file exceeds 20 MB limit" }, 400);
    const path = `invoices/${vendorId}/${poId}/${sanitize(file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await sb.storage.createBucket("vendor-invoices", { public: false }).catch(() => {});
    const { error: upErr } = await sb.storage
      .from("vendor-invoices")
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
    if (upErr) return json({ success: false, error: `File upload failed: ${upErr.message}` }, 500);

    // Build a human reference: order number + step + pair.
    let orderRef: string | null = null;
    if (po.order_id) {
      const { data: ord } = await sb.from("orders").select("order_number").eq("id", po.order_id).maybeSingle();
      orderRef = ord?.order_number ?? null;
    }
    const desc = [
      po.step_name,
      po.source_language && po.target_language ? `${po.source_language} → ${po.target_language}` : null,
    ].filter(Boolean).join(" — ");
    const nowIso = new Date().toISOString();
    const invoiceNum = "PAY-" + crypto.randomUUID().slice(0, 8).toUpperCase();

    const { data: inserted, error: insErr } = await sb
      .from("cvp_payments")
      .insert({
        vendor_id: vendorId,
        vendor_purchase_order_id: poId,
        step_id: po.workflow_step_id,
        invoice_number: invoiceNum,
        amount: subtotal,
        currency: po.currency || "USD",
        tax_amount: taxAmount,
        total_amount: totalAmount,
        status: "submitted",
        invoice_date: nowIso.split("T")[0],
        vendor_invoice_number: vendorInvoiceNumber,
        vendor_invoice_file_path: path,
        order_reference: orderRef ? `${po.po_number} — ${orderRef} — ${desc}` : `${po.po_number} — ${desc}`,
        description: desc || null,
        submitted_at: nowIso,
        notes: applyGst ? `${taxName} ${taxRate}% on ${subtotal}` : "No tax charged",
      })
      .select("id, invoice_number")
      .single();

    if (insErr) {
      // Unique index race: another invoice slipped in for this PO.
      if (insErr.code === "23505") {
        return json({ success: false, error: `An invoice has already been raised for ${po.po_number}` }, 409);
      }
      return json({ success: false, error: `Failed to raise invoice: ${insErr.message}` }, 500);
    }

    return json({
      success: true,
      invoice_id: inserted.id,
      invoice_number: inserted.invoice_number,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      currency: po.currency || "USD",
      status: "submitted",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("vendor-raise-invoice error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
