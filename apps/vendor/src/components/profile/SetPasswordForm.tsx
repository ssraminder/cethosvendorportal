import { useState } from "react";
import { setPassword } from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { Eye, EyeOff, Check, ShieldCheck } from "lucide-react";

function getStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length < 8) return { label: "Too short", color: "bg-red-400", width: "w-1/4" };
  const hasNumber = /\d/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  const score = [hasNumber, hasUpper, hasSpecial, pw.length >= 12].filter(Boolean).length;

  if (score <= 1) return { label: "Weak", color: "bg-orange-400", width: "w-1/3" };
  if (score <= 2) return { label: "Good", color: "bg-yellow-400", width: "w-2/3" };
  return { label: "Strong", color: "bg-green-500", width: "w-full" };
}

export function SetPasswordForm() {
  const { sessionToken, needsPassword } = useVendorAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const isFirstTime = needsPassword;
  const strength = getStrength(newPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      setError("Password must be at least 8 characters and contain a number");
      return;
    }

    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const result = await setPassword(
        sessionToken!,
        newPassword,
        isFirstTime ? undefined : currentPassword || undefined
      );

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Security</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {isFirstTime && (
          <div className="mb-5 flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Set a password so you can sign in faster next time. This is
              optional &mdash; you can always use a one-time email code instead.
            </p>
          </div>
        )}

        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isFirstTime ? "Set Password" : "Change Password"}
        </h2>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />
            Password {isFirstTime ? "set" : "updated"} successfully
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isFirstTime && (
            <div>
              <label
                htmlFor="current-pw"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Current password
              </label>
              <div className="relative">
                <input
                  id="current-pw"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={loading}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="new-pw"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              {isFirstTime ? "Password" : "New password"}
            </label>
            <div className="relative">
              <input
                id="new-pw"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters with a number"
                disabled={loading}
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {newPassword && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${strength.color} ${strength.width} transition-all`}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{strength.label}</p>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-pw"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Confirm password
            </label>
            <input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              disabled={loading}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? "Saving..."
              : isFirstTime
                ? "Set Password"
                : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
