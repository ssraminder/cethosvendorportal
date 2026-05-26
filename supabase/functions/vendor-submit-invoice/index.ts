// vendor-submit-invoice — Vendor reviews a draft invoice, adds their own
// invoice reference number, optionally uploads their invoice file, and
// submits it for payment processing.
//
// POST multipart/form-data or application/json {
//   invoice_id: string,
//   vendor_invoice_number: string,   // vendor's own accounting reference
//   file?: File                      // optional invoice PDF/scan
// }
// Auth: vendor_sessions bearer token.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Authentication required" }, 401);

    const { data: session } = await sb
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ success: false, error: "Invalid or expired session" }, 401);
    const vendorId = session.vendor_id;

    // Parse body — supports both multipart (with file) and JSON (without file)
    let invoiceId = "";
    let vendorInvoiceNumber = "";
    let file: File | null = null;

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      invoiceId = String(form.get("invoice_id") || "");
      vendorInvoiceNumber = String(form.get("vendor_invoice_number") || "");
      const f = form.get("file");
      if (f instanceof File && f.size > 0) file = f;
    } else {
      const body = await req.json().catch(() => ({}));
      invoiceId = String(body.invoice_id || "");
      vendorInvoiceNumber = String(body.vendor_invoice_number || "");
    }

    if (!invoiceId) return json({ success: false, error: "Missing invoice_id" }, 400);
    if (!vendorInvoiceNumber.trim()) {
      return json({ success: false, error: "Missing vendor_invoice_number" }, 400);
    }

    // Fetch invoice and verify ownership + draft status
    const { data: invoice } = await sb
      .from("cvp_payments")
      .select("id, vendor_id, status")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return json({ success: false, error: "Invoice not found" }, 404);
    if (invoice.vendor_id !== vendorId) {
      return json({ success: false, error: "Not authorized" }, 403);
    }
    if (invoice.status !== "draft") {
      return json({
        success: false,
        error: `Invoice is already ${invoice.status} — only draft invoices can be submitted`,
      }, 409);
    }

    // Upload vendor invoice file if provided
    let vendorInvoiceFilePath: string | null = null;
    if (file) {
      const maxSize = 20 * 1024 * 1024; // 20 MB
      if (file.size > maxSize) {
        return json({ success: false, error: "Invoice file exceeds 20 MB limit" }, 400);
      }
      const path = `invoices/${vendorId}/${invoiceId}/${sanitize(file.name)}`;
      const bytes = new Uint8Array(await file.arrayBuffer());

      // Ensure bucket exists
      await sb.storage.createBucket("vendor-invoices", { public: false }).catch(() => {});

      const { error: upErr } = await sb.storage
        .from("vendor-invoices")
        .upload(path, bytes, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });
      if (upErr) {
        return json({ success: false, error: `File upload failed: ${upErr.message}` }, 500);
      }
      vendorInvoiceFilePath = path;
    }

    const nowIso = new Date().toISOString();

    const updateFields: Record<string, unknown> = {
      status: "submitted",
      vendor_invoice_number: vendorInvoiceNumber.trim(),
      submitted_at: nowIso,
      updated_at: nowIso,
    };
    if (vendorInvoiceFilePath) {
      updateFields.vendor_invoice_file_path = vendorInvoiceFilePath;
    }

    const { error: updateErr } = await sb
      .from("cvp_payments")
      .update(updateFields)
      .eq("id", invoiceId);

    if (updateErr) {
      return json({ success: false, error: `Failed to submit invoice: ${updateErr.message}` }, 500);
    }

    return json({
      success: true,
      invoice_id: invoiceId,
      status: "submitted",
      submitted_at: nowIso,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("vendor-submit-invoice error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
