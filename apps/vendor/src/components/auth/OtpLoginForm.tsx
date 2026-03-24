import { useState, useEffect, useCallback } from "react";
import { sendOtp, verifyOtp } from "../../api/vendorAuth";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { OtpInput } from "./OtpInput";
import { Mail, Smartphone } from "lucide-react";

export function OtpLoginForm() {
  const { login } = useVendorAuth();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [maskedContact, setMaskedContact] = useState("");
  const [otpValue, setOtpValue] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSendCode = useCallback(async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

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
        setStep("verify");
        setResendCountdown(60);
        setOtpValue(["", "", "", "", "", ""]);
      }
    } catch {
      setError("Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, channel]);

  async function handleVerify() {
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
        login(result.session_token, result.vendor);
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleResend() {
    if (resendCountdown > 0) return;
    handleSendCode();
  }

  function handleBackToEmail() {
    setStep("request");
    setError("");
    setOtpValue(["", "", "", "", "", ""]);
  }

  if (step === "verify") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Code sent to <span className="font-medium">{maskedContact}</span>
          </p>
        </div>

        <OtpInput value={otpValue} onChange={setOtpValue} disabled={loading} />

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        <button
          onClick={handleVerify}
          disabled={loading || otpValue.join("").length !== 6}
          className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Verifying..." : "Verify Code"}
        </button>

        <div className="flex justify-between text-sm">
          <button
            onClick={handleBackToEmail}
            className="text-gray-500 hover:text-gray-700"
          >
            &larr; Use a different email
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
    <div className="space-y-5">
      <div>
        <label
          htmlFor="otp-email"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Email address
        </label>
        <input
          id="otp-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendCode();
          }}
        />
      </div>

      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Send code via
        </p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="channel"
              value="email"
              checked={channel === "email"}
              onChange={() => setChannel("email")}
              className="text-blue-600"
            />
            <Mail className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">Email</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="channel"
              value="sms"
              checked={channel === "sms"}
              onChange={() => setChannel("sms")}
              className="text-blue-600"
            />
            <Smartphone className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">SMS</span>
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSendCode}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Sending..." : "Send Code"}
      </button>
    </div>
  );
}
