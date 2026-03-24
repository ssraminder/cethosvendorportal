import { Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  User,
  KeyRound,
  Globe,
  Phone,
  Briefcase,
  CircleDot,
  AlertTriangle,
} from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
    onboarding: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      label: "Onboarding",
    },
    suspended: { bg: "bg-red-50", text: "text-red-700", label: "Suspended" },
    inactive: { bg: "bg-gray-100", text: "text-gray-600", label: "Inactive" },
  };
  const s = map[status] ?? {
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

function availabilityLabel(status: string | null) {
  if (!status) return "Not set";
  const map: Record<string, string> = {
    available: "Available",
    busy: "Busy",
    unavailable: "Unavailable",
    on_leave: "On leave",
  };
  return map[status] ?? status;
}

function availabilityDot(status: string | null) {
  if (status === "available") return "bg-green-500";
  if (status === "busy") return "bg-yellow-500";
  return "bg-gray-400";
}

export function VendorDashboard() {
  const { vendor, needsPassword } = useVendorAuth();

  if (!vendor) return null;

  const profileItems = [
    {
      icon: Briefcase,
      label: "Vendor Type",
      value: vendor.vendor_type || "Not set",
      missing: !vendor.vendor_type,
    },
    {
      icon: Globe,
      label: "Country",
      value: vendor.country || "Not set",
      missing: !vendor.country,
    },
    {
      icon: Phone,
      label: "Phone",
      value: vendor.phone || "Not provided",
      missing: !vendor.phone,
    },
    {
      icon: CircleDot,
      label: "Availability",
      value: availabilityLabel(vendor.availability_status),
      missing: !vendor.availability_status,
    },
  ];

  const missingCount = profileItems.filter((i) => i.missing).length;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {vendor.full_name}
        </h1>
        <p className="text-gray-500 mt-1">{vendor.email}</p>
      </div>

      {/* Action banners for missing info */}
      {(needsPassword || !vendor.phone) && (
        <div className="space-y-3">
          {!vendor.phone && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Phone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">
                  Add your phone number
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Required for SMS login and for project managers to reach you.
                </p>
                <Link
                  to="/profile"
                  className="inline-block mt-2 text-sm font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2"
                >
                  Update profile
                </Link>
              </div>
            </div>
          )}
          {needsPassword && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Set up a password for faster sign-in
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Optional — you can always use a verification code instead.
                </p>
                <Link
                  to="/security"
                  className="inline-block mt-2 text-sm font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
                >
                  Set password now
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status + profile card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {vendor.full_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {statusBadge(vendor.status)}
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span
                    className={`w-2 h-2 rounded-full ${availabilityDot(vendor.availability_status)}`}
                  />
                  {availabilityLabel(vendor.availability_status)}
                </span>
              </div>
            </div>
          </div>
          <Link
            to="/profile"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            View profile
          </Link>
        </div>

        <div className="divide-y divide-gray-50">
          {profileItems.map(({ icon: Icon, label, value, missing }) => (
            <div
              key={label}
              className="px-5 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{label}</span>
              </div>
              <span
                className={`text-sm ${missing ? "text-gray-400 italic" : "font-medium text-gray-900"}`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {missingCount > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <Link
              to="/profile"
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Complete your profile ({missingCount} field
              {missingCount > 1 ? "s" : ""} missing)
            </Link>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          to="/profile"
          className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <User className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">My Profile</p>
            <p className="text-xs text-gray-500">View and edit your details</p>
          </div>
        </Link>
        <Link
          to="/security"
          className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <KeyRound className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">Security</p>
            <p className="text-xs text-gray-500">
              {needsPassword ? "Set up your password" : "Manage your password"}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
