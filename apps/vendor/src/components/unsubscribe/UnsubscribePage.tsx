import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CethosLogo } from "../shared/CethosLogo";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://lmzoyezvsjgsxveoakdr.supabase.co";
const UNSUBSCRIBE_ENDPOINT = `${SUPABASE_URL}/functions/v1/cvp-unsubscribe`;
const SUPPORT_EMAIL = "vm@cethos.com";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "too_many_emails", label: "I'm receiving too many emails" },
  { value: "not_relevant", label: "These emails aren't relevant to me" },
  { value: "no_longer_translator", label: "I'm no longer working as a translator" },
  { value: "never_signed_up", label: "I never signed up for this" },
  { value: "other", label: "Other (tell us in the comments below)" },
];

type Stage = "form" | "submitting" | "success" | "error" | "invalid_token";

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = (params.get("token") ?? "").trim();

  const [stage, setStage] = useState<Stage>("form");
  const [reason, setReason] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token || !UUID_RE.test(token)) {
      setStage("invalid_token");
    }
  }, [token]);

  async function handleSubmit() {
    setStage("submitting");
    setErrorMessage("");
    try {
      const response = await fetch(UNSUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          reason: reason || null,
          reason_text: reasonText.trim() || null,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        status?: string;
        email?: string;
        error?: string;
      };
      if (!response.ok || result.status !== "success") {
        if (result.error === "not_found") {
          setStage("invalid_token");
          return;
        }
        setErrorMessage(result.error ?? "Something went wrong. Please try again.");
        setStage("error");
        return;
      }
      setConfirmedEmail(result.email ?? "");
      setStage("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error. Please try again.");
      setStage("error");
    }
  }

  function renderContent() {
    if (stage === "invalid_token") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            This unsubscribe link is invalid or has expired. If you'd still like to opt out of
            CETHOS broadcast emails, please email us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:text-blue-700">
              {SUPPORT_EMAIL}
            </a>{" "}
            and we'll handle it manually.
          </p>
        </div>
      );
    }

    if (stage === "success") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {confirmedEmail ? (
              <>
                <span className="font-medium">{confirmedEmail}</span> will no longer receive
                broadcast emails from CETHOS.
              </>
            ) : (
              <>You've been unsubscribed from CETHOS broadcast emails.</>
            )}
          </p>
          <p className="text-sm text-gray-600">
            You'll still receive transactional emails tied to active work — job offers,
            deliveries, and invoices. Those aren't opt-outable while you're an active vendor on
            our roster.
          </p>
          <p className="text-sm text-gray-600">
            Changed your mind? Reply to any CETHOS email or contact{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:text-blue-700">
              {SUPPORT_EMAIL}
            </a>{" "}
            and we'll add you back.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-700">
          Before you go — would you let us know why? Your feedback helps us send fewer, better
          emails.
        </p>

        <div className="space-y-2">
          {REASON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer"
            >
              <input
                type="radio"
                name="reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={(e) => setReason(e.target.value)}
                disabled={stage === "submitting"}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>

        <div>
          <label
            htmlFor="reason-text"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Anything else? (optional)
          </label>
          <textarea
            id="reason-text"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            disabled={stage === "submitting"}
            rows={3}
            maxLength={500}
            placeholder="Tell us more if you'd like — we read every reply."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100 text-sm"
          />
        </div>

        {stage === "error" && errorMessage && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={stage === "submitting"}
          className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {stage === "submitting" ? "Unsubscribing..." : "Unsubscribe me"}
        </button>

        <p className="text-xs text-gray-500 text-center">
          You can skip the reason — clicking the button above will unsubscribe you either way.
        </p>
      </div>
    );
  }

  const heading =
    stage === "success"
      ? "You've been unsubscribed"
      : stage === "invalid_token"
        ? "Invalid unsubscribe link"
        : "Unsubscribe from CETHOS emails";

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <CethosLogo size="md" />
            <p className="text-gray-500 mt-1">{heading}</p>
          </div>

          {renderContent()}
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Cethos Solutions Inc. ·{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-blue-600 hover:text-blue-700"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
