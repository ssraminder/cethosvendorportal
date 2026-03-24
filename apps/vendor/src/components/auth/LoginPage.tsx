import { useState, useEffect, useCallback } from "react";
import {
  checkVendor,
  sendOtp,
  verifyOtp,
  loginWithPassword,
} from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { OtpInput } from "./OtpInput";
import { Mail, Smartphone, KeyRound, Eye, EyeOff, ArrowLeft } from "lucide-react";

type Step = "email" | "method" | "password" | "otp-verify";

export function LoginPage() {
  const { login } = useVendorAuth();

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

  // Step 1: Check vendor by email
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
      } else if (!result.exists) {
        setError("No vendor account found for this email");
      } else {
        setHasPhone(result.has_phone);
        setHasPassword(result.has_password);
        setStep("method");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Choose method → send OTP or go to password
  const handleSendOtp = useCallback(
    async (channel: "email" | "sms") => {
      setOtpChannel(channel);
      setError("");
      setLoading(true);

      try {
        const result = await sendOtp(email.trim(), channel);

        if (result.error) {
          let message = result.error;
          if (result.detail) {
            message += `: ${typeof result.detail === "string" ? result.detail : JSON.stringify(result.detail)}`;
          }
          setError(message);
        } else if (result.success) {
          setMaskedContact(result.masked_contact || "");
          setStep("otp-verify");
          setResendCountdown(60);
          setOtpValue(["", "", "", "", "", ""]);
        }
      } catch {
        setError("Failed to send code. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

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
        login(result.session_token, result.vendor);
      }
    } catch {
      setError("Login failed. Please try again.");
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
        login(result.session_token, result.vendor, result.needs_password);
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleResend() {
    if (resendCountdown > 0) return;
    handleSendOtp(otpChannel);
  }

  function goBack() {
    if (step === "method") {
      setStep("email");
    } else {
      setStep("method");
    }
    setError("");
    setPassword("");
    setOtpValue(["", "", "", "", "", ""]);
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
            {loading ? "Checking..." : "Continue"}
          </button>
        </div>
      );
    }

    // Step 2: Choose login method
    if (step === "method") {
      return (
        <div className="space-y-4">
          <div className="text-center mb-2">
            <p className="text-sm text-gray-600">
              Signing in as{" "}
              <span className="font-medium text-gray-900">{email}</span>
            </p>
          </div>

          <p className="text-sm font-medium text-gray-700">
            Choose how to sign in
          </p>

          {hasPassword && (
            <button
              onClick={() => {
                setStep("password");
                setError("");
              }}
              disabled={loading}
              className="w-full flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
            >
              <KeyRound className="w-5 h-5 text-gray-500 shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Password
                </span>
                <p className="text-xs text-gray-500">
                  Sign in with your password
                </p>
              </div>
            </button>
          )}

          <button
            onClick={() => handleSendOtp("email")}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
          >
            <Mail className="w-5 h-5 text-gray-500 shrink-0" />
            <div>
              <span className="text-sm font-medium text-gray-900">
                Email code
              </span>
              <p className="text-xs text-gray-500">
                Send a one-time code to your email
              </p>
            </div>
          </button>

          {hasPhone && (
            <button
              onClick={() => handleSendOtp("sms")}
              disabled={loading}
              className="w-full flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
            >
              <Smartphone className="w-5 h-5 text-gray-500 shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  SMS code
                </span>
                <p className="text-xs text-gray-500">
                  Send a one-time code via text message
                </p>
              </div>
            </button>
          )}

          {!hasPassword && (
            <p className="text-xs text-gray-400 text-center pt-1">
              You can set up a password after signing in
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={goBack}
            className="w-full text-sm text-gray-500 hover:text-gray-700 pt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
            Use a different email
          </button>
        </div>
      );
    }

    // Step 3a: Password entry
    if (step === "password") {
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
            onClick={goBack}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
            Other sign-in options
          </button>
        </form>
      );
    }

    // Step 3b: OTP verify
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Code sent to{" "}
            <span className="font-medium">{maskedContact}</span>
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
            onClick={goBack}
            className="text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
            Other options
          </button>
          <button
            onClick={handleResend}
            disabled={resendCountdown > 0}
            className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {resendCountdown > 0
              ? `Resend in ${resendCountdown}s`
              : "Resend code"}
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
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              CETHOS
            </h1>
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
