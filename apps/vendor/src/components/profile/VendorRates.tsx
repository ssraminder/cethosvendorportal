import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  getFullProfile,
  updateRates,
  type VendorRate,
} from "../../api/vendorProfile";
import { DollarSign, Loader2, Send, X } from "lucide-react";

export function VendorRates() {
  const { sessionToken } = useVendorAuth();
  const [rates, setRates] = useState<VendorRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [proposedRate, setProposedRate] = useState("");
  const [rateNotes, setRateNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRates = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await getFullProfile(sessionToken);
      if (result.rates) {
        setRates(result.rates);
      }
    } catch {
      setError("Failed to load rates");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const handleRequestChange = async (rateId: string) => {
    if (!sessionToken || !proposedRate) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await updateRates(sessionToken, {
        rate_id: rateId,
        proposed_rate: parseFloat(proposedRate),
        notes: rateNotes || undefined,
      });
      if (result.success) {
        setSuccess("Rate change request submitted for admin review");
        setEditingId(null);
        setProposedRate("");
        setRateNotes("");
      } else {
        setError(result.error || "Failed to submit rate change request");
      }
    } catch {
      setError("Failed to submit rate change request");
    } finally {
      setSaving(false);
    }
  };

  const formatRate = (rate: number, currency: string, unit: string) => {
    const formatted = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
    }).format(rate);
    return `${formatted} / ${unit.replace("_", " ")}`;
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Rates</h1>
        <p className="text-sm text-gray-500 mt-1">
          {rates.length} rate{rates.length !== 1 ? "s" : ""} configured
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {rates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No rates configured</p>
          <p className="text-sm">Rates are set during the onboarding process.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Min. Charge
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Source
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rates.map((rate) => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {rate.service?.name || "Unknown Service"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {rate.service?.category || ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatRate(rate.rate, rate.currency, rate.calculation_unit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {rate.minimum_charge
                      ? formatRate(
                          rate.minimum_charge,
                          rate.currency,
                          rate.minimum_charge_unit || "job"
                        )
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        rate.source === "xtrf_competencies"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {rate.source === "xtrf_competencies" ? "System" : "Self-reported"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === rate.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="New rate"
                          value={proposedRate}
                          onChange={(e) => setProposedRate(e.target.value)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={rateNotes}
                          onChange={(e) => setRateNotes(e.target.value)}
                          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                        />
                        <button
                          onClick={() => handleRequestChange(rate.id)}
                          disabled={saving || !proposedRate}
                          className="rounded bg-teal-600 p-1.5 text-white hover:bg-teal-700 disabled:opacity-50"
                          title="Submit request"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setProposedRate("");
                            setRateNotes("");
                          }}
                          className="rounded border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingId(rate.id)}
                        className="text-sm text-teal-600 hover:text-teal-800"
                      >
                        Request Change
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
