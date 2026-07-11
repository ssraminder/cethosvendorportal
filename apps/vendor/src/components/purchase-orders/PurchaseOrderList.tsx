import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getPurchaseOrders,
  raiseInvoice,
  type VendorPurchaseOrder,
  type VendorTaxProfile,
} from "../../api/vendorPurchaseOrders";
import { FileText, Loader2, ClipboardList, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

const INV_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  submitted: { bg: "bg-blue-100", text: "text-blue-700", label: "Invoice submitted" },
  approved: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Approved" },
  paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
  draft: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
};

export function PurchaseOrderList() {
  const { sessionToken } = useVendorAuth();
  const [pos, setPos] = useState<VendorPurchaseOrder[]>([]);
  const [tax, setTax] = useState<VendorTaxProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await getPurchaseOrders(sessionToken);
      if (res.success) {
        setPos(res.purchase_orders || []);
        setTax(res.tax_profile || null);
      } else {
        setError(res.error || "Failed to load purchase orders");
      }
    } catch {
      setError("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

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
        <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          Raise an invoice for each purchase order Cethos has sent you. An invoice document is required.
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {pos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No purchase orders</p>
          <p className="text-sm">Purchase orders appear here once Cethos sends them for your accepted jobs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po) => (
            <PurchaseOrderCard
              key={po.id}
              po={po}
              tax={tax}
              open={openFor === po.id}
              onToggle={() => setOpenFor(openFor === po.id ? null : po.id)}
              onRaised={() => {
                setOpenFor(null);
                load();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PurchaseOrderCard({
  po,
  tax,
  open,
  onToggle,
  onRaised,
}: {
  po: VendorPurchaseOrder;
  tax: VendorTaxProfile | null;
  open: boolean;
  onToggle: () => void;
  onRaised: () => void;
}) {
  const { sessionToken } = useVendorAuth();
  const subtotal = po.subtotal ?? po.total ?? 0;
  const canCharge = !!tax?.tax_id && (tax?.tax_rate ?? 0) > 0;

  const [vendorRef, setVendorRef] = useState("");
  const [applyGst, setApplyGst] = useState<boolean>(canCharge);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const taxRate = canCharge ? (tax!.tax_rate as number) : 0;
  const taxAmount = applyGst ? Math.round((subtotal * (taxRate / 100) + Number.EPSILON) * 100) / 100 : 0;
  const total = Math.round((subtotal + taxAmount + Number.EPSILON) * 100) / 100;

  const alreadyRaised = !!po.invoice;
  const badge = po.invoice ? INV_BADGES[po.invoice.status] || INV_BADGES.submitted : null;

  async function submit() {
    if (!sessionToken) return;
    setFormError("");
    if (!vendorRef.trim()) return setFormError("Enter your invoice number.");
    if (!file) return setFormError("Attach your invoice document (PDF/scan).");
    setSubmitting(true);
    try {
      const res = await raiseInvoice(sessionToken, {
        poId: po.id,
        vendorInvoiceNumber: vendorRef.trim(),
        applyGst,
        file,
      });
      if (res.success) {
        onRaised();
      } else {
        setFormError(res.error || "Failed to raise invoice");
      }
    } catch {
      setFormError("Failed to raise invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-900">{po.po_number}</span>
            <span className="text-xs text-gray-400">
              {[po.step_name, po.source_language && po.target_language ? `${po.source_language} → ${po.target_language}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Amount {money(subtotal, po.currency)}
            {po.deadline ? ` · Due ${new Date(po.deadline).toLocaleDateString("en-CA")}` : ""}
          </div>
        </div>
        <div className="shrink-0">
          {alreadyRaised ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge!.bg} ${badge!.text}`}>{badge!.label}</span>
          ) : (
            <button
              onClick={onToggle}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              {open ? "Cancel" : "Raise invoice"}
            </button>
          )}
        </div>
      </div>

      {alreadyRaised && po.invoice && (
        <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          Invoice {po.invoice.vendor_invoice_number || po.invoice.invoice_number} received
          {po.invoice.submitted_at ? ` on ${new Date(po.invoice.submitted_at).toLocaleDateString("en-CA")}` : ""}.
        </div>
      )}

      {!alreadyRaised && po.last_rejection && (
        <div className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-semibold">Your previous invoice was not accepted.</span>{" "}
            {po.last_rejection.reason || "Please submit a corrected invoice."}
            {po.last_rejection.note ? (
              <span className="block mt-0.5 text-amber-700">Note: {po.last_rejection.note}</span>
            ) : null}
            <span className="block mt-0.5 text-amber-700">Please attach a proper invoice document (not a copy of the purchase order) and re-submit below.</span>
          </div>
        </div>
      )}

      {!alreadyRaised && open && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Your invoice number</label>
              <input
                value={vendorRef}
                onChange={(e) => setVendorRef(e.target.value)}
                placeholder="e.g. INV-2026-014"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Invoice document <span className="text-red-500">(required)</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 cursor-pointer hover:border-teal-400">
                <Upload className="h-4 w-4 text-gray-400" />
                <span className="truncate">{file ? file.name : "Choose PDF / scan…"}</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-gray-500">Subtotal (from PO)</span>
              <span className="text-gray-900">{money(subtotal, po.currency)}</span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <label className="flex items-center gap-2 text-gray-500">
                <input
                  type="checkbox"
                  disabled={!canCharge}
                  checked={applyGst}
                  onChange={(e) => setApplyGst(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                {tax?.tax_name || "GST"} {canCharge ? `(${taxRate}%)` : ""}
              </label>
              <span className="text-gray-900">{money(taxAmount, po.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 mt-1 pt-1.5 font-semibold">
              <span className="text-gray-700">Total</span>
              <span className="text-gray-900">{money(total, po.currency)}</span>
            </div>
            {!canCharge && (
              <p className="mt-2 text-xs text-amber-600">
                Add your GST/HST registration number on the Payment page to charge tax.
              </p>
            )}
          </div>

          {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={onToggle} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !vendorRef.trim() || !file}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
