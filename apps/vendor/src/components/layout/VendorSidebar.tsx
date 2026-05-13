import { useState } from "react";
import { NavLink } from "react-router-dom";
import html2canvas from "html2canvas";
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
  ShieldCheck,
  Folder,
  Bug,
  Loader2,
} from "lucide-react";
import { BugReportModal } from "../support/BugReportModal";

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
  { to: "/nda", label: "NDA", icon: ShieldCheck },
  { to: "/documents", label: "Documents", icon: Folder },
  { to: "/request-test", label: "Competence tests", icon: GraduationCap },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/invoices", label: "Invoices", icon: FileText },
] as const;

export function VendorSidebar({ isOpen, onClose, jobOfferedCount }: VendorSidebarProps) {
  const [bugOpen, setBugOpen] = useState(false);
  const [bugCapturing, setBugCapturing] = useState(false);
  const [bugScreenshot, setBugScreenshot] = useState<string | null>(null);

  async function handleOpenBugReport() {
    // Pre-capture the current page state BEFORE opening the modal so
    // (a) the screenshot reflects what the vendor was actually seeing,
    // and (b) the modal never has to hide/show itself mid-capture.
    setBugCapturing(true);
    onClose();
    let screenshot: string | null = null;
    try {
      // Small delay so the sidebar's mobile-close animation completes
      // before we snap. Otherwise the screenshot includes a half-closed
      // sidebar on mobile widths.
      await new Promise((r) => setTimeout(r, 120));
      const canvas = await html2canvas(document.body, {
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      const MAX_W = 1600;
      const scale = canvas.width > MAX_W ? MAX_W / canvas.width : 1;
      const target = document.createElement("canvas");
      target.width = Math.round(canvas.width * scale);
      target.height = Math.round(canvas.height * scale);
      const ctx = target.getContext("2d");
      if (ctx) ctx.drawImage(canvas, 0, 0, target.width, target.height);
      screenshot = target.toDataURL("image/png");
    } catch {
      // If capture fails for any reason, open the modal anyway with no
      // screenshot — the vendor can still file a text-only report.
    }
    setBugScreenshot(screenshot);
    setBugCapturing(false);
    setBugOpen(true);
  }

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

        <nav className="p-3 mt-2 space-y-0.5 flex flex-col h-[calc(100%-4rem)]">
          <div className="space-y-0.5">
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
          </div>

          {/* Support — pinned to bottom of sidebar */}
          <div className="mt-auto pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleOpenBugReport}
              disabled={bugCapturing}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group disabled:opacity-60"
            >
              {bugCapturing ? (
                <Loader2 className="w-[18px] h-[18px] text-gray-400 animate-spin" />
              ) : (
                <Bug className="w-[18px] h-[18px] text-gray-400 group-hover:text-gray-600" />
              )}
              {bugCapturing ? "Preparing report…" : "Report a bug"}
            </button>
          </div>
        </nav>
      </aside>

      <BugReportModal
        open={bugOpen}
        initialScreenshot={bugScreenshot}
        onClose={() => { setBugOpen(false); setBugScreenshot(null); }}
      />
    </>
  );
}
