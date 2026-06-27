import { FUNCTIONS_BASE } from "./functionsBase";

const BASE = FUNCTIONS_BASE;

// Prod routes through the same-origin /sb/* Netlify proxy; local dev hits
// the Supabase edge function directly. The proxy carries the session token
// in the body (text/plain → CORS simple request) so it survives regions
// that drop the OPTIONS preflight an Authorization header would trigger.
const SB_BASE =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "/sb"
    : null;

const FETCH_TIMEOUT_MS = 15_000;

// --- Types ---

export interface VendorInvoice {
  id: string;
  invoice_number: string;
  job_id: string | null;
  job_reference: string | null;
  step_id: string | null;
  amount: number;
  currency: string;
  tax_amount: number;
  total_amount: number;
  status: string;
  invoice_date: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  order_reference: string | null;
  description: string | null;
  vendor_invoice_number: string | null;
  vendor_invoice_file_path: string | null;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
}

interface InvoicesResponse {
  success?: boolean;
  invoices?: VendorInvoice[];
  total?: number;
  summary?: {
    total_earned: number;
    pending_amount: number;
    last_payment_date: string | null;
  };
  error?: string;
}

interface InvoicePdfResponse {
  success?: boolean;
  signed_url?: string;
  error?: string;
}

interface SubmitInvoiceResponse {
  success?: boolean;
  invoice_id?: string;
  status?: string;
  submitted_at?: string;
  error?: string;
}

export type { InvoicesResponse, InvoicePdfResponse, SubmitInvoiceResponse };

// --- API Functions ---

export async function getInvoices(
  token: string,
  filter?: { status?: string; page?: number; limit?: number }
): Promise<InvoicesResponse> {
  // Prod: same-origin /sb proxy, session token in the body, hard timeout
  // so the Invoices page can never hang on a dropped connection.
  if (SB_BASE) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${SB_BASE}/get-invoices`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          session_token: token,
          status: filter?.status,
          page: filter?.page,
          limit: filter?.limit,
        }),
        signal: controller.signal,
      });
      return (await res.json()) as InvoicesResponse;
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

  // Local dev: hit the Supabase edge function directly.
  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.page) params.set("page", filter.page.toString());
  if (filter?.limit) params.set("limit", filter.limit.toString());

  const qs = params.toString();
  const res = await fetch(`${BASE}/vendor-get-invoices${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getInvoicePdf(
  token: string,
  invoiceId: string
): Promise<InvoicePdfResponse> {
  const res = await fetch(`${BASE}/vendor-get-invoice-pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  return res.json();
}

export async function submitInvoice(
  token: string,
  invoiceId: string,
  vendorInvoiceNumber: string,
  file?: File
): Promise<SubmitInvoiceResponse> {
  const form = new FormData();
  form.append("invoice_id", invoiceId);
  form.append("vendor_invoice_number", vendorInvoiceNumber);
  if (file) form.append("file", file);

  const res = await fetch(`${BASE}/vendor-submit-invoice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.json();
}
