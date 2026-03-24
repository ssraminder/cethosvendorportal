import { useVendorAuth } from "../../context/VendorAuthContext";

export function VendorDashboard() {
  const { vendor } = useVendorAuth();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome back, {vendor?.full_name}
      </h1>
      <p className="text-gray-500">Your dashboard is coming soon.</p>
    </div>
  );
}
