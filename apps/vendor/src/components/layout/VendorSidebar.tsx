import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  User,
  Shield,
  Globe,
  DollarSign,
  CreditCard,
  Briefcase,
  FileText,
  X,
} from "lucide-react";

interface VendorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  jobOfferedCount?: number;
}

const mainNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/languages", label: "Languages", icon: Globe },
  { to: "/rates", label: "Services & Rates", icon: DollarSign },
  { to: "/payment", label: "Payment", icon: CreditCard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/invoices", label: "Invoices", icon: FileText },
] as const;

const accountNavItems = [
  { to: "/security", label: "Security", icon: Shield },
] as const;

export function VendorSidebar({ isOpen, onClose, jobOfferedCount }: VendorSidebarProps) {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-sm font-semibold bg-teal-50 text-teal-700 border-l-[3px] border-teal-600 -ml-[3px] transition-colors"
      : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group";

  const iconClass = (isActive: boolean) =>
    isActive ? "w-[18px] h-[18px] text-teal-600" : "w-[18px] h-[18px] text-gray-400 group-hover:text-gray-600";

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-60 bg-white border-r border-gray-200 shadow-sm transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100">
          <img
            src="https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/png_logo_cethos_light_bg.png"
            alt="CETHOS"
            className="h-8 w-auto object-contain"
          />
          <button
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 mt-2 space-y-0.5">
          {mainNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={navLinkClass}
            >
              {({ isActive }) => (
                <>
                  <Icon className={iconClass(isActive)} />
                  {label}
                  {label === "Jobs" && jobOfferedCount != null && jobOfferedCount > 0 && (
                    <span className="ml-auto rounded-full bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 text-[11px] font-semibold leading-none">
                      {jobOfferedCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Account
          </p>

          {accountNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={navLinkClass}
            >
              {({ isActive }) => (
                <>
                  <Icon className={iconClass(isActive)} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
