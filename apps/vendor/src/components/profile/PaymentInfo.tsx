import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getFullProfile,
  updatePaymentInfo,
  type PaymentInfo as PaymentInfoType,
} from "../../api/vendorProfile";
import { CurrencySelect } from "../shared/CurrencySelect";
import { CreditCard, Loader2, Save, CheckCircle } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "e_transfer", label: "Interac e-Transfer" },
  { value: "wire_transfer", label: "Wire Transfer" },
  { value: "paypal", label: "PayPal" },
  { value: "bank_transfer", label: "Direct Deposit / Bank Transfer" },
  { value: "wise", label: "Wise" },
  { value: "cheque", label: "Cheque" },
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

  // Payment details (varies by method)
  const [paypalEmail, setPaypalEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankTransitNumber, setBankTransitNumber] = useState("");
  const [bankInstitution, setBankInstitution] = useState("");
  const [bankSwiftCode, setBankSwiftCode] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [eTransferEmail, setETransferEmail] = useState("");
  const [wiseEmail, setWiseEmail] = useState("");
  const [chequeAddress, setChequeAddress] = useState("");

  const loadPaymentInfo = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await getFullProfile(sessionToken);
      if (result.payment_info) {
        setPaymentInfo(result.payment_info);
        setMethod(result.payment_info.payment_method || "");
        setCurrency(result.payment_info.payment_currency || "CAD");
        setInvoiceNotes(result.payment_info.invoice_notes || "");
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
      case "e_transfer":
        return { e_transfer_email: eTransferEmail };
      case "wise":
        return { wise_email: wiseEmail };
      case "cheque":
        return { mailing_address: chequeAddress };
      default:
        return {};
    }
  };

  const handleSave = async () => {
    if (!sessionToken) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await updatePaymentInfo(sessionToken, {
        payment_method: method || undefined,
        payment_details: method ? buildPaymentDetails() : undefined,
        payment_currency: currency,
        invoice_notes: invoiceNotes || undefined,
      });
      if (result.success) {
        setSuccess("Payment information saved successfully");
        if (result.payment_info) {
          setPaymentInfo(result.payment_info);
        }
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
        <h1 className="text-2xl font-bold text-gray-900">Payment Information</h1>
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

      <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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

        {method === "e_transfer" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              e-Transfer Email
            </label>
            <input
              type="email"
              value={eTransferEmail}
              onChange={(e) => setETransferEmail(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        )}

        {method === "wise" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wise Email or Account ID
            </label>
            <input
              type="text"
              value={wiseEmail}
              onChange={(e) => setWiseEmail(e.target.value)}
              placeholder="your-email@example.com or account ID"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
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

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Payment Info"}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
        <CreditCard className="inline h-4 w-4 mr-1" />
        Your payment details are encrypted and stored securely. They are never visible to other users.
      </div>
    </div>
  );
}
