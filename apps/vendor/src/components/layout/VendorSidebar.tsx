import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  User,
  Globe,
  DollarSign,
  CreditCard,
  Briefcase,
  FileText,
  X,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Folder,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";

interface VendorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  jobOfferedCount?: number;
}

interface NavLeaf {
  to: string;
  label: string;
  icon: LucideIcon;
}
interface NavBranch extends NavLeaf {
  children: NavLeaf[];
}
type NavItem = NavLeaf | NavBranch;

function buildNavItems(isAgency: boolean): NavItem[] {
  const items: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutGrid },
    { to: "/profile", label: "Profile", icon: User },
    { to: "/languages", label: "Languages", icon: Globe },
  ];
  // Agencies maintain a roster of subcontractor linguists.
  if (isAgency) items.push({ to: "/roster", label: "Linguist Roster", icon: Users });
  items.push(
    { to: "/rates", label: "Services & Rates", icon: DollarSign },
  { to: "/payment", label: "Payment", icon: CreditCard },
  {
    to: "/documents",
    label: "Documents",
    icon: Folder,
    children: [
      { to: "/nda", label: "NDA", icon: ShieldCheck },
      { to: "/gvsa", label: "Service Agreement", icon: ShieldCheck },
    ],
  },
    { to: "/request-test", label: "Competence tests", icon: GraduationCap },
    { to: "/trainings", label: "Trainings", icon: BookOpen },
    { to: "/jobs", label: "Jobs", icon: Briefcase },
    { to: "/invoices", label: "Invoices", icon: FileText },
  );
  return items;
}

function hasChildren(item: NavItem): item is NavBranch {
  return "children" in item && Array.isArray(item.children);
}

export function VendorSidebar({ isOpen, onClose, jobOfferedCount }: VendorSidebarProps) {
  const location = useLocation();
  const { vendor } = useVendorAuth();
  const isAgency = (vendor?.vendor_type ?? "").toLowerCase() === "agency";
  const mainNavItems = buildNavItems(isAgency);

  // Auto-expand any branch whose own route or one of its children matches
  // the current path so vendors don't have to re-open it on every nav.
  function branchIsOnPath(branch: NavBranch): boolean {
    if (location.pathname === branch.to || location.pathname.startsWith(`${branch.to}/`)) return true;
    return branch.children.some((c) =>
      location.pathname === c.to || location.pathname.startsWith(`${c.to}/`),
    );
  }
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const item of mainNavItems) {
      if (hasChildren(item)) init[item.to] = branchIsOnPath(item);
    }
    return init;
  });
  function toggleBranch(to: string) {
    setExpanded((prev) => ({ ...prev, [to]: !prev[to] }));
  }

  const linkClass = (isActive: boolean, nested = false) =>
    isActive
      ? `flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-sm font-semibold bg-teal-50 text-teal-700 border-l-[3px] border-teal-600 -ml-[3px] transition-colors ${nested ? "pl-9" : ""}`
      : `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group ${nested ? "pl-9" : ""}`;

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
        className={`fixed top-0 left-0 z-50 h-screen w-60 bg-white border-r border-gray-200 shadow-sm transform transition-transform lg:translate-x-0 lg:static lg:z-auto lg:h-auto lg:self-stretch lg:min-h-screen ${
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
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            if (hasChildren(item)) {
              const isOpen = expanded[item.to] ?? false;
              return (
                <div key={item.to}>
                  {/* Parent row — clicking the chevron toggles expand;
                      clicking the label still navigates to the parent route. */}
                  <div className="flex items-stretch">
                    <NavLink
                      to={item.to}
                      end
                      onClick={onClose}
                      className={({ isActive }) => `${linkClass(isActive)} flex-1`}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={iconClass(isActive)} />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                    <button
                      type="button"
                      aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                      aria-expanded={isOpen}
                      onClick={() => toggleBranch(item.to)}
                      className="px-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            end
                            onClick={onClose}
                            className={({ isActive }) => linkClass(isActive, true)}
                          >
                            {({ isActive }) => (
                              <>
                                <ChildIcon className={iconClass(isActive)} />
                                {child.label}
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                className={({ isActive }) => linkClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={iconClass(isActive)} />
                    {item.label}
                    {item.label === "Jobs" && jobOfferedCount != null && jobOfferedCount > 0 && (
                      <span className="ml-auto rounded-full bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 text-[11px] font-semibold leading-none">
                        {jobOfferedCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
