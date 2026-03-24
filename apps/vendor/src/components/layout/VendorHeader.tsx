import { useVendorAuth } from "../../context/VendorAuthContext";
import { Menu, LogOut } from "lucide-react";

interface VendorHeaderProps {
  onMenuClick: () => void;
}

export function VendorHeader({ onMenuClick }: VendorHeaderProps) {
  const { vendor, logout } = useVendorAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-gray-500 hover:text-gray-700"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {vendor?.full_name}
          </span>
          {vendor?.availability_status && (
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                vendor.availability_status === "available"
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`}
              title={vendor.availability_status}
            />
          )}
        </div>
      </div>

      <button
        onClick={logout}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </header>
  );
}
