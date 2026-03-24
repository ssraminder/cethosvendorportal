import { NavLink } from "react-router-dom";
import { CethosLogo } from "../shared/CethosLogo";
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
}

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/languages", label: "Languages", icon: Globe },
  { to: "/rates", label: "Services & Rates", icon: DollarSign },
  { to: "/payment", label: "Payment", icon: CreditCard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/security", label: "Security", icon: Shield },
] as const;

export function VendorSidebar({ isOpen, onClose }: VendorSidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-60 bg-[#111827] transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5">
          <div className="flex items-center gap-2">
            <CethosLogo size="sm" dark />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="h-px bg-gray-700/50 mx-4" />

        <nav className="p-3 mt-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`
              }
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

      </aside>
    </>
  );
}
