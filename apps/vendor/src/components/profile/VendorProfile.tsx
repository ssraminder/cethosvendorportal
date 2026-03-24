import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  Mail,
  Phone,
  Globe,
  Briefcase,
  CircleDot,
  Shield,
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

export function VendorProfile() {
  const { vendor } = useVendorAuth();

  if (!vendor) return null;

  const initials = vendor.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const details = [
    { icon: Mail, label: "Email", value: vendor.email },
    { icon: Phone, label: "Phone", value: vendor.phone || "Not provided" },
    { icon: Globe, label: "Country", value: vendor.country || "Not provided" },
    { icon: Briefcase, label: "Vendor Type", value: vendor.vendor_type || "Not set" },
    { icon: CircleDot, label: "Availability", value: vendor.availability_status || "Not set" },
  ];

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

      {/* Details card */}
      <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Account Details
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {details.map(({ icon: Icon, label, value }) => {
            const isEmpty = value === "Not provided" || value === "Not set";
            return (
              <div key={label} className="px-6 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    {label}
                  </p>
                  <p
                    className={`text-sm mt-0.5 truncate ${isEmpty ? "text-gray-400 italic" : "font-medium text-gray-900"}`}
                  >
                    {value}
                  </p>
                </div>
              </div>
            );
          })}
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

      <p className="text-xs text-gray-400 text-center mt-6">
        To update your profile details, contact your project manager.
      </p>
    </div>
  );
}
