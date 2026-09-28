import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getPurchaseOrders,
  raiseInvoice,
  type VendorPurchaseOrder,
  type VendorTaxProfile,
  type VendorSelfBilling,
  type RaiseInvoiceResponse,
} from "../../api/vendorPurchaseOrders";
import { FileText, Loader2, ClipboardList, CheckCircle2, AlertTriangle, Building2 } from "lucide-react";

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

// Date-only strings ("2026-08-14") must be parsed as LOCAL dates —
// new Date("2026-08-14") is UTC midnight, which renders as the previous
// day in any western timezone.
function fmtLocalDate(val: string | null | undefined): string {
  if (!val) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(val) ? new Date(val + "T00:00:00") : new Date(val);
  return d.toLocaleDateString("en-CA");
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const INV_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  submitted: { bg: "bg-blue-100", text: "text-blue-700", label: "Invoice submitted" },
  approved: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Invoiced — with accounts" },
  paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
  draft: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
};

// Plain-language reasons for a PO the service would refuse today.
const NOT_READY_COPY: Record<string, string> = {
  cost_not_approved: "Awaiting Cethos sign-off",
  entity_missing: "Billing company not set — contact ap@cethos.com",
  already_invoiced: "Already invoiced",
};

// One invoice bills one Cethos company in one currency, so selection is
// confined to POs sharing both.
function groupKey(po: VendorPurchaseOrder): string {
  return `${po.billing_entity?.id ?? "none"}|${(po.currency || "USD").toUpperCase()}`;
}

interface RaisedSummary {
  invoiceNumber: string;
  vendorInvoiceNumber: string;
  poCount: number;
  total: number;
  currency: string;
}

