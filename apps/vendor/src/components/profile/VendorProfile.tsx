import { useState, useEffect } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  updateProfile,
  sendPhoneVerification,
  verifyPhoneCode,
} from "../../api/vendorAuth";
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
} from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    active: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", label: "Active" },
    onboarding: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Onboarding" },
    suspended: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Suspended" },
    inactive: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: "Inactive" },
  };
  const s = map[status] ?? { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// --- Editable email field (save directly) ---
interface EditableEmailFieldProps {
  value: string;
  onSave: (value: string) => Promise<string | null>;
}

function EditableEmailField({ value, onSave }: EditableEmailFieldProps) {
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
            <Mail className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Email</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="you@example.com"
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

  return (
    <div className="px-6 py-4 flex items-center gap-4 group">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Email</p>
        <p className="text-sm mt-0.5 truncate font-medium text-gray-900">{value}</p>
      </div>
      <button
        onClick={startEdit}
        className="p-1.5 text-gray-400 hover:text-[#0F9DA0] hover:bg-[#0F9DA0]/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        title="Edit email"
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
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Phone</p>
            <p className="text-xs text-gray-500 mb-2">
              Enter your number with country code. We'll send a verification SMS.
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
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Verify Phone</p>
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
        <p className="text-xs text-gray-500 uppercase tracking-wider">Phone</p>
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
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-sm mt-0.5 truncate ${isEmpty ? "text-gray-400 italic" : "font-medium text-gray-900"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// --- Main profile page ---
export function VendorProfile() {
  const { vendor, sessionToken, setVendor } = useVendorAuth();

  if (!vendor || !sessionToken) return null;

  const initials = vendor.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function saveEmail(value: string): Promise<string | null> {
    const result = await updateProfile(sessionToken!, { email: value });
    if (result.error) return result.error;
    if (result.vendor) setVendor(result.vendor);
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile header */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F9DA0] to-[#0d7f82] h-28" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-full bg-[#0F9DA0] border-4 border-white flex items-center justify-center shadow-sm">
              <span className="text-xl font-bold text-white">{initials}</span>
            </div>
            <div className="pb-1 flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{vendor.full_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {statusBadge(vendor.status)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account details */}
      <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Account Details
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          <EditableEmailField value={vendor.email} onSave={saveEmail} />
          <EditablePhoneField
            value={vendor.phone || ""}
            sessionToken={sessionToken}
            onVerified={setVendor}
          />
          <ReadOnlyField icon={Globe} label="Country" value={vendor.country || "Not provided"} />
          <ReadOnlyField icon={CircleDot} label="Availability" value={vendor.availability_status || "Not set"} />
        </div>
      </div>

      {/* Security */}
      <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Security</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              Manage your password and sign-in settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
