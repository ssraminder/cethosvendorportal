import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import {
  activateWithToken,
  checkVendor,
  sendOtp,
  verifyOtp,
} from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { OtpInput } from "./OtpInput";
import { CethosLogo } from "../shared/CethosLogo";
import { maskEmail } from "../../utils/mask";
import { ArrowLeft, Loader2 } from "lucide-react";

type Step = "checking" | "not-found" | "otp-verify";

export function ActivatePage() {
  const { vendor, login } = useVendorAuth();
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>("checking");
  const [email] = useState(emailParam);
  const [maskedContact, setMaskedContact] = useState("");
  const [otpValue, setOtpValue] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in
  if (vendor) {
    return <Navigate to="/welcome" replace />;
  }

  const displayContact =
    maskedContact || (email ? maskEmail(email) : "your email");

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const doSendOtp = useCallback(
    async (targetEmail: string) => {
      const result = await sendOtp(targetEmail, "email");
      if (result.error) throw new Error(result.error);
      setMaskedContact(result.masked_contact || "");
      setStep("otp-verify");
      setResendCountdown(60);
      setOtpValue(["", "", "", "", "", ""]);
    },
    []
  );

  // On mount: try token first, then email OTP fallback
  useEffect(() => {
    if (!tokenParam && !emailParam) {
      setStep("not-found");
      return;
    }

    let cancelled = false;

    async function activate() {
      // Path 1: Token-based activation (from invitation email)
      if (tokenParam) {
        try {
          const result = await activateWithToken(tokenParam);
          if (cancelled) return;

          if (result.error) {
            setError(result.error);
            setStep("not-found");
            return;
          }

          if (result.success && result.session_token && result.vendor) {
            login(result.session_token, result.vendor, {
              needsPassword: result.needs_password,
              isFirstLogin: result.is_first_login,
            });
          }
        } catch {
          if (!cancelled) {
            setError(
              "Something went wrong. Please try logging in instead."
            );
            setStep("not-found");
          }
        }
        return;
      }

      // Path 2: Email-based OTP fallback
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
  }, [tokenParam, emailParam, login, doSendOtp]);

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

  // Checking / activating state
  if (step === "checking") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#0F9DA0] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            {tokenParam ? "Activating your account..." : "Setting up your account..."}
          </p>
        </div>
      </div>
    );
  }

  // Not found / expired
  if (step === "not-found") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="mb-6">
              <CethosLogo size="md" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {tokenParam ? "Link Expired" : "Activation Link Issue"}
            </h2>
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

  // OTP verify (email fallback path only)
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <CethosLogo size="md" />
            <div className="mt-3 h-0.5 w-16 bg-[#0F9DA0] mx-auto rounded-full" />
            <p className="text-gray-500 mt-3">Activate Your Account</p>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">
                We sent a verification code to{" "}
                <span className="font-medium">{displayContact}</span>
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
