import { FUNCTIONS_BASE } from "./functionsBase";

const BASE = FUNCTIONS_BASE;

// Prod routes through the same-origin /sb/* Netlify proxy — direct calls to
// api.cethos.com are geo-blocked or preflight-filtered on some vendors'
// networks (the reason every other portal endpoint already rides /sb).
// Local dev hits the Supabase edge function directly.
const SB_BASE =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "/sb"
    : null;

const FETCH_TIMEOUT_MS = 20_000;

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
  const url = SB_BASE ? `${SB_BASE}/get-purchase-orders` : `${BASE}/vendor-get-purchase-orders`;
  // Hard timeout so the PO page can never hang on a dropped connection.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
    return (await res.json()) as GetPurchaseOrdersResponse;
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof DOMException && e.name === "AbortError"
          ? "The request timed out. Please check your connection and try again."
          : "Couldn't reach the server. This is usually a network or VPN issue — please try again.",
    };
  } finally {
    clearTimeout(timeout);
  }
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

  // Same-origin /sb proxy first (survives geo-blocked networks). The Netlify
  // Lambda payload cap (~4.5 MB effective for multipart) is below the edge
  // function's 20 MB limit, so on 413 fall back to the direct edge call —
  // better a large file occasionally needing the direct path than the whole
  // flow being dead on filtered networks.
  if (SB_BASE) {
    try {
      const res = await fetch(`${SB_BASE}/raise-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.status !== 413) return (await res.json()) as RaiseInvoiceResponse;
    } catch {
      // fall through to the direct edge call
    }
  }

  const res = await fetch(`${BASE}/vendor-raise-invoice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.json();
}
