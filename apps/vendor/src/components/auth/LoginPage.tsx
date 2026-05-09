import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { checkVendor, sendOtp, verifyOtp } from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { OtpInput } from "./OtpInput";
import { CethosLogo } from "../shared/CethosLogo";
import { maskEmail } from "../../utils/mask";
import { ArrowLeft } from "lucide-react";

// Email OTP is the only login method. The previous password and SMS
// branches are intentionally gone — vendors don't set up passwords and
// we don't ship SMS codes anymore. Keep the file simple so it stays
// obvious what the supported flow is.

type Step = "email" | "otp-verify";

export function LoginPage() {
  const { vendor, isFirstLogin, login } = useVendorAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
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

  const displayContact =
    maskedContact || (email ? maskEmail(email.trim()) : "your email");

  const doSendOtp = useCallback(async () => {
    const result = await sendOtp(email.trim(), "email");
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
  }, [email]);

  // Redirect if already logged in (after all hooks)
  if (vendor) {
    return <Navigate to={isFirstLogin ? "/welcome" : "/"} replace />;
  }

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
      await doSendOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCountdown > 0) return;
    setError("");
    setLoading(true);
    try {
      await doSendOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  }

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

  function goBackToEmail() {
    setStep("email");
    setError("");
    setOtpValue(["", "", "", "", "", ""]);
  }

  function renderContent() {
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

    // otp-verify
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Code sent to <span className="font-medium">{displayContact}</span>
          </p>
        </div>

        <OtpInput value={otpValue} onChange={setOtpValue} disabled={loading} />

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

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
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <CethosLogo size="md" />
            <p className="text-gray-500 mt-1">Vendor Portal</p>
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
