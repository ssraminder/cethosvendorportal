import { useVendorAuth } from "../../context/VendorAuthContext";
import { Link } from "react-router-dom";

export function VendorProfile() {
  const { vendor } = useVendorAuth();

  if (!vendor) return null;

  const fields = [
    { label: "Full Name", value: vendor.full_name },
    { label: "Email", value: vendor.email },
    { label: "Phone", value: vendor.phone || "Not provided" },
    { label: "Country", value: vendor.country || "Not provided" },
    { label: "Type", value: vendor.vendor_type || "Not set" },
    { label: "Status", value: vendor.status },
    {
      label: "Availability",
      value: vendor.availability_status || "Not set",
    },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {fields.map(({ label, value }) => (
          <div key={label} className="px-5 py-4 flex justify-between">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-900">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link
          to="/security"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Change password &rarr;
        </Link>
      </div>
    </div>
  );
}
