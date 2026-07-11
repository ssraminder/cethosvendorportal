import { FUNCTIONS_BASE } from "./functionsBase";

const BASE = FUNCTIONS_BASE;

export interface VendorPOInvoiceRef {
  id: string;
  status: string;
  invoice_number: string | null;
  vendor_invoice_number: string | null;
  submitted_at: string | null;
}

export interface VendorPORejection {
  reason: string | null;
  note: string | null;
  rejected_at: string | null;
}

export interface VendorPurchaseOrder {
  id: string;
  po_number: string;
  order_id: string | null;
  workflow_step_id: string | null;
  step_name: string | null;
  service: string | null;
  source_language: string | null;
  target_language: string | null;
  rate: number | null;
  rate_unit: string | null;
  units: number | null;
  currency: string;
  subtotal: number | null;
  total: number | null;
  deadline: string | null;
  sent_at: string | null;
  has_pdf: boolean;
  invoice: VendorPOInvoiceRef | null;
  last_rejection: VendorPORejection | null;
}

export interface VendorTaxProfile {
  tax_id: string | null;
  tax_name: string | null;
  tax_rate: number | null;
}

interface GetPurchaseOrdersResponse {
  success?: boolean;
  purchase_orders?: VendorPurchaseOrder[];
  tax_profile?: VendorTaxProfile;
  error?: string;
}

export interface RaiseInvoiceResponse {
  success?: boolean;
  invoice_id?: string;
  invoice_number?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  status?: string;
  error?: string;
}

export async function getPurchaseOrders(token: string): Promise<GetPurchaseOrdersResponse> {
  const res = await fetch(`${BASE}/vendor-get-purchase-orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return res.json();
}

export async function raiseInvoice(
  token: string,
  args: { poId: string; vendorInvoiceNumber: string; applyGst: boolean; file: File },
): Promise<RaiseInvoiceResponse> {
  const form = new FormData();
  form.append("po_id", args.poId);
  form.append("vendor_invoice_number", args.vendorInvoiceNumber);
  form.append("apply_gst", args.applyGst ? "true" : "false");
  form.append("file", args.file);

  const res = await fetch(`${BASE}/vendor-raise-invoice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.json();
}
