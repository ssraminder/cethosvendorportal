const BASE = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

// --- Types ---

export interface VendorInvoice {
  id: string;
  invoice_number: string;
  job_id: string | null;
  job_reference: string | null;
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

export type { InvoicesResponse, InvoicePdfResponse };

// --- API Functions ---

export async function getInvoices(
  token: string,
  filter?: { status?: string; page?: number; limit?: number }
): Promise<InvoicesResponse> {
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
