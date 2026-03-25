import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getInvoices, type VendorInvoice } from "../../api/vendorInvoices";
import { FileText, Loader2, DollarSign, ChevronRight } from "lucide-react";

type FilterKey = "all" | "pending" | "paid";

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
  submitted: { bg: "bg-blue-100", text: "text-blue-700", label: "Submitted" },
  approved: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Approved" },
  paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
};

export function InvoiceList() {
  const { sessionToken } = useVendorAuth();
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const loadInvoices = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await getInvoices(sessionToken);
      if (result.invoices) {
        setInvoices(result.invoices);
      }
    } catch {
      setError("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filtered =
    filter === "all"
      ? invoices
      : filter === "pending"
      ? invoices.filter((i) => ["pending", "submitted", "approved"].includes(i.status))
      : invoices.filter((i) => i.status === "paid");

  // Summary stats
  const totalEarned = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total_amount, 0);
  const pendingAmount = invoices
    .filter((i) => ["pending", "submitted", "approved"].includes(i.status))
    .reduce((sum, i) => sum + i.total_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Earned</div>
          <div className={`mt-2 text-2xl font-bold ${totalEarned > 0 ? "text-green-600" : "text-gray-900"}`}>
            {new Intl.NumberFormat("en-CA", {
              style: "currency",
              currency: "CAD",
            }).format(totalEarned)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending</div>
          <div className={`mt-2 text-2xl font-bold ${pendingAmount > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {new Intl.NumberFormat("en-CA", {
              style: "currency",
              currency: "CAD",
            }).format(pendingAmount)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Invoices</div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{invoices.length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["all", "pending", "paid"] as FilterKey[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm border-b-[3px] transition-colors ${
              filter === f
                ? "border-teal-600 text-teal-600 font-semibold"
                : "border-transparent text-gray-600 font-medium hover:text-gray-800"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No invoices</p>
          <p className="text-sm">Invoices will appear here after completed jobs.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">

                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((invoice) => {
                const badge = STATUS_BADGES[invoice.status] || STATUS_BADGES.pending;
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {invoice.invoice_number}
                        </span>
                      </div>
                      {invoice.job_reference && (
                        <span className="text-xs text-gray-400 ml-6">
                          Job: {invoice.job_reference}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(invoice.invoice_date).toLocaleDateString("en-CA")}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {new Intl.NumberFormat("en-CA", {
                        style: "currency",
                        currency: invoice.currency || "CAD",
                      }).format(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                      {invoice.paid_at && (
                        <span className="block text-xs text-gray-400 mt-0.5">
                          Paid {new Date(invoice.paid_at).toLocaleDateString("en-CA")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="text-teal-600 hover:text-teal-800"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
