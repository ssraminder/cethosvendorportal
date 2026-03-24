import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import {
  checkVendor,
  sendOtp,
  verifyOtp,
  loginWithPassword,
} from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { OtpInput } from "./OtpInput";
import { CethosLogo } from "../shared/CethosLogo";
import { maskEmail } from "../../utils/mask";
import { Eye, EyeOff, ArrowLeft, Smartphone, KeyRound } from "lucide-react";

type Step = "email" | "otp-verify" | "password";

export function LoginPage() {
  const { vendor, isFirstLogin, login } = useVendorAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [hasPhone, setHasPhone] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [otpChannel, setOtpChannel] = useState<"email" | "sms">("email");

  // Password fields
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP fields
  const [maskedContact, setMaskedContact] = useState("");
  const [otpValue, setOtpValue] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(0);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Compute display contact — use backend masked_contact, fallback to frontend mask
  const displayContact =
    maskedContact || (email ? maskEmail(email.trim()) : "your email");

  // Send OTP helper
  const doSendOtp = useCallback(
    async (channel: "email" | "sms") => {
      setOtpChannel(channel);
      const result = await sendOtp(email.trim(), channel);

      if (result.error) {
        let message = result.error;
        if (result.detail) {
          message += `: ${typeof result.detail === "string" ? result.detail : JSON.stringify(result.detail)}`;
        }
        throw new Error(message);
      }

      setMaskedContact(result.masked_contact || "");
      setStep("otp-verify");
      setResendCountdown(60);
      setOtpValue(["", "", "", "", "", ""]);
    },
    [email]
  );

  // Redirect if already logged in (after all hooks)
  if (vendor) {
    return <Navigate to={isFirstLogin ? "/welcome" : "/"} replace />;
  }

  // Step 1: Check vendor by email → auto-send email OTP
  async function handleEmailContinue() {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await checkVendor(email.trim());

      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.exists) {
        setError("No vendor account found for this email");
        return;
      }

      setHasPhone(result.has_phone);
      setHasPassword(result.has_password);

      // Auto-send email OTP
      await doSendOtp("email");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // Switch to SMS OTP
  async function handleSwitchToSms() {
    setError("");
    setLoading(true);
    try {
      await doSendOtp("sms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send SMS code.");
    } finally {
      setLoading(false);
    }
  }

  // Resend current OTP
  async function handleResend() {
    if (resendCountdown > 0) return;
    setError("");
    setLoading(true);
    try {
      await doSendOtp(otpChannel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  }

  // OTP verify
  async function handleVerifyOtp() {
    const code = otpValue.join("");
    if (code.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await verifyOtp(email.trim(), code);

      if (result.error) {
        setError(result.error);
      } else if (result.success && result.session_token && result.vendor) {
        login(result.session_token, result.vendor, {
          needsPassword: result.needs_password,
          isFirstLogin: result.is_first_login,
        });
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Password login
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!password) {
      setError("Please enter your password");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await loginWithPassword(email.trim(), password);

      if (result.error) {
        setError(result.error);
      } else if (result.success && result.session_token && result.vendor) {
        login(result.session_token, result.vendor, {
          isFirstLogin: result.is_first_login,
        });
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function goBackToEmail() {
    setStep("email");
    setError("");
    setPassword("");
    setOtpValue(["", "", "", "", "", ""]);
  }

  function goBackToOtp() {
    setStep("otp-verify");
    setError("");
    setPassword("");
  }

  // --- Render ---

  function renderContent() {
    // Step 1: Enter email
    if (step === "email") {
      return (
        <div className="space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEmailContinue();
              }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleEmailContinue}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Sending code..." : "Continue"}
          </button>
        </div>
      );
    }

    // Step 2: OTP verify (primary path)
    if (step === "otp-verify") {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              {otpChannel === "sms" ? "Code sent via SMS to" : "Code sent to"}{" "}
              <span className="font-medium">{displayContact}</span>
            </p>
          </div>

          <OtpInput value={otpValue} onChange={setOtpValue} disabled={loading} />

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <button
            onClick={handleVerifyOtp}
            disabled={loading || otpValue.join("").length !== 6}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>

          <div className="flex justify-between text-sm">
            <button
              onClick={goBackToEmail}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
              Different email
            </button>
            <button
              onClick={handleResend}
              disabled={resendCountdown > 0 || loading}
              className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {resendCountdown > 0
                ? `Resend in ${resendCountdown}s`
                : "Resend code"}
            </button>
          </div>

          {/* Alternative login methods */}
          {(hasPassword || (hasPhone && otpChannel === "email")) && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-400 text-center mb-3">
                Or sign in another way
              </p>
              <div className="flex gap-2 justify-center">
                {hasPassword && (
                  <button
                    onClick={() => {
                      setStep("password");
                      setError("");
                    }}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Password
                  </button>
                )}
                {hasPhone && otpChannel === "email" && (
                  <button
                    onClick={handleSwitchToSms}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    SMS instead
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Step 3: Password entry (alternative)
    return (
      <form onSubmit={handlePasswordLogin} className="space-y-5">
        <div className="text-center mb-2">
          <p className="text-sm text-gray-600">
            Signing in as{" "}
            <span className="font-medium text-gray-900">{email}</span>
          </p>
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
              autoFocus
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

        <button
          type="button"
          onClick={goBackToOtp}
          className="w-full text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
          Use login code instead
        </button>
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <CethosLogo size="md" />
            <div className="mt-3 h-0.5 w-16 bg-[#0F9DA0] mx-auto rounded-full" />
            <p className="text-gray-500 mt-3">Vendor Portal</p>
          </div>

          {renderContent()}
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Need access?{" "}
          <a
            href="mailto:support@cethos.com"
            className="text-blue-600 hover:text-blue-700"
          >
            Contact support@cethos.com
          </a>
        </p>
      </div>
    </div>
  );
}
