import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  checkVendor,
  setPassword,
  listDevices,
  revokeDevice,
  type TrustedDevice,
} from "../../api/vendorAuth";
import { Loader2, ShieldCheck, Monitor, KeyRound } from "lucide-react";

const inputCls =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function SecuritySection() {
  const { vendor, sessionToken } = useVendorAuth();

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const refreshStatus = useCallback(async () => {
    if (!vendor?.email) return;
    try {
      const r = await checkVendor(vendor.email);
      setHasPassword(!!r.has_password);
    } catch {
      /* leave as-is */
    }
  }, [vendor?.email]);

  const refreshDevices = useCallback(async () => {
    if (!sessionToken) return;
    setLoadingDevices(true);
    try {
      const r = await listDevices(sessionToken);
      setDevices(r.devices || []);
    } catch {
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    refreshStatus();
    refreshDevices();
  }, [refreshStatus, refreshDevices]);

  async function handleSavePassword() {
    setPwError("");
    setPwSuccess("");
    if (newPw.length < 10 || !/[0-9]/.test(newPw) || !/[A-Za-z]/.test(newPw)) {
      setPwError("Password must be at least 10 characters and include a letter and a number.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords don't match.");
      return;
    }
    if (hasPassword && !curPw) {
      setPwError("Enter your current password.");
      return;
    }
    if (!sessionToken) return;
    setPwSaving(true);
    try {
      const r = await setPassword(sessionToken, newPw, hasPassword ? curPw : undefined);
      if (r.error) {
        setPwError(r.error);
        return;
      }
      setPwSuccess(hasPassword ? "Password updated." : "Password set.");
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      await refreshStatus();
      await refreshDevices(); // a password change revokes trusted devices
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Couldn't save password.");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!sessionToken) return;
    await revokeDevice(sessionToken, { device_id: id });
    await refreshDevices();
  }

  async function handleRevokeAll() {
    if (!sessionToken) return;
    await revokeDevice(sessionToken, { all: true });
    await refreshDevices();
  }

  return (
    <div className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-800">Security</h2>
      </div>

      {/* Password */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">
            {hasPassword ? "Change password" : "Set a password"}
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {hasPassword
            ? "Update the password you use to sign in."
            : "Add a password so you can sign in without a one-time code every time. On your personal devices you can then choose “Remember this browser” to skip the code for 30 days."}
        </p>

        <div className="space-y-3 max-w-sm">
          {hasPassword && (
            <input
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              placeholder="Current password"
              disabled={pwSaving || hasPassword === null}
              className={inputCls}
              autoComplete="current-password"
            />
          )}
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password"
            disabled={pwSaving || hasPassword === null}
            className={inputCls}
            autoComplete="new-password"
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirm new password"
            disabled={pwSaving || hasPassword === null}
            className={inputCls}
            autoComplete="new-password"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSavePassword();
            }}
          />
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-green-600">{pwSuccess}</p>}
          <button
            onClick={handleSavePassword}
            disabled={pwSaving || hasPassword === null}
            className="inline-flex items-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {hasPassword ? "Update password" : "Set password"}
          </button>
        </div>
      </div>

      {/* Remembered browsers */}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-800">Remembered browsers</h3>
          </div>
          {devices.length > 0 && (
            <button
              onClick={handleRevokeAll}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Sign out everywhere
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Browsers that can skip the one-time code for 30 days. Remove any you don't recognise.
        </p>

        {loadingDevices ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-400">No remembered browsers.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                    {d.label || "Browser"}
                    {d.current && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    Last used {fmtDate(d.last_seen_at)} · expires {fmtDate(d.expires_at)}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(d.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 shrink-0 ml-3"
                >
                  Sign out
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
