import { useState, useEffect, useCallback, useMemo } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  manageRates,
  type ManagedRate,
  type ServiceOption,
} from "../../api/vendorProfile";
import { SearchableSelect, type SelectOption } from "../shared/SearchableSelect";
import { formatCurrencyLabel, CURRENCIES } from "../../data/currencies";
import {
  DollarSign,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

// --- Display label maps ---

const UNIT_LABELS: Record<string, string> = {
  per_word: "Per Word",
  per_hour: "Per Hour",
  per_page: "Per Page",
  per_minute: "Per Minute",
  flat: "Flat Rate",
};

const CATEGORY_LABELS: Record<string, string> = {
  translation: "Translation",
  review_qa: "Review & QA",
  interpretation: "Interpretation",
  multimedia: "Multimedia",
  technology: "Technology",
  other: "Other",
};

const CATEGORY_ORDER = [
  "translation",
  "review_qa",
  "interpretation",
  "multimedia",
  "technology",
  "other",
];

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

// --- Add/Edit Modal ---

interface RateModalProps {
  mode: "add" | "edit";
  servicesByCategory: Record<string, ServiceOption[]>;
  defaultCurrency: string;
  editingRate: ManagedRate | null;
  onClose: () => void;
  onSave: (data: {
    action: "add" | "update";
    service_id?: string;
    calculation_unit?: string;
    rate: number;
    currency?: string;
    minimum_charge?: number;
    notes?: string;
    rate_id?: string;
  }) => Promise<string | null>;
}

function RateModal({
  mode,
  servicesByCategory,
  defaultCurrency,
  editingRate,
  onClose,
  onSave,
}: RateModalProps) {
  const [serviceId, setServiceId] = useState(editingRate?.service_id || "");
  const [unit, setUnit] = useState(editingRate?.calculation_unit || "");
  const [rate, setRate] = useState(editingRate ? editingRate.rate.toString() : "");
  const currency = defaultCurrency || "CAD";
  const [minCharge, setMinCharge] = useState(
    editingRate?.minimum_charge?.toString() || ""
  );
  const [notes, setNotes] = useState(editingRate?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Build service options grouped by category
  const serviceOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [];
    for (const cat of CATEGORY_ORDER) {
      const services = servicesByCategory[cat];
      if (!services) continue;
      for (const svc of services) {
        opts.push({
          value: svc.id,
          label: svc.name,
          group: CATEGORY_LABELS[cat] || cat,
        });
      }
    }
    return opts;
  }, [servicesByCategory]);

  // Get available units for the selected service
  const selectedService = useMemo(() => {
    for (const services of Object.values(servicesByCategory)) {
      const found = services.find((s) => s.id === serviceId);
      if (found) return found;
    }
    return null;
  }, [servicesByCategory, serviceId]);

  const unitOptions: SelectOption[] = useMemo(() => {
    if (!selectedService) return [];
    return selectedService.default_calculation_units.map((u) => ({
      value: u,
      label: UNIT_LABELS[u] || u,
    }));
  }, [selectedService]);

  // Auto-select first unit when service changes
  useEffect(() => {
    if (mode === "add" && unitOptions.length > 0 && !unitOptions.find((o) => o.value === unit)) {
      setUnit(unitOptions[0].value);
    }
  }, [unitOptions, unit, mode]);

  async function handleSave() {
    const rateNum = parseFloat(rate);
    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      setError("Rate must be a positive number");
      return;
    }

    if (mode === "add" && (!serviceId || !unit)) {
      setError("Please select a service and unit");
      return;
    }

    setSaving(true);
    setError("");

    const minChargeNum = minCharge ? parseFloat(minCharge) : undefined;

    const err = await onSave(
      mode === "add"
        ? {
            action: "add",
            service_id: serviceId,
            calculation_unit: unit,
            rate: rateNum,
            currency,
            minimum_charge: minChargeNum,
            notes: notes.trim() || undefined,
          }
        : {
            action: "update",
            rate_id: editingRate!.id,
            rate: rateNum,
            minimum_charge: minChargeNum,
            notes: notes.trim() || undefined,
          }
    );

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === "add" ? "Add Service Rate" : "Edit Rate"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Service */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Service
            </label>
            {mode === "edit" ? (
              <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {editingRate?.service_name}
              </div>
            ) : (
              <SearchableSelect
                options={serviceOptions}
                value={serviceId}
                onChange={setServiceId}
                placeholder="Select a service..."
              />
            )}
          </div>

          {/* Unit */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Unit
            </label>
            {mode === "edit" ? (
              <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {UNIT_LABELS[editingRate?.calculation_unit || ""] || editingRate?.calculation_unit}
              </div>
            ) : (
              <SearchableSelect
                options={unitOptions}
                value={unit}
                onChange={setUnit}
                placeholder="Select unit..."
                disabled={!serviceId}
              />
            )}
          </div>

          {/* Rate */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Rate
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none"
            />
          </div>

          {/* Currency (read-only, from profile) */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Currency
            </label>
            <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500">
              {formatCurrencyLabel(CURRENCIES.find((c) => c.code === currency) || { code: currency, name: currency, symbol: "" })}
              <span className="text-xs text-gray-400 ml-2">(set in Profile)</span>
            </div>
          </div>

          {/* Minimum Charge */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Minimum Charge (optional)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={minCharge}
              onChange={(e) => setMinCharge(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder='e.g., "Rush surcharge +25%"'
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0F9DA0] rounded-lg hover:bg-[#0d7f82] disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "add" ? "Add Rate" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Remove Confirmation Dialog ---

interface RemoveDialogProps {
  rate: ManagedRate;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function RemoveDialog({ rate, onClose, onConfirm }: RemoveDialogProps) {
  const [removing, setRemoving] = useState(false);

  async function handleConfirm() {
    setRemoving(true);
    await onConfirm();
    setRemoving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-6 py-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Remove Rate
          </h3>
          <p className="text-sm text-gray-600">
            Remove your rate for{" "}
            <span className="font-medium">{rate.service_name}</span>{" "}
            ({UNIT_LABELS[rate.calculation_unit] || rate.calculation_unit})?
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={removing}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={removing}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {removing && <Loader2 className="w-4 h-4 animate-spin" />}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export function VendorRates() {
  const { sessionToken } = useVendorAuth();
  const [rates, setRates] = useState<ManagedRate[]>([]);
  const [servicesByCategory, setServicesByCategory] = useState<
    Record<string, ServiceOption[]>
  >({});
  const [preferredCurrency, setPreferredCurrency] = useState("CAD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingRate, setEditingRate] = useState<ManagedRate | null>(null);
  const [removingRate, setRemovingRate] = useState<ManagedRate | null>(null);

  const loadRates = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await manageRates(sessionToken, { action: "get" });
      if (result.error) {
        setError(result.error);
      } else {
        setRates(result.rates || []);
        setServicesByCategory(result.services_by_category || {});
        setPreferredCurrency(result.preferred_rate_currency || "CAD");
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

  // Clear success message after 4 seconds
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  // Group rates by category
  const ratesByCategory = useMemo(() => {
    const grouped: Record<string, ManagedRate[]> = {};
    for (const rate of rates) {
      const cat = rate.service_category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(rate);
    }
    return grouped;
  }, [rates]);

  async function handleSaveRate(data: {
    action: "add" | "update";
    service_id?: string;
    calculation_unit?: string;
    rate: number;
    currency?: string;
    minimum_charge?: number;
    notes?: string;
    rate_id?: string;
  }): Promise<string | null> {
    if (!sessionToken) return "Not authenticated";
    const result = await manageRates(sessionToken, data);
    if (result.error) return result.error;

    setSuccess(
      data.action === "add" ? "Rate added successfully" : "Rate updated successfully"
    );
    await loadRates();
    return null;
  }

  async function handleRemoveRate() {
    if (!sessionToken || !removingRate) return;
    setError("");
    const result = await manageRates(sessionToken, {
      action: "remove",
      rate_id: removingRate.id,
    });
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Rate removed successfully");
      await loadRates();
    }
    setRemovingRate(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            My Services & Rates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {rates.length} service{rates.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRate(null);
            setModalMode("add");
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F9DA0] rounded-lg hover:bg-[#0d7f82]"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Empty state */}
      {rates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium text-gray-600">
            You haven&apos;t added any services yet
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Click &quot;Add Service&quot; to set up your rate card.
          </p>
          <button
            onClick={() => {
              setEditingRate(null);
              setModalMode("add");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F9DA0] rounded-lg hover:bg-[#0d7f82]"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      ) : (
        /* Rate cards grouped by category */
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const catRates = ratesByCategory[cat];
            if (!catRates || catRates.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {CATEGORY_LABELS[cat] || cat}
                </h2>
                <div className="space-y-3">
                  {catRates.map((rate) => (
                    <div
                      key={rate.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {rate.service_name}
                            </h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              Active
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Rate:{" "}
                            <span className="font-medium">
                              {formatCurrency(rate.rate, rate.currency)}
                            </span>{" "}
                            / {(UNIT_LABELS[rate.calculation_unit] || rate.calculation_unit).toLowerCase()}{" "}
                            <span className="text-gray-400">({rate.currency})</span>
                          </p>
                          {rate.minimum_charge != null && rate.minimum_charge > 0 && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              Minimum charge:{" "}
                              <span className="font-medium">
                                {formatCurrency(rate.minimum_charge, rate.currency)}
                              </span>
                            </p>
                          )}
                          {rate.notes && (
                            <p className="text-xs text-gray-400 mt-1 italic">
                              {rate.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-4 shrink-0">
                          <button
                            onClick={() => {
                              setEditingRate(rate);
                              setModalMode("edit");
                            }}
                            className="p-2 text-gray-400 hover:text-[#0F9DA0] hover:bg-[#0F9DA0]/5 rounded-lg"
                            title="Edit rate"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRemovingRate(rate)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Remove rate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalMode && (
        <RateModal
          mode={modalMode}
          servicesByCategory={servicesByCategory}
          defaultCurrency={preferredCurrency}
          editingRate={modalMode === "edit" ? editingRate : null}
          onClose={() => {
            setModalMode(null);
            setEditingRate(null);
          }}
          onSave={handleSaveRate}
        />
      )}

      {/* Remove Confirmation */}
      {removingRate && (
        <RemoveDialog
          rate={removingRate}
          onClose={() => setRemovingRate(null)}
          onConfirm={handleRemoveRate}
        />
      )}
    </div>
  );
}
