import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getInvoices, getInvoicePdf, type VendorInvoice } from "../../api/vendorInvoices";
import { ArrowLeft, Loader2, Download, FileText } from "lucide-react";

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { sessionToken } = useVendorAuth();
  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

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
    pending: "text-amber-600",
    submitted: "text-blue-600",
    approved: "text-indigo-600",
    paid: "text-green-600",
    cancelled: "text-red-600",
  };

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

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Subtotal</span>
              <p className="font-medium">
                {new Intl.NumberFormat("en-CA", {
                  style: "currency",
                  currency: invoice.currency || "CAD",
                }).format(invoice.amount)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Tax</span>
              <p className="font-medium">
                {new Intl.NumberFormat("en-CA", {
                  style: "currency",
                  currency: invoice.currency || "CAD",
                }).format(invoice.tax_amount)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Total</span>
              <p className="text-lg font-bold text-gray-900">
                {new Intl.NumberFormat("en-CA", {
                  style: "currency",
                  currency: invoice.currency || "CAD",
                }).format(invoice.total_amount)}
              </p>
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

        {/* Download */}
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
      </div>
    </div>
  );
}
