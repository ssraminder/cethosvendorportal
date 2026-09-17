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
        "id, po_number, order_id, workflow_step_id, vendor_payable_id, step_name, service, source_language, target_language, rate, rate_unit, units, currency, subtotal, total, deadline, status, pdf_storage_path, sent_at, created_at",
      )
      .eq("vendor_id", vendorId)
      .in("status", ["sent", "acknowledged", "revised"])
      .order("sent_at", { ascending: false, nullsFirst: false });
    if (poErr) return json({ success: false, error: poErr.message }, 500);

    const poRows = pos || [];

    const poIds = poRows.map((p) => p.id);

    // Which POs are already on a live invoice?
    //
    // Read cvp_invoice_lines, NOT cvp_payments.vendor_purchase_order_id: an
    // invoice covering several POs leaves that header column NULL, so checking
    // the header would report those POs as free and invite a double bill.
    // is_active is kept in step with the header's status by trigger, so a
    // voided or cancelled invoice releases its POs automatically.
    const invByPo = new Map<string, { id: string; status: string; invoice_number: string | null; vendor_invoice_number: string | null; submitted_at: string | null; po_count: number }>();
    const rejectionByPo = new Map<string, { reason: string | null; note: string | null; rejected_at: string | null }>();
    if (poIds.length) {
      const { data: liveLines } = await sb
        .from("cvp_invoice_lines")
        .select("vendor_purchase_order_id, payment_id")
        .in("vendor_purchase_order_id", poIds)
        .eq("is_active", true);

      const paymentIds = [...new Set((liveLines || []).map((l) => l.payment_id as string))];
      const { data: heads } = paymentIds.length
        ? await sb
            .from("cvp_payments")
            .select("id, status, invoice_number, vendor_invoice_number, submitted_at")
            .in("id", paymentIds)
        : { data: [] };
      const headById = new Map((heads || []).map((h) => [h.id as string, h]));
      const lineCountByPayment = new Map<string, number>();
      for (const l of liveLines || []) {
        const pid = l.payment_id as string;
        lineCountByPayment.set(pid, (lineCountByPayment.get(pid) ?? 0) + 1);
      }
      for (const l of liveLines || []) {
        const head = headById.get(l.payment_id as string);
        if (!head) continue;
        invByPo.set(l.vendor_purchase_order_id as string, {
          id: head.id as string,
          status: head.status as string,
          invoice_number: (head.invoice_number as string) ?? null,
          vendor_invoice_number: (head.vendor_invoice_number as string) ?? null,
          submitted_at: (head.submitted_at as string) ?? null,
          po_count: lineCountByPayment.get(l.payment_id as string) ?? 1,
        });
      }

      // Legacy uploaded invoices could be rejected; the generated flow has no
      // rejection. Keep surfacing the last reason on POs that are open again so
      // historical rejections still explain themselves.
      const { data: rejected } = await sb
        .from("cvp_payments")
        .select("vendor_purchase_order_id, rejection_reason, rejection_note, rejected_at")
        .in("vendor_purchase_order_id", poIds)
        .eq("status", "rejected")
        .order("rejected_at", { ascending: false });
      for (const r of rejected || []) {
        const key = r.vendor_purchase_order_id as string;
        if (!key || rejectionByPo.has(key)) continue;
        rejectionByPo.set(key, {
          reason: (r.rejection_reason as string) ?? null,
          note: (r.rejection_note as string) ?? null,
          rejected_at: (r.rejected_at as string) ?? null,
        });
      }
    }

    // A PO is invoiceable only when its cost is already approved. This is the
    // check that makes a staff approval step on the invoice redundant, so it
    // has to be honest here: the picker must not offer a PO the raise endpoint
    // will refuse.
    const payableIds = poRows.map((p) => p.vendor_payable_id).filter(Boolean) as string[];
    const { data: payables } = payableIds.length
      ? await sb.from("vendor_payables").select("id, status").in("id", payableIds)
      : { data: [] };
    const payableStatusById = new Map((payables || []).map((p) => [p.id as string, p.status as string]));

    // Billing entity + delivery date come from the order.
    const orderIds = [...new Set(poRows.map((p) => p.order_id).filter(Boolean))] as string[];
    const { data: orders } = orderIds.length
      ? await sb
          .from("orders")
          .select("id, order_number, invoicing_branch_id, actual_delivery_date, estimated_delivery_date, internal_project_id")
          .in("id", orderIds)
      : { data: [] };
    const orderById = new Map((orders || []).map((o) => [o.id as string, o]));

    const branchIds = [...new Set((orders || []).map((o) => o.invoicing_branch_id).filter(Boolean))] as number[];
    const { data: branches } = branchIds.length
      ? await sb.from("branches").select("id, legal_name, tax_number, tax_label").in("id", branchIds)
      : { data: [] };
    const branchById = new Map((branches || []).map((b) => [b.id as number, b]));

    const projectIds = [...new Set((orders || []).map((o) => o.internal_project_id).filter(Boolean))] as string[];
    const { data: projects } = projectIds.length
      ? await sb.from("internal_projects").select("id, project_number").in("id", projectIds)
      : { data: [] };
    const projectById = new Map((projects || []).map((p) => [p.id as string, p]));

    const out = poRows.map((po) => {
      const inv = invByPo.get(po.id) || null;
      // Only show the rejection banner while the PO is open again (no active invoice).
      const lastRejection = !inv ? (rejectionByPo.get(po.id) || null) : null;
      const order = po.order_id ? orderById.get(po.order_id) : null;
      const branch = order?.invoicing_branch_id ? branchById.get(order.invoicing_branch_id) : null;
      const project = order?.internal_project_id ? projectById.get(order.internal_project_id) : null;
      const payableStatus = po.vendor_payable_id ? payableStatusById.get(po.vendor_payable_id) ?? null : null;
      const costApproved = payableStatus === "approved";
      return {
        id: po.id,
        po_number: po.po_number,
        order_id: po.order_id,
        order_number: order?.order_number ?? null,
        project_number: project?.project_number ?? null,
        delivered_on: order?.actual_delivery_date ?? order?.estimated_delivery_date ?? null,
        // Which Cethos company this work belongs to. One invoice bills one
        // company, so the picker groups by this and the vendor is told plainly
        // who they are invoicing before they commit.
        billing_entity: branch
          ? { id: branch.id, legal_name: branch.legal_name, tax_number: branch.tax_number ?? null, tax_label: branch.tax_label ?? null }
          : null,
        // can_invoice === false means the raise endpoint would refuse this PO.
        can_invoice: costApproved && !invByPo.get(po.id) && !!branch,
        not_ready_reason: !costApproved
          ? "cost_not_approved"
          : !branch
            ? "entity_missing"
            : invByPo.get(po.id)
              ? "already_invoiced"
              : null,
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
        last_rejection: lastRejection, // set when a prior invoice was rejected and the PO is open again
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
