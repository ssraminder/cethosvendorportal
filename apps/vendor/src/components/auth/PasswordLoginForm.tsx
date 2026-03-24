import { useState } from "react";
import { loginWithPassword } from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { Eye, EyeOff } from "lucide-react";

interface PasswordLoginFormProps {
  onSwitchToOtp: () => void;
}

export function PasswordLoginForm({ onSwitchToOtp }: PasswordLoginFormProps) {
  const { login } = useVendorAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError("Please enter both email and password");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await loginWithPassword(email.trim(), password);

      if (result.error) {
        setError(result.error);
      } else if (result.success && result.session_token && result.vendor) {
        login(result.session_token, result.vendor);
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="pw-email"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Email address
        </label>
        <input
          id="pw-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
        />
      </div>

      <div>
        <label
          htmlFor="pw-password"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="pw-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={loading}
            className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Forgot password?{" "}
        <button
          type="button"
          onClick={onSwitchToOtp}
          className="text-blue-600 hover:text-blue-700"
        >
          Request a login code instead
        </button>
      </p>
    </form>
  );
}
