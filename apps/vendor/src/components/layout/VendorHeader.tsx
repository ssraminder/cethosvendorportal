import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getSteps, type VendorStep } from "../../api/vendorJobs";
import { LANGUAGES } from "../../data/languages";
import { Menu, Bell, ChevronDown, User, Shield, LogOut, Briefcase, Inbox } from "lucide-react";

interface VendorHeaderProps {
  onMenuClick: () => void;
}

function langName(code: string | null): string {
  if (!code) return "—";
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export function VendorHeader({ onMenuClick }: VendorHeaderProps) {
  const { vendor, sessionToken, logout } = useVendorAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [offers, setOffers] = useState<VendorStep[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const initials = vendor?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  // Same outside-click behaviour for the bell panel.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [bellOpen]);

  // Fetch pending offers lazily — only when the bell panel opens — and
  // re-fetch on each open so the count is fresh.
  const fetchOffers = useCallback(async () => {
    if (!sessionToken) return;
    setOffersLoading(true);
    try {
      const result = await getSteps(sessionToken, "offered");
      setOffers(result.jobs ?? []);
    } catch {
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (bellOpen) fetchOffers();
  }, [bellOpen, fetchOffers]);

  const hasUnread = offers.length > 0;

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm h-16 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 -ml-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="lg:hidden">
          <img
            src="https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/png_logo_cethos_light_bg.png"
            alt="CETHOS"
            className="h-7 w-auto object-contain"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell — shows pending offers from /sb/get-jobs.
            Lazy fetch on open keeps it cheap; refreshes each click. */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen((open) => !open)}
            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {hasUnread && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full" />
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-1 w-80 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">Notifications</p>
                {offers.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {offers.length} pending offer{offers.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {offersLoading ? (
                  <div className="px-3 py-6 text-center text-sm text-gray-400">Loading…</div>
                ) : offers.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-1.5" />
                    <p className="text-sm text-gray-500">You're all caught up</p>
                  </div>
                ) : (
                  offers.slice(0, 6).map((offer) => (
                    <button
                      key={offer.id}
                      onClick={() => {
                        setBellOpen(false);
                        navigate(`/jobs/${offer.id}`);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                          <Briefcase className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            New offer: {langName(offer.source_language)} → {langName(offer.target_language)}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {offer.service_name ?? "Translation"}
                            {offer.order_number ? ` · #${offer.order_number}` : ""}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {offers.length > 0 && (
                <div className="border-t border-gray-100 px-3 py-2">
                  <Link
                    to="/jobs"
                    onClick={() => setBellOpen(false)}
                    className="block text-center text-xs font-medium text-teal-600 hover:text-teal-700"
                  >
                    View all jobs →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center">
              <span className="text-xs font-semibold text-white">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-800 leading-tight">
                {vendor?.full_name}
              </p>
              <p className="text-xs text-gray-400 leading-tight">
                {vendor?.email}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">
              <Link
                to="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User className="w-4 h-4 text-gray-400" />
                My Profile
              </Link>
              <Link
                to="/security"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Shield className="w-4 h-4 text-gray-400" />
                Security
              </Link>
              <div className="h-px bg-gray-100 my-1" />
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-gray-400" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
