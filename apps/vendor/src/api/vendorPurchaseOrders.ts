import { FUNCTIONS_BASE } from "./functionsBase";

const BASE = FUNCTIONS_BASE;

// Prod routes through the same-origin /sb/* proxy (Vercel api/sb.ts → the
// Netlify-style handlers → api.cethos.com) — direct calls to api.cethos.com
// are geo-blocked or preflight-filtered on some vendors' networks. Local dev
// hits the Supabase edge function directly.
const SB_BASE =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "/sb"
    : null;

const FETCH_TIMEOUT_MS = 20_000;
// Raising also renders the invoice PDF server-side, so give it longer.
const RAISE_TIMEOUT_MS = 45_000;

export interface VendorPOInvoiceRef {
  id: string;
  status: string;
  invoice_number: string | null;
  vendor_invoice_number: string | null;
  submitted_at: string | null;
  /** How many purchase orders share that invoice (1 = single-PO invoice). */
  po_count: number;
}

export interface VendorPORejection {
  reason: string | null;
  note: string | null;
  rejected_at: string | null;
}

/** The Cethos company the work was ordered by — one invoice bills one company. */
export interface VendorBillingEntity {
  id: number;
  legal_name: string;
  tax_number: string | null;
  tax_label: string | null;
}

/** Why a PO cannot be invoiced yet. Mirrors vendor-get-purchase-orders. */
export type PONotReadyReason = "cost_not_approved" | "entity_missing" | "already_invoiced";

export interface VendorPurchaseOrder {
  id: string;
  po_number: string;
  order_id: string | null;
  order_number: string | null;
  project_number: string | null;
  delivered_on: string | null;
  billing_entity: VendorBillingEntity | null;
  /** false means the raise endpoint would refuse this PO — see not_ready_reason. */
  can_invoice: boolean;
  not_ready_reason: PONotReadyReason | null;
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

/** The self-billing agreement the vendor accepts once before Cethos writes invoices in their name. */
export interface VendorSelfBilling {
  version: string;
  title: string;
  content: string;
  accepted: boolean;
  accepted_at: string | null;
}

interface GetPurchaseOrdersResponse {
  success?: boolean;
  purchase_orders?: VendorPurchaseOrder[];
  tax_profile?: VendorTaxProfile;
  self_billing?: VendorSelfBilling | null;
  error?: string;
}

export type RaiseInvoiceErrorCode =
  | "INVOICE_NUMBER_USED"
  | "PO_NOT_FOUND"
  | "PO_NOT_YOURS"
  | "PO_NOT_OPEN"
  | "PO_NOT_READY"
  | "PO_ALREADY_INVOICED"
  | "MIXED_CURRENCY"
  | "MIXED_ENTITY"
  | "INVOICING_ENTITY_MISSING"
  | "TAX_REGISTRATION_REQUIRED"
  | "TAX_RATE_MISSING"
  | "SELF_BILLING_NOT_ACCEPTED"
  | "ZERO_TOTAL";

export interface RaiseInvoiceResponse {
  success?: boolean;
  code?: RaiseInvoiceErrorCode | string;
  error?: string;
  po_number?: string | null;
  terms_version?: string;
  invoice_id?: string;
  invoice_number?: string;
  vendor_invoice_number?: string;
  po_count?: number;
  po_numbers?: string[];
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  invoice_date?: string;
  due_date?: string;
  status?: string;
  pdf_storage_path?: string | null;
}

export interface RaiseInvoiceArgs {
  /** One or more POs — same Cethos company and currency. */
  poIds: string[];
  /** The vendor's own invoice reference; unique for them. */
  vendorInvoiceNumber: string;
  /** YYYY-MM-DD; the service defaults to today when omitted. */
  invoiceDate?: string;
  /** Vendor is tax-registered and charging tax at their profile rate. */
  chargesTax: boolean;
  /** Required the first time only; recorded against the agreement version. */
  acceptSelfBilling: boolean;
}

const NETWORK_ERROR =
  "Couldn't reach the server. This is usually a network or VPN issue — please try again.";
const TIMEOUT_ERROR = "The request timed out. Please check your connection and try again.";

// Shared JSON POST with a hard timeout so neither page can hang on a dropped
// connection. Throws on network failure / non-JSON reply; HTTP error statuses
// with a JSON body are returned as-is so callers see the service's message.
async function postJson<T>(url: string, token: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function describeFailure(e: unknown): string {
  return e instanceof DOMException && e.name === "AbortError" ? TIMEOUT_ERROR : NETWORK_ERROR;
}

export async function getPurchaseOrders(token: string): Promise<GetPurchaseOrdersResponse> {
  const url = SB_BASE ? `${SB_BASE}/get-purchase-orders` : `${BASE}/vendor-get-purchase-orders`;
  try {
    return await postJson<GetPurchaseOrdersResponse>(url, token, {}, FETCH_TIMEOUT_MS);
  } catch (e) {
    return { success: false, error: describeFailure(e) };
  }
}

// Nothing is uploaded any more: Cethos generates the invoice from the
// purchase orders themselves (self-billing). The body is plain JSON, which
// is also the only shape that survives the /sb adapter intact — multipart
// did not, which is how the old upload form went dark on 2026-09-17.
export async function raiseInvoice(token: string, args: RaiseInvoiceArgs): Promise<RaiseInvoiceResponse> {
  const payload = {
    po_ids: args.poIds,
    vendor_invoice_number: args.vendorInvoiceNumber,
    invoice_date: args.invoiceDate,
    charges_tax: args.chargesTax,
    accept_self_billing: args.acceptSelfBilling,
  };

  // Same-origin proxy first; only a network-level failure (not an HTTP error)
  // falls back to the direct edge call.
  if (SB_BASE) {
    try {
      return await postJson<RaiseInvoiceResponse>(`${SB_BASE}/raise-invoice`, token, payload, RAISE_TIMEOUT_MS);
    } catch {
      // fall through to the direct edge call
    }
  }

  try {
    return await postJson<RaiseInvoiceResponse>(`${BASE}/vendor-raise-invoice`, token, payload, RAISE_TIMEOUT_MS);
  } catch (e) {
    return { success: false, error: describeFailure(e) };
  }
}
