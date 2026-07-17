import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { KeyRound, X } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { checkVendor } from "../../api/vendorAuth";

// Non-blocking, dismissible nudge shown to vendors who haven't set a password.
// Opt-in per the rollout decision: we never force it. Reuses the public
// auth-check (returns has_password) rather than a new endpoint.
const DISMISS_KEY = "cethos_pw_reminder_dismissed";

export function PasswordSetupReminder() {
  const { vendor } = useVendorAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;
    if (!vendor?.email) return;
    checkVendor(vendor.email)
      .then((r) => {
        if (active && r.exists && !r.has_password) setShow(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [vendor?.email]);

  if (!show) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <KeyRound className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
      <div className="flex-1 text-sm text-blue-900">
        <span className="font-medium">Set a password for faster sign-in.</span>{" "}
        Add one so you don't need a one-time code every time — and you can remember trusted
        browsers for 30 days.{" "}
        <Link to="/profile" className="font-semibold underline hover:text-blue-950">
          Set it up
        </Link>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "true");
          setShow(false);
        }}
        className="text-blue-400 hover:text-blue-600 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
