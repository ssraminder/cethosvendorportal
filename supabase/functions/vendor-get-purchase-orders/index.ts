// vendor-get-purchase-orders — lists Purchase Orders that have been sent to the
// logged-in vendor, each annotated with whether the vendor has already raised an
// invoice against it. Also returns the vendor's tax (GST/HST) profile so the
// "Raise invoice" form can default the tax line.
//
// POST (no body needed). Auth: vendor_sessions bearer token.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

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

    // Vendor tax profile (GST/HST registration) for defaulting the invoice tax line.
    const { data: vendor } = await sb
      .from("vendors")
      .select("tax_id, tax_name, tax_rate")
      .eq("id", vendorId)
      .maybeSingle();

    // POs that have actually been issued to the vendor. 'draft' POs aren't
    // visible — only ones the office has sent (or the vendor has acknowledged).
    const { data: pos, error: poErr } = await sb
      .from("vendor_purchase_orders")
      .select(
        "id, po_number, order_id, workflow_step_id, step_name, service, source_language, target_language, rate, rate_unit, units, currency, subtotal, total, deadline, status, pdf_storage_path, sent_at, created_at",
      )
      .eq("vendor_id", vendorId)
      .in("status", ["sent", "acknowledged", "revised"])
      .order("sent_at", { ascending: false, nullsFirst: false });
    if (poErr) return json({ success: false, error: poErr.message }, 500);

    const poRows = pos || [];

    // Which POs already have an invoice raised? (one active invoice per PO)
    const poIds = poRows.map((p) => p.id);
    let invByPo = new Map<string, { id: string; status: string; invoice_number: string | null; vendor_invoice_number: string | null; submitted_at: string | null }>();
    if (poIds.length) {
      const { data: invs } = await sb
        .from("cvp_payments")
        .select("id, vendor_purchase_order_id, status, invoice_number, vendor_invoice_number, submitted_at")
        .in("vendor_purchase_order_id", poIds)
        .neq("status", "cancelled");
      for (const inv of invs || []) {
        invByPo.set(inv.vendor_purchase_order_id as string, {
          id: inv.id as string,
          status: inv.status as string,
          invoice_number: (inv.invoice_number as string) ?? null,
          vendor_invoice_number: (inv.vendor_invoice_number as string) ?? null,
          submitted_at: (inv.submitted_at as string) ?? null,
        });
      }
    }

    const out = poRows.map((po) => {
      const inv = invByPo.get(po.id) || null;
      return {
        id: po.id,
        po_number: po.po_number,
        order_id: po.order_id,
        workflow_step_id: po.workflow_step_id,
        step_name: po.step_name,
        service: po.service,
        source_language: po.source_language,
        target_language: po.target_language,
        rate: po.rate,
        rate_unit: po.rate_unit,
        units: po.units,
        currency: po.currency || "USD",
        // PO total is the agreed pre-tax fee; the vendor adds GST on the invoice.
        subtotal: po.subtotal ?? po.total,
        total: po.total,
        deadline: po.deadline,
        sent_at: po.sent_at,
        has_pdf: !!po.pdf_storage_path,
        invoice: inv, // null => can raise; otherwise already raised
      };
    });

    return json({
      success: true,
      purchase_orders: out,
      tax_profile: {
        tax_id: vendor?.tax_id ?? null,
        tax_name: vendor?.tax_name ?? null,
        tax_rate: vendor?.tax_rate != null ? Number(vendor.tax_rate) : null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("vendor-get-purchase-orders error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
