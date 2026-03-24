import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { checkVendor, sendOtp, verifyOtp } from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { OtpInput } from "./OtpInput";
import { ArrowLeft, Loader2 } from "lucide-react";

type Step = "checking" | "not-found" | "otp-verify";

export function ActivatePage() {
  const { vendor, login } = useVendorAuth();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>("checking");
  const [email] = useState(emailParam);
  const [maskedContact, setMaskedContact] = useState("");
  const [otpValue, setOtpValue] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in — go to welcome or dashboard
  if (vendor) {
    return <Navigate to="/welcome" replace />;
  }

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const doSendOtp = useCallback(async (targetEmail: string) => {
    const result = await sendOtp(targetEmail, "email");
    if (result.error) throw new Error(result.error);
    setMaskedContact(result.masked_contact || "");
    setStep("otp-verify");
    setResendCountdown(60);
    setOtpValue(["", "", "", "", "", ""]);
  }, []);

  // Auto-check and send OTP on mount if email is in URL
  useEffect(() => {
    if (!emailParam) {
      setStep("not-found");
      return;
    }

    let cancelled = false;
    async function activate() {
      try {
        const check = await checkVendor(emailParam);
        if (cancelled) return;

        if (!check.exists) {
          setStep("not-found");
          return;
        }

        await doSendOtp(emailParam);
      } catch {
        if (!cancelled) {
          setStep("not-found");
          setError("Something went wrong. Please try logging in instead.");
        }
      }
    }

    activate();
    return () => {
      cancelled = true;
    };
  }, [emailParam, doSendOtp]);

  async function handleVerify() {
    const code = otpValue.join("");
    if (code.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await verifyOtp(email, code);
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

  async function handleResend() {
    if (resendCountdown > 0) return;
    setError("");
    setLoading(true);
    try {
      await doSendOtp(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  }

  // Checking state
  if (step === "checking") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Not found or no email
  if (step === "not-found") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Activation Link Issue
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              {error ||
                "This activation link may be invalid or expired. Please use the login page to sign in with your email."}
            </p>
            <a
              href="/login"
              className="inline-block py-2.5 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // OTP verify
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              CETHOS
            </h1>
            <p className="text-gray-500 mt-1">Activate Your Account</p>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">
                We sent a verification code to{" "}
                <span className="font-medium">{maskedContact}</span>
              </p>
            </div>

            <OtpInput
              value={otpValue}
              onChange={setOtpValue}
              disabled={loading}
            />

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <button
              onClick={handleVerify}
              disabled={loading || otpValue.join("").length !== 6}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Verifying..." : "Activate Account"}
            </button>

            <div className="flex justify-between text-sm">
              <a
                href="/login"
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
                Login instead
              </a>
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
          </div>
        </div>
      </div>
    </div>
  );
}
