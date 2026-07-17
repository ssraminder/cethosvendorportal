import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import {
  checkVendor,
  sendOtp,
  verifyOtp,
  loginWithPassword,
  setPassword,
  testConnectivity,
  NetworkUnreachableError,
  type ConnectivityProbe,
  type AuthResponse,
} from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { OtpInput } from "./OtpInput";
import { CethosLogo } from "../shared/CethosLogo";
import { maskEmail } from "../../utils/mask";
import { ArrowLeft, Wifi, Loader2, Eye, EyeOff } from "lucide-react";

// Passwordless-OR-password login.
//   • Email is always the account identifier.
//   • If the vendor has set a password, it's the everyday factor; OTP is a
//     periodic step-up ("Remember this browser" skips it for ~30 days), and a
//     trusted-device cookie only ever skips OTP — never the password.
//   • If the vendor has no password, it stays passwordless OTP (email/SMS).
// See docs/CVP-VENDOR-AUTH-PASSWORD-PLAN.md.

type Step = "email" | "password" | "otp-verify" | "set-password";

interface PendingAuth {
  token: string;
  vendor: AuthResponse["vendor"];
  isFirstLogin: boolean;
}

const EMPTY_OTP = ["", "", "", "", "", ""];

export function LoginPage() {
  const { vendor, isFirstLogin, login } = useVendorAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [maskedContact, setMaskedContact] = useState("");
  const [otpValue, setOtpValue] = useState<string[]>(EMPTY_OTP);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState("");
  const [networkError, setNetworkError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ConnectivityProbe | null>(null);

  // Vendor capabilities (from checkVendor) + flow context.
  const [hasPhone, setHasPhone] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [rememberDevice, setRememberDevice] = useState(false);
  // resetMode: the OTP is part of a forgot-password reset (land on set-password
  // afterwards). pendingAuth holds the session established by that OTP.
  const [resetMode, setResetMode] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | null>(null);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const displayContact =
    maskedContact || (email ? maskEmail(email.trim()) : "your email");

  const doSendOtp = useCallback(
    async (ch: "email" | "sms" = "email") => {
      const result = await sendOtp(email.trim(), ch);
      if (result.error) {
        let message = result.error;
        if (result.detail) {
          message += `: ${typeof result.detail === "string" ? result.detail : JSON.stringify(result.detail)}`;
        }
        throw new Error(message);
      }
      setChannel(ch);
      setMaskedContact(result.masked_contact || "");
      setStep("otp-verify");
      setResendCountdown(60);
      setOtpValue(EMPTY_OTP);
    },
    [email],
  );

  // Redirect if already logged in (after all hooks).
  if (vendor) {
    return <Navigate to={isFirstLogin ? "/welcome" : "/"} replace />;
  }

  function toNetworkOrGenericError(err: unknown) {
    if (err instanceof NetworkUnreachableError) {
      setNetworkError(true);
      setError(err.message);
    } else {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function handleEmailContinue() {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setError("");
    setNetworkError(false);
    setProbeResult(null);
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
      setHasPhone(!!result.has_phone);
      setHasPassword(!!result.has_password);
      if (result.has_password) {
        // Everyday path: ask for the password first.
        setStep("password");
      } else {
        // Passwordless vendor → OTP as before.
        await doSendOtp("email");
      }
    } catch (err) {
      toNetworkOrGenericError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSignIn() {
    if (!password) {
      setError("Please enter your password");
      return;
    }
    setError("");
    setNetworkError(false);
    setLoading(true);
    try {
      const result = await loginWithPassword(email.trim(), password);
      if (result.success && result.session_token && result.vendor) {
        // Trusted browser — logged in without OTP.
        login(result.session_token, result.vendor, { isFirstLogin: result.is_first_login });
        return;
      }
      if (result.needs_otp) {
        // New / expired browser — step up with an OTP.
        await doSendOtp("email");
        return;
      }
      setError(result.error || "Invalid email or password");
    } catch (err) {
      toNetworkOrGenericError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setResetMode(true);
    setLoading(true);
    try {
      await doSendOtp("email");
    } catch (err) {
      setResetMode(false);
      toNetworkOrGenericError(err);
    } finally {
      setLoading(false);
    }
  }

  // "Email me a code instead" from the password step — OTP-only recovery login.
  async function handleOtpInsteadOfPassword() {
    setError("");
    setResetMode(false);
    setLoading(true);
    try {
      await doSendOtp("email");
    } catch (err) {
      toNetworkOrGenericError(err);
    } finally {
      setLoading(false);
    }
  }

  async function runConnectivityTest() {
    setProbing(true);
    setProbeResult(null);
    try {
      setProbeResult(await testConnectivity());
    } finally {
      setProbing(false);
    }
  }

  async function handleResend() {
    if (resendCountdown > 0) return;
    setError("");
    setLoading(true);
    try {
      await doSendOtp(channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  }

  // Switch delivery channel (email ⇄ SMS) and send a fresh code immediately.
  async function handleSwitchChannel(ch: "email" | "sms") {
    setError("");
    setLoading(true);
    try {
      await doSendOtp(ch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
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
      // Only remember the browser when the vendor has a password — a trusted
      // device is meaningless (and unsafe) without a knowledge factor.
      const result = await verifyOtp(email.trim(), code, rememberDevice && hasPassword);
      if (result.error) {
        setError(result.error);
      } else if (result.success && result.session_token && result.vendor) {
        if (resetMode) {
          // Forgot-password: OTP proved ownership; now let them set a new one.
          setPendingAuth({
            token: result.session_token,
            vendor: result.vendor,
            isFirstLogin: !!result.is_first_login,
          });
          setStep("set-password");
          setNewPassword("");
          setConfirmPassword("");
        } else {
          login(result.session_token, result.vendor, { isFirstLogin: result.is_first_login });
        }
      }
    } catch (err) {
      toNetworkOrGenericError(err);
    } finally {
      setLoading(false);
    }
  }

  function completePendingLogin() {
    if (!pendingAuth?.token || !pendingAuth.vendor) return;
    login(pendingAuth.token, pendingAuth.vendor, { isFirstLogin: pendingAuth.isFirstLogin });
  }

  async function handleSetNewPassword() {
    if (newPassword.length < 10 || !/[0-9]/.test(newPassword) || !/[A-Za-z]/.test(newPassword)) {
      setError("Password must be at least 10 characters and include a letter and a number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!pendingAuth?.token) {
      setError("Session expired. Please start again.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await setPassword(pendingAuth.token, newPassword);
      if (result.error) {
        setError(result.error);
        return;
      }
      completePendingLogin();
    } catch (err) {
      toNetworkOrGenericError(err);
    } finally {
      setLoading(false);
    }
  }

  function goBackToEmail() {
    setStep("email");
    setError("");
    setNetworkError(false);
    setPasswordValue("");
    setResetMode(false);
    setRememberDevice(false);
    setOtpValue(EMPTY_OTP);
  }

  function renderNetworkHelp() {
    if (!networkError) return null;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
        <div className="font-semibold">Can't reach the Cethos server</div>
        <p className="text-amber-800">Your network blocked the connection. Common causes:</p>
        <ul className="list-disc pl-5 text-xs text-amber-800 space-y-0.5">
          <li>Some regions (e.g. China, parts of MENA) restrict cloud endpoints — try a VPN</li>
          <li>A privacy/ad-blocker extension may be blocking requests</li>
          <li>Corporate firewall or proxy filtering</li>
        </ul>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={runConnectivityTest}
            disabled={probing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-900 bg-white border border-amber-300 rounded hover:bg-amber-100 disabled:opacity-50"
          >
            {probing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
            Test connection
          </button>
          <a
            href="mailto:support@cethos.com?subject=Vendor%20Portal%20login%20%E2%80%94%20can%27t%20reach%20server"
            className="text-xs text-amber-900 underline hover:text-amber-950"
          >
            Email support
          </a>
          {probeResult && (
            <span className="text-xs text-amber-800 font-mono">
              {probeResult.reachable
                ? `✓ Reached server (${probeResult.duration_ms}ms, status ${probeResult.status})`
                : `✗ Blocked: ${probeResult.error || "no response"} (${probeResult.duration_ms}ms)`}
            </span>
          )}
        </div>
      </div>
    );
  }

  function renderContent() {
    if (step === "email") {
      return (
        <div className="space-y-5">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">
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
          {error && !networkError && <p className="text-sm text-red-600">{error}</p>}
          {renderNetworkHelp()}
          <button
            onClick={handleEmailContinue}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Please wait..." : "Continue"}
          </button>
        </div>
      );
    }

    if (step === "password") {
      return (
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Signing in as <span className="font-medium">{maskEmail(email.trim())}</span>
          </p>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="Your password"
                disabled={loading}
                autoFocus
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePasswordSignIn();
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && !networkError && <p className="text-sm text-red-600">{error}</p>}
          {renderNetworkHelp()}
          <button
            onClick={handlePasswordSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <div className="flex justify-between text-sm">
            <button onClick={goBackToEmail} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
              Different email
            </button>
            <button
              onClick={handleForgotPassword}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            >
              Forgot password?
            </button>
          </div>
          <p className="text-center text-sm text-gray-500">
            <button
              onClick={handleOtpInsteadOfPassword}
              disabled={loading}
              className="font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            >
              Email me a one-time code instead
            </button>
          </p>
        </div>
      );
    }

    if (step === "set-password") {
      return (
        <div className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-gray-600">Set a new password for your account.</p>
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
              New password
            </label>
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              At least 10 characters, including a letter and a number.
            </p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSetNewPassword();
              }}
            />
          </div>
          {error && !networkError && <p className="text-sm text-red-600">{error}</p>}
          {renderNetworkHelp()}
          <button
            onClick={handleSetNewPassword}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Saving..." : "Save password & continue"}
          </button>
          <p className="text-center text-sm text-gray-500">
            <button
              onClick={completePendingLogin}
              disabled={loading}
              className="text-gray-500 hover:text-gray-700 disabled:text-gray-400"
            >
              Skip for now
            </button>
          </p>
        </div>
      );
    }

    // otp-verify
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {resetMode ? "Enter the code to reset your password." : "Enter the code to sign in."}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Code {channel === "sms" ? "texted" : "sent"} to{" "}
            <span className="font-medium">{displayContact}</span>
          </p>
        </div>

        <OtpInput value={otpValue} onChange={setOtpValue} disabled={loading} />

        {hasPassword && (
          <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              Remember this browser for 30 days
              <span className="block text-xs text-gray-400">
                Only check this on your personal device.
              </span>
            </span>
          </label>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <button
          onClick={handleVerifyOtp}
          disabled={loading || otpValue.join("").length !== 6}
          className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Verifying..." : resetMode ? "Verify & continue" : "Verify code"}
        </button>

        <div className="flex justify-between text-sm">
          <button onClick={goBackToEmail} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
            Start over
          </button>
          <button
            onClick={handleResend}
            disabled={resendCountdown > 0 || loading}
            className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
          </button>
        </div>

        {hasPhone && channel === "email" && (
          <p className="text-center text-sm text-gray-500">
            Didn't get the email?{" "}
            <button
              onClick={() => handleSwitchChannel("sms")}
              disabled={loading}
              className="font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Text me the code instead
            </button>
          </p>
        )}
        {channel === "sms" && (
          <p className="text-center text-sm text-gray-500">
            <button
              onClick={() => handleSwitchChannel("email")}
              disabled={loading}
              className="font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Email me the code instead
            </button>
          </p>
        )}
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
          <a href="mailto:support@cethos.com" className="text-blue-600 hover:text-blue-700">
            Contact support@cethos.com
          </a>
        </p>
      </div>
    </div>
  );
}
