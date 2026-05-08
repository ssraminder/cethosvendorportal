import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Shown at the very top of the layout when the active vendor session is
 * a staff "View as vendor" impersonation. Click "Exit" to delete the
 * impersonation session server-side and bounce back to /login.
 */
export function ImpersonationBanner() {
  const { isImpersonation, vendor, impersonator, sessionToken, logout } =
    useVendorAuth();
  const [exiting, setExiting] = useState(false);

  if (!isImpersonation || !vendor) return null;

  const handleExit = async () => {
    if (!sessionToken) return;
    setExiting(true);
    try {
      // Best-effort server-side delete — admin-impersonate-vendor only
      // deletes rows where is_impersonation=true, so this can never wipe
      // a real vendor login.
      await fetch(`${BASE}/admin-impersonate-vendor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", token: sessionToken }),
      }).catch(() => undefined);
    } finally {
      await logout();
      window.location.href = "/login";
    }
  };

  const staffLabel = impersonator
    ? impersonator.full_name || impersonator.email
    : "Cethos staff";

  return (
    <div className="bg-amber-500 text-amber-50 border-b border-amber-600">
      <div className="px-4 py-2 flex items-center gap-3 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold">Viewing as {vendor.full_name}</span>
          <span className="opacity-90">
            {" "}
            · {staffLabel} (Cethos staff) is impersonating this vendor for
            support / debug
          </span>
        </div>
        <button
          onClick={handleExit}
          disabled={exiting}
          className="inline-flex items-center gap-1 bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium px-3 py-1 rounded transition-colors disabled:opacity-60"
        >
          <X className="w-3.5 h-3.5" />
          {exiting ? "Exiting..." : "Exit"}
        </button>
      </div>
    </div>
  );
}
