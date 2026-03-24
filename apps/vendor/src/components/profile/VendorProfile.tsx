import { useState } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { updateProfile } from "../../api/vendorAuth";
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

interface EditableFieldProps {
  icon: typeof Mail;
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onSave: (value: string) => Promise<string | null>;
}

function EditableField({ icon: Icon, label, value, placeholder, type = "text", onSave }: EditableFieldProps) {
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
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError("");
    const err = await onSave(trimmed);
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setEditing(false);
    }
  }

  const isEmpty = !value;

  if (editing) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              {label}
            </p>
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
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50"
                title="Save"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md disabled:opacity-50"
                title="Cancel"
              >
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
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wider">
          {label}
        </p>
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

export function VendorProfile() {
  const { vendor, sessionToken, setVendor } = useVendorAuth();

  if (!vendor || !sessionToken) return null;

  const initials = vendor.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function saveField(field: "email" | "phone", value: string): Promise<string | null> {
    const result = await updateProfile(sessionToken!, { [field]: value });
    if (result.error) return result.error;
    if (result.vendor) setVendor(result.vendor);
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile header card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F9DA0] to-[#0d7f82] h-28" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-full bg-[#0F9DA0] border-4 border-white flex items-center justify-center shadow-sm">
              <span className="text-xl font-bold text-white">{initials}</span>
            </div>
            <div className="pb-1 flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {vendor.full_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {statusBadge(vendor.status)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editable details card */}
      <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Account Details
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          <EditableField
            icon={Mail}
            label="Email"
            value={vendor.email}
            placeholder="you@example.com"
            type="email"
            onSave={(v) => saveField("email", v)}
          />
          <EditableField
            icon={Phone}
            label="Phone"
            value={vendor.phone || ""}
            placeholder="+1 234 567 8900"
            type="tel"
            onSave={(v) => saveField("phone", v)}
          />
          <ReadOnlyField
            icon={Globe}
            label="Country"
            value={vendor.country || "Not provided"}
          />
          <ReadOnlyField
            icon={CircleDot}
            label="Availability"
            value={vendor.availability_status || "Not set"}
          />
        </div>
      </div>

      {/* Security section */}
      <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Security
            </p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              Manage your password and sign-in settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
