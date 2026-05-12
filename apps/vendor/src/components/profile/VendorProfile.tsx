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
  requestContractorUpgrade,
  type Province,
  type ContractorUpgradeRequest,
} from "../../api/vendorProfile";
import { SearchableSelect, type SelectOption } from "../shared/SearchableSelect";
import { CurrencySelect } from "../shared/CurrencySelect";
import { CvSection } from "./CvSection";
import { COUNTRIES } from "../../data/countries";
import { LANGUAGES } from "../../data/languages";
import {
  Mail,
  Phone,
  Globe,
  CircleDot,
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
  Briefcase,
  ShieldCheck,
  ChevronRight,
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

// A translator can have at most three native languages — anything beyond
// that signals data quality issues (or someone bluffing). We cap here.
const MAX_NATIVE_LANGUAGES = 3;

function NativeLanguagesField({ value, onSave }: NativeLanguagesFieldProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const atLimit = value.length >= MAX_NATIVE_LANGUAGES;

  const langOptions: SelectOption[] = LANGUAGES
    .filter((l) => !value.includes(l.code))
    .map((l) => ({ value: l.code, label: l.name, group: l.group }));

  async function addLanguage(code: string) {
    if (!code || value.includes(code)) return;
    if (atLimit) {
      setError(`You can select up to ${MAX_NATIVE_LANGUAGES} native languages.`);
      return;
    }
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
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Native Language(s)
            </p>
            <span className="text-[11px] text-gray-400">
              {value.length}/{MAX_NATIVE_LANGUAGES}
            </span>
          </div>
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
          {!atLimit && (
            <SearchableSelect
              options={langOptions}
              value=""
              onChange={addLanguage}
              placeholder={value.length === 0 ? "Select your native language(s)..." : "Add another language..."}
              disabled={saving}
            />
          )}
          {atLimit && (
            <p className="text-xs text-gray-500 italic">
              Maximum of {MAX_NATIVE_LANGUAGES} languages reached. Remove one to add another.
            </p>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// --- Contractor type (Individual / Business) with upgrade workflow ---
interface ContractorTypeRowProps {
  contractorType: "individual" | "business";
  upgradeRequest: ContractorUpgradeRequest | null;
  onSubmitUpgrade: (justification: string) => Promise<string | null>;
  onWithdrawUpgrade: () => Promise<string | null>;
}

function ContractorTypeRow({
  contractorType,
  upgradeRequest,
  onSubmitUpgrade,
  onWithdrawUpgrade,
}: ContractorTypeRowProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isBusiness = contractorType === "business";
  const pending = !isBusiness && upgradeRequest?.status === "pending";
  const rejected = !isBusiness && upgradeRequest?.status === "rejected";

  const handleSubmit = async () => {
    if (justification.trim().length < 20) {
      setError("Tell us a bit more — at least 20 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    const err = await onSubmitUpgrade(justification.trim());
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setModalOpen(false);
    setJustification("");
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    setError("");
    const err = await onWithdrawUpgrade();
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
          <Briefcase className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Contractor Type
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                isBusiness
                  ? "bg-teal-50 text-teal-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {isBusiness && <ShieldCheck className="w-3 h-3" />}
              {isBusiness ? "Business" : "Individual"}
            </span>

            {pending && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                Upgrade pending review
              </span>
            )}
            {rejected && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                Upgrade rejected
              </span>
            )}
          </div>

          {/* Sub-text + actions */}
          {isBusiness && (
            <p className="text-xs text-gray-500 mt-1.5">
              You're approved to subcontract jobs to other freelancers on your team.
            </p>
          )}

          {!isBusiness && !pending && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1.5">
                Individual contractors work in their own capacity. Upgrade to a business account to subcontract jobs to other freelancers on your team — subject to vendor-manager approval.
              </p>
              {rejected && upgradeRequest?.reviewer_notes && (
                <p className="text-xs text-red-600 mb-2">
                  Reviewer note: {upgradeRequest.reviewer_notes}
                </p>
              )}
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
              >
                Request business upgrade <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {pending && (
            <div className="mt-2 text-xs text-gray-500 space-y-1">
              <p>
                Submitted {new Date(upgradeRequest!.requested_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}. We'll email you when a vendor manager reviews this.
              </p>
              {upgradeRequest!.vendor_justification && (
                <p className="italic text-gray-400">"{upgradeRequest!.vendor_justification}"</p>
              )}
              <button
                onClick={handleWithdraw}
                disabled={submitting}
                className="text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
              >
                Withdraw request
              </button>
              {error && <p className="text-red-600">{error}</p>}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Request business upgrade
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Tell us about your business: how many translators on your team, what work you'd subcontract, why this is the right structure. A vendor manager will review and respond by email.
            </p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="e.g. I run a 4-translator studio specialising in legal Dutch→English. I'd subcontract overflow capacity to colleagues who are also Cethos vendors when I'm at capacity."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {justification.length}/1000
            </p>
            {error && (
              <p className="text-xs text-red-600 mt-2">{error}</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => { setModalOpen(false); setError(""); }}
                disabled={submitting}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || justification.trim().length < 20}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit request
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [contractorType, setContractorType] = useState<"individual" | "business">("individual");
  const [upgradeRequest, setUpgradeRequest] = useState<ContractorUpgradeRequest | null>(null);
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
        setContractorType(result.vendor.contractor_type === "business" ? "business" : "individual");
        setUpgradeRequest(result.contractor_upgrade_request ?? null);

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

  async function submitContractorUpgrade(justification: string): Promise<string | null> {
    const res = await requestContractorUpgrade(sessionToken!, { action: "submit", justification });
    if (res.error || !res.request) return res.error ?? "Failed to submit";
    setUpgradeRequest(res.request);
    return null;
  }

  async function withdrawContractorUpgrade(): Promise<string | null> {
    const res = await requestContractorUpgrade(sessionToken!, { action: "withdraw" });
    if (res.error) return res.error;
    if (upgradeRequest) {
      setUpgradeRequest({ ...upgradeRequest, status: "withdrawn" });
    }
    return null;
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
          {profileLoaded && (
            <ContractorTypeRow
              contractorType={contractorType}
              upgradeRequest={upgradeRequest}
              onSubmitUpgrade={submitContractorUpgrade}
              onWithdrawUpgrade={withdrawContractorUpgrade}
            />
          )}
          <ReadOnlyField icon={CircleDot} label="Availability" value={vendor.availability_status || "Not set"} />
        </div>
      </div>

      {/* CV / Resume */}
      {profileLoaded && (
        <div className="mt-5">
          <CvSection />
        </div>
      )}

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

    </div>
  );
}
