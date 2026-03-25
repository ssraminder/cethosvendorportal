import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  updateProfile,
  sendPhoneVerification,
  verifyPhoneCode,
} from "../../api/vendorAuth";
import {
  getFullProfile,
  lookupProvinces,
  lookupTaxRate,
  type Province,
} from "../../api/vendorProfile";
import { SearchableSelect, type SelectOption } from "../shared/SearchableSelect";
import { CurrencySelect } from "../shared/CurrencySelect";
import { COUNTRIES } from "../../data/countries";
import { LANGUAGES } from "../../data/languages";
import {
  Mail,
  Phone,
  Globe,
  CircleDot,
  Shield,
  Pencil,
  Check,
  X,
  Loader2,
  MapPin,
  Building2,
  Receipt,
  Percent,
  DollarSign,
  Languages,
} from "lucide-react";

// --- Editable text field ---
interface EditableFieldProps {
  icon: typeof Mail;
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onSave: (value: string) => Promise<string | null>;
}

function EditableField({ icon: Icon, label, value, type = "text", placeholder, onSave }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setDraft(value);
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  async function handleSave() {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    setError("");
    const err = await onSave(trimmed);
    setSaving(false);
    if (err) { setError(err); } else { setEditing(false); }
  }

  if (editing) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
            <div className="flex gap-2">
              <input
                type={type}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                disabled={saving}
                autoFocus
                className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none disabled:bg-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
              <button onClick={handleSave} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50" title="Save">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={cancelEdit} disabled={saving} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md disabled:opacity-50" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !value || value === "Not provided";
  return (
    <div className="px-6 py-4 flex items-center gap-4 group">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm mt-0.5 truncate ${isEmpty ? "text-gray-400 italic" : "font-medium text-gray-900"}`}>
          {value || "Not provided"}
        </p>
      </div>
      <button
        onClick={startEdit}
        className="p-1.5 text-gray-400 hover:text-[#0F9DA0] hover:bg-[#0F9DA0]/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        title={`Edit ${label.toLowerCase()}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// --- Editable searchable select field ---
interface EditableSelectFieldProps {
  icon: typeof Mail;
  label: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onSave: (value: string) => Promise<string | null>;
}

function EditableSelectField({ icon: Icon, label, value, options, placeholder, onSave }: EditableSelectFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setDraft(value);
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  async function handleSave() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    setError("");
    const err = await onSave(draft);
    setSaving(false);
    if (err) { setError(err); } else { setEditing(false); }
  }

  if (editing) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
            <div className="flex gap-2 items-start">
              <SearchableSelect
                options={options}
                value={draft}
                onChange={setDraft}
                placeholder={placeholder}
                className="flex-1"
              />
              <button onClick={handleSave} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50 mt-1" title="Save">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={cancelEdit} disabled={saving} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md disabled:opacity-50 mt-1" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  const displayLabel = options.find((o) => o.value === value)?.label || value;
  const isEmpty = !value || value === "Not provided";
  return (
    <div className="px-6 py-4 flex items-center gap-4 group">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm mt-0.5 truncate ${isEmpty ? "text-gray-400 italic" : "font-medium text-gray-900"}`}>
          {displayLabel || "Not provided"}
        </p>
      </div>
      <button
        onClick={startEdit}
        className="p-1.5 text-gray-400 hover:text-[#0F9DA0] hover:bg-[#0F9DA0]/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        title={`Edit ${label.toLowerCase()}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// --- Phone field with OTP verification ---
type PhoneStep = "display" | "input" | "verify";

interface EditablePhoneFieldProps {
  value: string;
  sessionToken: string;
  onVerified: (vendor: import("../../api/vendorAuth").VendorProfile) => void;
}

function EditablePhoneField({ value, sessionToken, onVerified }: EditablePhoneFieldProps) {
  const [step, setStep] = useState<PhoneStep>("display");
  const [phone, setPhone] = useState(value || "");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function startEdit() {
    setPhone(value || "");
    setOtpCode("");
    setError("");
    setStep("input");
  }

  function cancel() {
    setStep("display");
    setError("");
    setOtpCode("");
  }

  async function handleSendCode() {
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 7) {
      setError("Enter a valid phone number with country code");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await sendPhoneVerification(sessionToken, trimmed);
      if (result.error) {
        let msg = result.error;
        if (result.detail) {
          msg += `: ${typeof result.detail === "string" ? result.detail : JSON.stringify(result.detail)}`;
        }
        setError(msg);
      } else {
        setMaskedPhone(result.masked_phone || trimmed);
        setStep("verify");
        setCountdown(60);
        setOtpCode("");
      }
    } catch {
      setError("Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    await handleSendCode();
  }

  async function handleVerify() {
    if (otpCode.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await verifyPhoneCode(sessionToken, phone.trim(), otpCode);
      if (result.error) {
        setError(result.error);
      } else if (result.vendor) {
        onVerified(result.vendor);
        setStep("display");
      }
    } catch {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = !value;

  if (step === "input") {
    return (
      <div className="px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
            <Phone className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Phone</p>
            <p className="text-xs text-gray-500 mb-2">
              Enter your number with country code. We&apos;ll send a verification SMS.
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                disabled={loading}
                autoFocus
                className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none disabled:bg-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendCode();
                  if (e.key === "Escape") cancel();
                }}
              />
              <button
                onClick={handleSendCode}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#0F9DA0] rounded-lg hover:bg-[#0d7f82] disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? "Sending..." : "Send code"}
              </button>
              <button onClick={cancel} disabled={loading} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md disabled:opacity-50" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-[#0F9DA0]/10 flex items-center justify-center shrink-0 mt-0.5">
            <Phone className="w-4 h-4 text-[#0F9DA0]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Verify Phone</p>
            <p className="text-xs text-gray-600 mb-2">
              Code sent to <span className="font-medium">{maskedPhone}</span>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                disabled={loading}
                autoFocus
                className="w-32 px-3 py-1.5 text-sm font-mono tracking-widest border border-gray-300 rounded-lg focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none disabled:bg-gray-100 text-center"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerify();
                  if (e.key === "Escape") cancel();
                }}
              />
              <button
                onClick={handleVerify}
                disabled={loading || otpCode.length !== 6}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#0F9DA0] rounded-lg hover:bg-[#0d7f82] disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
              <button onClick={cancel} disabled={loading} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md disabled:opacity-50" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={handleResend}
                disabled={countdown > 0 || loading}
                className="text-xs text-[#0F9DA0] hover:text-[#0d7f82] disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 flex items-center gap-4 group">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Phone className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Phone</p>
        <p className={`text-sm mt-0.5 truncate ${isEmpty ? "text-gray-400 italic" : "font-medium text-gray-900"}`}>
          {value || "Not provided"}
        </p>
      </div>
      <button
        onClick={startEdit}
        className="p-1.5 text-gray-400 hover:text-[#0F9DA0] hover:bg-[#0F9DA0]/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        title={value ? "Change phone" : "Add phone"}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// --- Read-only field ---
interface ReadOnlyFieldProps {
  icon: typeof Mail;
  label: string;
  value: string;
}

function ReadOnlyField({ icon: Icon, label, value }: ReadOnlyFieldProps) {
  const isEmpty = value === "Not provided" || value === "Not set";
  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm mt-0.5 truncate ${isEmpty ? "text-gray-400 italic" : "font-medium text-gray-900"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// --- Currency edit field ---
interface EditableCurrencyFieldProps {
  icon: typeof Mail;
  label: string;
  value: string;
  onSave: (value: string) => Promise<string | null>;
}

function EditableCurrencyField({ icon: Icon, label, value, onSave }: EditableCurrencyFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setDraft(value);
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  async function handleSave() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    setError("");
    const err = await onSave(draft);
    setSaving(false);
    if (err) { setError(err); } else { setEditing(false); }
  }

  if (editing) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
            <div className="flex gap-2 items-start">
              <CurrencySelect
                value={draft}
                onChange={setDraft}
                className="flex-1"
              />
              <button onClick={handleSave} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50 mt-1" title="Save">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={cancelEdit} disabled={saving} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md disabled:opacity-50 mt-1" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !value;
  return (
    <div className="px-6 py-4 flex items-center gap-4 group">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm mt-0.5 truncate ${isEmpty ? "text-gray-400 italic" : "font-medium text-gray-900"}`}>
          {value || "Not set"}
        </p>
      </div>
      <button
        onClick={startEdit}
        className="p-1.5 text-gray-400 hover:text-[#0F9DA0] hover:bg-[#0F9DA0]/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        title={`Edit ${label.toLowerCase()}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// --- Native Languages multi-select ---
interface NativeLanguagesFieldProps {
  value: string[];
  onSave: (codes: string[]) => Promise<string | null>;
}

function NativeLanguagesField({ value, onSave }: NativeLanguagesFieldProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const langOptions: SelectOption[] = LANGUAGES
    .filter((l) => !value.includes(l.code))
    .map((l) => ({ value: l.code, label: l.name, group: l.group }));

  async function addLanguage(code: string) {
    if (!code || value.includes(code)) return;
    setSaving(true);
    setError("");
    const err = await onSave([...value, code]);
    setSaving(false);
    if (err) setError(err);
  }

  async function removeLanguage(code: string) {
    setSaving(true);
    setError("");
    const err = await onSave(value.filter((c) => c !== code));
    setSaving(false);
    if (err) setError(err);
  }

  function langLabel(code: string): string {
    return LANGUAGES.find((l) => l.code === code)?.name ?? code;
  }

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
          <Languages className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Native Language(s)
          </p>
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {value.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700"
                >
                  {langLabel(code)}
                  <button
                    onClick={() => removeLanguage(code)}
                    disabled={saving}
                    className="ml-0.5 text-teal-500 hover:text-teal-800 disabled:opacity-50"
                    title={`Remove ${langLabel(code)}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <SearchableSelect
            options={langOptions}
            value=""
            onChange={addLanguage}
            placeholder={value.length === 0 ? "Select your native language(s)..." : "Add another language..."}
            disabled={saving}
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// --- Main profile page ---
export function VendorProfile() {
  const { vendor, sessionToken, setVendor } = useVendorAuth();
  const [taxId, setTaxId] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [preferredRateCurrency, setPreferredRateCurrency] = useState("CAD");
  const [city, setCity] = useState("");
  const [provinceState, setProvinceState] = useState("");
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [nativeLanguages, setNativeLanguages] = useState<string[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const countryOptions: SelectOption[] = COUNTRIES.map((c) => ({ value: c, label: c }));

  const isCanada = vendor?.country === "Canada";

  const provinceOptions: SelectOption[] = provinces.map((p) => ({
    value: p.region_code,
    label: p.region_name,
  }));

  // Derive the Tax ID label from tax_name
  function getTaxIdLabel(tn: string): string {
    if (tn === "HST") return "HST Number";
    if (tn === "GST") return "GST Number";
    if (tn === "GST+QST") return "GST/QST Number";
    if (tn === "GST+PST") return "GST/PST Number";
    return "Tax ID / VAT Number";
  }

  const loadExtendedProfile = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await getFullProfile(sessionToken);
      if (result.vendor) {
        setCity(result.vendor.city || "");
        setTaxId(result.vendor.tax_id || "");
        setTaxName(result.vendor.tax_name || "");
        setTaxRate(result.vendor.tax_rate?.toString() || "");
        setPreferredRateCurrency(result.vendor.preferred_rate_currency || "CAD");
        setProvinceState(result.vendor.province_state || "");
        setNativeLanguages(result.vendor.native_languages || []);

        // Load provinces if vendor is in Canada
        if (result.vendor.country === "Canada") {
          const provResult = await lookupProvinces();
          if (provResult.provinces) {
            setProvinces(provResult.provinces);
          }
        }
      }
    } catch {
      // Non-critical
    } finally {
      setProfileLoaded(true);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadExtendedProfile();
  }, [loadExtendedProfile]);

  if (!vendor || !sessionToken) return null;

  const initials = vendor.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function saveField(field: string, value: string): Promise<string | null> {
    const result = await updateProfile(sessionToken!, { [field]: value });
    if (result.error) return result.error;
    if (result.vendor) setVendor(result.vendor);
    return null;
  }

  async function saveEmail(value: string): Promise<string | null> {
    return saveField("email", value);
  }

  async function saveFullName(value: string): Promise<string | null> {
    return saveField("full_name", value);
  }

  async function saveCity(value: string): Promise<string | null> {
    const err = await saveField("city", value);
    if (!err) setCity(value);
    return err;
  }

  async function saveCountry(value: string): Promise<string | null> {
    const result = await updateProfile(sessionToken!, { country: value });
    if (result.error) return result.error;
    if (result.vendor) setVendor(result.vendor);

    if (value === "Canada") {
      // Load provinces for the dropdown
      const provResult = await lookupProvinces();
      if (provResult.provinces) {
        setProvinces(provResult.provinces);
      }
    } else {
      // Non-Canada: clear province and reset tax fields
      setProvinces([]);
      setProvinceState("");
      setTaxName("N/A");
      setTaxRate("0");
    }
    return null;
  }

  async function saveProvince(value: string): Promise<string | null> {
    // Look up the tax info for this province
    const taxResult = await lookupTaxRate(value);
    if (taxResult.error) return taxResult.error;

    const newTaxName = taxResult.tax_name || "";
    const newTaxRate = taxResult.tax_rate ?? 0;

    // Save province + tax fields together
    const result = await updateProfile(sessionToken!, {
      province_state: value,
      tax_name: newTaxName,
      tax_rate: newTaxRate.toString(),
    });
    if (result.error) return result.error;
    if (result.vendor) setVendor(result.vendor);

    setProvinceState(value);
    setTaxName(newTaxName);
    setTaxRate(newTaxRate.toString());
    return null;
  }

  async function saveTaxId(value: string): Promise<string | null> {
    const err = await saveField("tax_id", value);
    if (!err) setTaxId(value);
    return err;
  }

  async function saveNativeLanguages(codes: string[]): Promise<string | null> {
    const result = await updateProfile(sessionToken!, { native_languages: codes });
    if (result.error) return result.error;
    if (result.vendor) setVendor(result.vendor);
    setNativeLanguages(codes);
    return null;
  }

  async function savePreferredRateCurrency(value: string): Promise<string | null> {
    const err = await saveField("preferred_rate_currency", value);
    if (!err) setPreferredRateCurrency(value);
    return err;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-teal-600 flex items-center justify-center">
            <span className="text-xl font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 truncate">{vendor.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-sm text-gray-500">{vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}</span>
            </div>
          </div>
          <a
            href="/profile"
            className="text-sm font-medium text-teal-600 hover:text-teal-700 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-50 transition-colors"
          >
            Edit Profile
          </a>
        </div>
      </div>

      {/* Account details */}
      <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Account Details
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          <EditableField
            icon={Building2}
            label="Full Name"
            value={vendor.full_name}
            placeholder="Your full name"
            onSave={saveFullName}
          />
          <EditableField
            icon={Mail}
            label="Email"
            value={vendor.email}
            type="email"
            placeholder="you@example.com"
            onSave={saveEmail}
          />
          <EditablePhoneField
            value={vendor.phone || ""}
            sessionToken={sessionToken}
            onVerified={setVendor}
          />
          <EditableSelectField
            icon={Globe}
            label="Country"
            value={vendor.country || ""}
            options={countryOptions}
            placeholder="Select country..."
            onSave={saveCountry}
          />
          {profileLoaded && isCanada && provinceOptions.length > 0 && (
            <EditableSelectField
              icon={MapPin}
              label="Province"
              value={provinceState}
              options={provinceOptions}
              placeholder="Select province..."
              onSave={saveProvince}
            />
          )}
          {profileLoaded && (
            <EditableField
              icon={MapPin}
              label="City"
              value={city}
              placeholder="Your city"
              onSave={saveCity}
            />
          )}
          {profileLoaded && (
            <NativeLanguagesField
              value={nativeLanguages}
              onSave={saveNativeLanguages}
            />
          )}
          <ReadOnlyField icon={CircleDot} label="Availability" value={vendor.availability_status || "Not set"} />
        </div>
      </div>

      {/* Financial Details */}
      {profileLoaded && (
        <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              Financial Details
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            <EditableCurrencyField
              icon={DollarSign}
              label="Preferred Rate Currency"
              value={preferredRateCurrency}
              onSave={savePreferredRateCurrency}
            />
            <EditableField
              icon={Receipt}
              label={getTaxIdLabel(taxName)}
              value={taxId}
              placeholder="e.g., 123456789RT0001"
              onSave={saveTaxId}
            />
            <ReadOnlyField
              icon={Receipt}
              label="Tax Type"
              value={taxName || "Not set"}
            />
            <ReadOnlyField
              icon={Percent}
              label="Tax Rate"
              value={taxRate ? `${(parseFloat(taxRate) * 100).toFixed(2).replace(/\.?0+$/, "")}%` : "0%"}
            />
          </div>
        </div>
      )}

      {/* Security */}
      <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Security</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              Manage your password and sign-in settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
