import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getInvoices,
  getInvoicePdf,
  submitInvoice,
  type VendorInvoice,
} from "../../api/vendorInvoices";
import {
  ArrowLeft,
  Loader2,
  Download,
  FileText,
  Upload,
  Send,
  CheckCircle,
  X,
} from "lucide-react";

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { sessionToken } = useVendorAuth();
  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Submit form state
  const [vendorRef, setVendorRef] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInvoice = useCallback(async () => {
    if (!sessionToken || !id) return;
    try {
      const result = await getInvoices(sessionToken);
      const found = result.invoices?.find((i) => i.id === id);
      if (found) {
        setInvoice(found);
      } else {
        setError("Invoice not found");
      }
    } catch {
      setError("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [sessionToken, id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleDownloadPdf = async () => {
    if (!sessionToken || !id) return;
    setDownloading(true);
    try {
      const result = await getInvoicePdf(sessionToken, id);
      if (result.signed_url) {
        window.open(result.signed_url, "_blank");
      } else {
        setError(result.error || "PDF not available");
      }
    } catch {
      setError("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async () => {
    if (!sessionToken || !id || !vendorRef.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitInvoice(
        sessionToken,
        id,
        vendorRef.trim(),
        invoiceFile ?? undefined,
      );
      if (result.success) {
        setSubmitSuccess(true);
        await loadInvoice();
      } else {
        setError(result.error || "Failed to submit invoice");
      }
    } catch {
      setError("Failed to submit invoice");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        <p className="text-center text-gray-500">Invoice not found</p>
        <Link to="/invoices" className="block text-center text-teal-600 mt-2">
          Back to Invoices
        </Link>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    draft: "text-gray-500",
    pending: "text-amber-600",
    submitted: "text-blue-600",
    approved: "text-indigo-600",
    paid: "text-green-600",
    cancelled: "text-red-600",
  };

  const isDraft = invoice.status === "draft";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: invoice.currency || "CAD",
    }).format(n);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <Link
        to="/invoices"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Invoices
      </Link>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {submitSuccess && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Invoice submitted</p>
            <p className="text-sm text-green-700 mt-0.5">
              Your invoice has been submitted for processing. You'll be notified when payment is issued.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-gray-400" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {invoice.invoice_number}
                </h1>
                <p className="text-sm text-gray-500">
                  {new Date(invoice.invoice_date).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <span
              className={`text-sm font-bold uppercase ${
                statusColor[invoice.status] || "text-gray-600"
              }`}
            >
              {invoice.status}
            </span>
          </div>
        </div>

        {/* Order / job reference */}
        {(invoice.order_reference || invoice.description) && (
          <div className="border-b border-gray-100 px-6 py-4 bg-gray-50">
            <p className="text-sm text-gray-700 font-medium">
              {invoice.order_reference || invoice.description}
            </p>
          </div>
        )}

        {/* Amounts */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Subtotal</span>
              <p className="font-medium">{fmt(invoice.amount)}</p>
            </div>
            <div>
              <span className="text-gray-500">Tax</span>
              <p className="font-medium">{fmt(invoice.tax_amount)}</p>
            </div>
            <div>
              <span className="text-gray-500">Total</span>
              <p className="text-lg font-bold text-gray-900">
                {fmt(invoice.total_amount)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Currency</span>
              <p className="font-medium">{(invoice.currency || "CAD").toUpperCase()}</p>
            </div>
            {invoice.due_date && (
              <div>
                <span className="text-gray-500">Due Date</span>
                <p className="font-medium">
                  {new Date(invoice.due_date).toLocaleDateString("en-CA")}
                </p>
              </div>
            )}
          </div>

          {invoice.vendor_invoice_number && (
            <div className="text-sm">
              <span className="text-gray-500">Your Invoice #</span>
              <p className="font-medium">{invoice.vendor_invoice_number}</p>
            </div>
          )}

          {invoice.paid_at && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Paid on {new Date(invoice.paid_at).toLocaleDateString("en-CA")}
              {invoice.payment_method && ` via ${invoice.payment_method.replace("_", " ")}`}
              {invoice.payment_reference && ` (Ref: ${invoice.payment_reference})`}
            </div>
          )}

          {invoice.notes && (
            <div>
              <span className="text-sm text-gray-500">Notes</span>
              <p className="text-sm text-gray-700 mt-1">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Draft: submit form */}
        {isDraft && !submitSuccess && (
          <div className="border-t border-gray-100 p-6 bg-amber-50/50">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Submit this invoice for payment
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Review the amount above, enter your invoice reference number, and
              optionally attach your invoice document.
            </p>

            <div className="space-y-4">
              {/* Vendor invoice number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your invoice reference number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={vendorRef}
                  onChange={(e) => setVendorRef(e.target.value)}
                  placeholder="e.g. INV-2026-0042"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>

              {/* File upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice document <span className="text-gray-400">(optional)</span>
                </label>
                {invoiceFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700 truncate flex-1">
                      {invoiceFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-600 hover:border-teal-400 hover:text-teal-600 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Upload invoice PDF
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setInvoiceFile(f);
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  PDF, JPEG, PNG, or Word. Max 20 MB.
                </p>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !vendorRef.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Invoice
              </button>
            </div>
          </div>
        )}

        {/* Download (non-draft) */}
        {!isDraft && (
          <div className="border-t border-gray-100 p-6">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