export function PurchaseOrderList() {
  const { sessionToken } = useVendorAuth();
  const [pos, setPos] = useState<VendorPurchaseOrder[]>([]);
  const [tax, setTax] = useState<VendorTaxProfile | null>(null);
  const [selfBilling, setSelfBilling] = useState<VendorSelfBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [raised, setRaised] = useState<RaisedSummary | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setError("");
    const res = await getPurchaseOrders(sessionToken);
    if (res.success) {
      setPos(res.purchase_orders || []);
      setTax(res.tax_profile || null);
      setSelfBilling(res.self_billing ?? null);
    } else {
      setError(res.error || "Failed to load purchase orders");
    }
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

  // After a reload, drop anything that is no longer invoiceable.
  useEffect(() => {
    setSelected((cur) => cur.filter((id) => pos.some((p) => p.id === id && p.can_invoice)));
  }, [pos]);

  const selectedPos = useMemo(() => pos.filter((p) => selected.includes(p.id)), [pos, selected]);
  const activeKey = selectedPos.length ? groupKey(selectedPos[0]) : null;
  const invoiceable = useMemo(() => pos.filter((p) => p.can_invoice), [pos]);

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function selectAllReady() {
    const key = activeKey ?? (invoiceable[0] ? groupKey(invoiceable[0]) : null);
    if (!key) return;
    setSelected(invoiceable.filter((p) => groupKey(p) === key).map((p) => p.id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 pb-48">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tick the purchase orders you are billing and raise one invoice for them. Cethos prepares the
          invoice document for you — there is nothing to upload. One invoice covers one Cethos company and
          one currency.
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {raised && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="font-semibold">
              Invoice {raised.vendorInvoiceNumber} raised
              {raised.poCount > 1 ? ` for ${raised.poCount} purchase orders` : ""} —{" "}
              {money(raised.total, raised.currency)}.
            </p>
            <p className="mt-0.5 text-green-700">
              Cethos reference {raised.invoiceNumber}. It has gone straight to our accounts team; the PDF
              is on your{" "}
              <Link to="/invoices" className="font-medium underline">
                Invoices
              </Link>{" "}
              page.
            </p>
          </div>
          <button
            onClick={() => setRaised(null)}
            className="text-green-700 hover:text-green-900"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {pos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No purchase orders</p>
          <p className="text-sm">Purchase orders appear here once Cethos sends them for your accepted jobs.</p>
        </div>
      ) : (
        <>
          {invoiceable.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                {invoiceable.length} ready to invoice
                {selected.length ? ` · ${selected.length} selected` : ""}
              </span>
              <span className="flex items-center gap-3">
                {invoiceable.length > 1 && (
                  <button onClick={selectAllReady} className="font-medium text-teal-700 hover:underline">
                    Select all ready{activeKey ? " in this group" : ""}
                  </button>
                )}
                {selected.length > 0 && (
                  <button onClick={() => setSelected([])} className="font-medium text-gray-600 hover:underline">
                    Clear
                  </button>
                )}
              </span>
            </div>
          )}
          <div className="space-y-3">
            {pos.map((po) => (
              <PurchaseOrderCard
                key={po.id}
                po={po}
                checked={selected.includes(po.id)}
                disabledReason={
                  po.can_invoice && activeKey && groupKey(po) !== activeKey && !selected.includes(po.id)
                    ? "Different Cethos company or currency — raise this one on its own invoice."
                    : null
                }
                onToggle={() => toggle(po.id)}
              />
            ))}
          </div>
        </>
      )}

      {selectedPos.length > 0 && sessionToken && (
        <RaiseInvoicePanel
          token={sessionToken}
          pos={selectedPos}
          tax={tax}
          selfBilling={selfBilling}
          onClear={() => setSelected([])}
          onRaised={(summary) => {
            setRaised(summary);
            setSelected([]);
            load();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}

function PurchaseOrderCard({
  po,
  checked,
  disabledReason,
  onToggle,
}: {
  po: VendorPurchaseOrder;
  checked: boolean;
  disabledReason: string | null;
  onToggle: () => void;
}) {
  const subtotal = po.subtotal ?? po.total ?? 0;
  const inv = po.invoice;
  const badge = inv ? INV_BADGES[inv.status] || INV_BADGES.submitted : null;
  const meta = [
    po.step_name,
    po.source_language && po.target_language ? `${po.source_language} → ${po.target_language}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const refs = [po.project_number, po.order_number].filter(Boolean).join(" · ");
  const selectable = po.can_invoice && !disabledReason;

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden ${
        checked ? "border-teal-500 ring-1 ring-teal-500" : "border-gray-200"
      }`}
    >
      <label className={`flex items-start gap-3 p-4 ${selectable ? "cursor-pointer" : ""}`}>
        {po.can_invoice ? (
          <input
            type="checkbox"
            checked={checked}
            disabled={!!disabledReason}
            onChange={onToggle}
            title={disabledReason ?? undefined}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-40"
          />
        ) : (
          <span className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-900">{po.po_number}</span>
            {meta && <span className="text-xs text-gray-400">{meta}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
            <span>Amount {money(subtotal, po.currency)}</span>
            {refs && <span>{refs}</span>}
            {po.delivered_on && <span>Delivered {fmtLocalDate(po.delivered_on)}</span>}
            {po.billing_entity && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {po.billing_entity.legal_name}
              </span>
            )}
          </div>
          {disabledReason && <p className="mt-1 text-xs text-amber-600">{disabledReason}</p>}
        </div>
        <div className="shrink-0">
          {inv && badge ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          ) : !po.can_invoice && po.not_ready_reason ? (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {NOT_READY_COPY[po.not_ready_reason] ?? "Not ready"}
            </span>
          ) : (
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
              Ready to invoice
            </span>
          )}
        </div>
      </label>

      {inv && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          <span>
            Invoice {inv.vendor_invoice_number || inv.invoice_number}
            {inv.po_count > 1 ? ` (covers ${inv.po_count} purchase orders)` : ""}
            {inv.submitted_at ? ` raised on ${fmtLocalDate(inv.submitted_at)}` : ""}.
          </span>
          <Link to="/invoices" className="font-medium text-teal-700 hover:underline">
            View invoices
          </Link>
        </div>
      )}

      {!inv && po.last_rejection && (
        <div className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-semibold">Your previous invoice was not accepted.</span>{" "}
            {po.last_rejection.reason || "Please raise a corrected invoice."}
            {po.last_rejection.note ? (
              <span className="block mt-0.5 text-amber-700">Note: {po.last_rejection.note}</span>
            ) : null}
            <span className="block mt-0.5 text-amber-700">
              Tick this purchase order to raise a corrected invoice — no document upload is needed any more.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function RaiseInvoicePanel({
  token,
  pos,
  tax,
  selfBilling,
  onClear,
  onRaised,
}: {
  token: string;
  pos: VendorPurchaseOrder[];
  tax: VendorTaxProfile | null;
  selfBilling: VendorSelfBilling | null;
  onClear: () => void;
  onRaised: (summary: RaisedSummary) => void;
}) {
  const currency = (pos[0]?.currency || "USD").toUpperCase();
  const entity = pos[0]?.billing_entity ?? null;
  const canCharge = !!tax?.tax_id && (tax?.tax_rate ?? 0) > 0;
  const taxRate = canCharge ? (tax?.tax_rate ?? 0) : 0;

  const [vendorRef, setVendorRef] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [chargesTax, setChargesTax] = useState<boolean>(canCharge);
  const [accept, setAccept] = useState(false);
  // The service asks once per vendor; we only show the agreement while it
  // has not been accepted (or when the service tells us so with a 428).
  const [needsAcceptance, setNeedsAcceptance] = useState(!(selfBilling?.accepted ?? false));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setNeedsAcceptance(!(selfBilling?.accepted ?? false));
  }, [selfBilling]);

  const subtotal = round2(pos.reduce((s, p) => s + Number(p.subtotal ?? p.total ?? 0), 0));
  const taxAmount = chargesTax ? round2(subtotal * (taxRate / 100)) : 0;
  const total = round2(subtotal + taxAmount);
  const canSubmit = !submitting && vendorRef.trim().length > 0 && (!needsAcceptance || accept);

  async function submit() {
    setFormError("");
    if (!vendorRef.trim()) return setFormError("Enter your invoice number.");
    if (needsAcceptance && !accept) return setFormError("Please accept the self-billing agreement to continue.");
    setSubmitting(true);
    try {
      const res: RaiseInvoiceResponse = await raiseInvoice(token, {
        poIds: pos.map((p) => p.id),
        vendorInvoiceNumber: vendorRef.trim(),
        invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) ? invoiceDate : undefined,
        chargesTax,
        acceptSelfBilling: needsAcceptance && accept,
      });
      if (res.success) {
        onRaised({
          invoiceNumber: res.invoice_number ?? "",
          vendorInvoiceNumber: res.vendor_invoice_number ?? vendorRef.trim(),
          poCount: res.po_count ?? pos.length,
          total: res.total_amount ?? total,
          currency: res.currency ?? currency,
        });
        return;
      }
      if (res.code === "SELF_BILLING_NOT_ACCEPTED") {
        setNeedsAcceptance(true);
        setAccept(false);
      }
      setFormError(res.error || "Failed to raise invoice");
    } catch {
      setFormError("Failed to raise invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto max-h-[70vh] max-w-4xl overflow-y-auto px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Raise invoice · {pos.length} purchase order{pos.length === 1 ? "" : "s"}
            </h2>
            <p className="text-xs text-gray-500">
              {entity ? `Billed to ${entity.legal_name}` : "Billed to Cethos"} · {currency}
            </p>
          </div>
          <button onClick={onClear} className="text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
        </div>

        <ul className="mt-3 max-h-36 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50 text-sm">
          {pos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="min-w-0 truncate text-gray-700">
                <span className="font-medium text-gray-900">{p.po_number}</span>
                {p.step_name ? ` · ${p.step_name}` : ""}
                {p.project_number || p.order_number ? ` · ${p.project_number ?? p.order_number}` : ""}
              </span>
              <span className="shrink-0 text-gray-900">{money(p.subtotal ?? p.total, p.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Your invoice number</label>
            <input
              value={vendorRef}
              onChange={(e) => setVendorRef(e.target.value)}
              placeholder="e.g. INV-2026-014"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Invoice date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">Subtotal (from purchase orders)</span>
            <span className="text-gray-900">{money(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <label className="flex items-center gap-2 text-gray-500">
              <input
                type="checkbox"
                disabled={!canCharge}
                checked={chargesTax}
                onChange={(e) => setChargesTax(e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              {tax?.tax_name || "GST"} {canCharge ? `(${taxRate}%)` : ""}
            </label>
            <span className="text-gray-900">{money(taxAmount, currency)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-gray-100 pt-1.5 font-semibold">
            <span className="text-gray-700">Total</span>
            <span className="text-gray-900">{money(total, currency)}</span>
          </div>
          {!canCharge && (
            <p className="mt-2 text-xs text-amber-600">
              Add your tax registration number on the Payment page to charge tax.
            </p>
          )}
        </div>

        {needsAcceptance && (
          <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm">
            <p className="font-semibold text-teal-900">{selfBilling?.title || "Self-billing agreement"}</p>
            <p className="mt-1 text-xs leading-relaxed text-teal-900/80">
              {selfBilling?.content ||
                "Cethos may prepare and issue invoices in your name for work you have delivered and which has been accepted, based on the purchase orders you select."}
            </p>
            <label className="mt-2 flex items-start gap-2 text-sm text-teal-900">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span>
                I accept the self-billing agreement
                {selfBilling?.version ? ` (${selfBilling.version})` : ""}. We ask this once.
              </span>
            </label>
          </div>
        )}

        {formError && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClear} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Raise invoice
          </button>
        </div>
      </div>
    </div>
  );
}
