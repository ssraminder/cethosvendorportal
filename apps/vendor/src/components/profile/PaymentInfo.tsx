import { useState, useEffect, useCallback, useMemo } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getFullProfile,
  updatePaymentInfo,
  type PaymentInfo as PaymentInfoType,
} from "../../api/vendorProfile";
import { CurrencySelect } from "../shared/CurrencySelect";
import { CalendarClock, CreditCard, Loader2, Save, CheckCircle, AlertTriangle } from "lucide-react";

// Product-approved methods only (2026-05-16: "direct deposit, wire
// transfer, cheque, paypal should work. no other payment method").
// 'wise' is grandfathered at the DB layer for ~8 legacy rows but is
// intentionally NOT in this dropdown — those vendors must re-pick one
// of the four below on their next save. The Netlify update-payment-info
// VALID_METHODS Set + the DB CHECK constraint both enforce this.
const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Direct Deposit / Bank Transfer" },
  { value: "wire_transfer", label: "Wire Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "paypal", label: "PayPal" },
] as const;

export function PaymentInfo() {
  const { sessionToken } = useVendorAuth();
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfoType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [method, setMethod] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  // Cooling-off acknowledgement — required for any payout-routing change
  // on a vendor that already has payment_info on file.
  const [changeAcknowledged, setChangeAcknowledged] = useState(false);

  // Payment details (varies by method). e_transfer + wise removed
  // 2026-05-16 per product directive (see PAYMENT_METHODS comment).
  const [paypalEmail, setPaypalEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankTransitNumber, setBankTransitNumber] = useState("");
  const [bankInstitution, setBankInstitution] = useState("");
  const [bankSwiftCode, setBankSwiftCode] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [chequeAddress, setChequeAddress] = useState("");

  // Snapshot of original values so we can detect "did payout-routing fields
  // actually change?" rather than nagging on every save click.
  const [originalSnapshot, setOriginalSnapshot] = useState<{
    method: string;
    currency: string;
  } | null>(null);

  const loadPaymentInfo = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await getFullProfile(sessionToken);
      if (result.payment_info) {
        setPaymentInfo(result.payment_info);
        setMethod(result.payment_info.payment_method || "");
        setCurrency(result.payment_info.payment_currency || "CAD");
        setInvoiceNotes(result.payment_info.invoice_notes || "");
        setOriginalSnapshot({
          method: result.payment_info.payment_method || "",
          currency: result.payment_info.payment_currency || "CAD",
        });
      }
    } catch {
      setError("Failed to load payment information");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadPaymentInfo();
  }, [loadPaymentInfo]);

  const buildPaymentDetails = (): Record<string, unknown> => {
    switch (method) {
      case "paypal":
        return { paypal_email: paypalEmail };
      case "bank_transfer":
        return {
          bank_name: bankName,
          account_number: bankAccountNumber,
          transit_number: bankTransitNumber,
          institution_number: bankInstitution,
        };
      case "wire_transfer":
        return {
          bank_name: bankName,
          account_number: bankAccountNumber,
          transit_number: bankTransitNumber,
          institution_number: bankInstitution,
          swift_code: bankSwiftCode,
          bank_address: bankAddress,
        };
      case "cheque":
        return { mailing_address: chequeAddress };
      default:
        return {};
    }
  };

  // Does the form differ from what's on file in a way that affects payouts?
  // Currency + method changes do. payment_details changes for the active
  // method do too; we keep it conservative and treat any field-level edit
  // on the active method as a payout-routing change.
  const isPayoutChange = useMemo(() => {
    if (!paymentInfo || !originalSnapshot) return false;
    if (method !== originalSnapshot.method) return true;
    if (currency !== originalSnapshot.currency) return true;
    // For the active method, treat any value present as potentially changed.
    // Server re-checks on submit, so this is just for showing the warning.
    const details = buildPaymentDetails();
    return Object.values(details).some((v) => typeof v === "string" && v.length > 0);
  }, [paymentInfo, originalSnapshot, method, currency, paypalEmail, bankName, bankAccountNumber, bankTransitNumber, bankInstitution, bankSwiftCode, bankAddress, chequeAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsAcknowledgement = isPayoutChange;
  const saveDisabled = saving || (needsAcknowledgement && !changeAcknowledged);

  const handleSave = async () => {
    if (!sessionToken) return;
    if (needsAcknowledgement && !changeAcknowledged) {
      setError("Please confirm the cooling-off notice before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await updatePaymentInfo(sessionToken, {
        payment_method: method || undefined,
        payment_details: method ? buildPaymentDetails() : undefined,
        payment_currency: currency,
        invoice_notes: invoiceNotes || undefined,
        change_acknowledged: needsAcknowledgement ? changeAcknowledged : undefined,
      });
      if (result.success) {
        setSuccess("Payment information saved successfully");
        if (result.payment_info) {
          setPaymentInfo(result.payment_info);
          setOriginalSnapshot({
            method: result.payment_info.payment_method || "",
            currency: result.payment_info.payment_currency || "CAD",
          });
        }
        setChangeAcknowledged(false);
      } else {
        setError(result.error || "Failed to save payment information");
      }
    } catch {
      setError("Failed to save payment information");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Payment Information</h1>
        <p className="text-sm text-gray-500 mt-1">
          {paymentInfo ? "Update your payment details" : "Set up your payment details to receive payments"}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">Select a payment method</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Method-specific fields */}
        {method === "paypal" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PayPal Email
            </label>
            <input
              type="email"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        )}

        {method === "bank_transfer" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Institution #
                </label>
                <input
                  type="text"
                  value={bankInstitution}
                  onChange={(e) => setBankInstitution(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transit #
                </label>
                <input
                  type="text"
                  value={bankTransitNumber}
                  onChange={(e) => setBankTransitNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account #
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        )}

        {method === "wire_transfer" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account #
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SWIFT / Routing Code
                </label>
                <input
                  type="text"
                  value={bankSwiftCode}
                  onChange={(e) => setBankSwiftCode(e.target.value)}
                  placeholder="e.g., BOFAUS3N"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Address
              </label>
              <textarea
                value={bankAddress}
                onChange={(e) => setBankAddress(e.target.value)}
                rows={2}
                placeholder="Full bank address..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        )}

        {method === "cheque" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mailing Address
            </label>
            <textarea
              value={chequeAddress}
              onChange={(e) => setChequeAddress(e.target.value)}
              rows={3}
              placeholder="Full mailing address for cheque delivery..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        )}

        <hr className="border-gray-200" />

        {/* Payment Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Currency
          </label>
          <p className="text-xs text-gray-500 mb-2">
            The currency you want to receive payments in. This can differ from your rate currency.
          </p>
          <CurrencySelect
            value={currency}
            onChange={setCurrency}
            placeholder="Select payment currency..."
          />
        </div>

        {/* Invoice Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Invoice Notes
          </label>
          <textarea
            value={invoiceNotes}
            onChange={(e) => setInvoiceNotes(e.target.value)}
            rows={3}
            placeholder="Notes to include on all invoices..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Payment Terms — read-only Cethos-wide default. */}
        <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <CalendarClock className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-gray-900">Payment terms:</span>{" "}
            <span className="text-gray-700">
              NET {paymentInfo?.payment_terms_days ?? 45} from invoice
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              Cethos pays approved invoices within {paymentInfo?.payment_terms_days ?? 45} days of issue. Contact <a href="mailto:vm@cethos.com" className="text-teal-700 hover:underline">vm@cethos.com</a> to discuss custom terms.
            </p>
          </div>
        </div>

        {/* Cooling-off acknowledgement — only shown when there's already
            payment info on file AND the form has payout-routing changes. */}
        {needsAcknowledgement && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-medium">Heads up — this change applies from the next payment cycle.</p>
                <p className="mt-1 text-amber-800">
                  Any invoices processed in the <strong>last 15 days</strong>, including ones not yet remitted, will still be paid to your previous payout details. New payouts route to the updated details from today onward.
                </p>
                <label className="mt-2 flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={changeAcknowledged}
                    onChange={(e) => setChangeAcknowledged(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-amber-900">
                    I understand and accept that this change does not affect payments processed in the last 15 days.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-start pt-2">
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Payment Info"}
          </button>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-2.5 p-4 bg-gray-50 rounded-lg border-l-4 border-teal-400 mt-4">
          <CreditCard className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-600">
            Your payment details are encrypted and stored securely. They are never visible to other users.
          </p>
        </div>
      </div>
    </div>
  );
}
