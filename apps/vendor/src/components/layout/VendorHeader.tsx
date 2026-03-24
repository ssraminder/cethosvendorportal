import { useVendorAuth } from "../../context/VendorAuthContext";
import { CethosLogo } from "../shared/CethosLogo";
import { Menu, LogOut, ChevronDown } from "lucide-react";

interface VendorHeaderProps {
  onMenuClick: () => void;
}

export function VendorHeader({ onMenuClick }: VendorHeaderProps) {
  const { vendor, logout } = useVendorAuth();

  const initials = vendor?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 -ml-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="lg:hidden">
          <CethosLogo size="sm" showText={false} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#0F9DA0] flex items-center justify-center">
            <span className="text-xs font-semibold text-white">{initials}</span>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900 leading-tight">
              {vendor?.full_name}
            </p>
            <p className="text-xs text-gray-500 leading-tight">
              {vendor?.email}
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
        </div>
        <div className="h-6 w-px bg-gray-200 hidden sm:block" />
        <button
          onClick={logout}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
