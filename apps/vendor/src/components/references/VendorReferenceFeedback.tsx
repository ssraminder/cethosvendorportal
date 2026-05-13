/**
 * VendorReferenceFeedback
 *
 * Public page at /vendor-reference-feedback/:token. A reference lands
 * here from their request email and either submits feedback or
 * declines. No login — token in URL authenticates.
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, Star } from "lucide-react";
import { FUNCTIONS_BASE } from "../../api/functionsBase";
import { CompetenceMcqSection } from "./CompetenceMcqSection";
import {
  REFERENCE_MCQS,
  validateCompetenceResponses,
  type CompetenceResponses,
} from "../../data/referenceMcqs";

// Free text is optional now that we collect structured MCQ answers;
// keep the input but no longer require 50 chars.
const SUGGESTED_FEEDBACK_CHARS = 30;

export function VendorReferenceFeedback() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState("");
  const [vendorFullName, setVendorFullName] = useState("");
  const [alreadyResponded, setAlreadyResponded] = useState(false);

  const [mode, setMode] = useState<"form" | "decline">("form");
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [mcq, setMcq] = useState<Partial<CompetenceResponses>>({});
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<"received" | "declined" | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/vendor-submit-reference-feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback_token: token, validate_only: true }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          const code = data?.error ?? "invalid_token";
          setValidationError(
            code === "token_expired" ? "This link has expired." :
            "This link is not valid. Please contact Cethos.",
          );
        } else {
          setReferenceName(data.data.reference_name);
          setVendorFullName(data.data.vendor_full_name);
          setAlreadyResponded(!!data.data.already_responded);
        }
      } catch {
        if (!cancelled) setValidationError("Could not validate the link.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submitFeedback() {
    if (!token) return;
    if (!(rating >= 1 && rating <= 5)) {
      setSubmitError("Please select an overall rating from 1 to 5.");
      return;
    }
    const mcqValidation = validateCompetenceResponses(mcq);
    if (!mcqValidation.ok) {
      const slug = mcqValidation.error.replace(/^missing or invalid: /, "");
      const question = REFERENCE_MCQS.find((q) => q.slug === slug);
      setSubmitError(
        question
          ? `Please answer: "${question.prompt.replace(/\{\{name\}\}/g, vendorFullName.split(" ")[0] || "")}"`
          : "Please answer all questions before submitting.",
      );
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/vendor-submit-reference-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_token: token,
          feedback_text: feedback.trim() || null,
          feedback_rating: rating,
          competence_responses: mcqValidation.data,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data?.detail || data?.error || "Could not submit. Please try again.");
      } else {
        setSubmitted("received");
      }
    } catch {
      setSubmitError("Could not submit. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDecline() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/vendor-submit-reference-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_token: token,
          decline: true,
          decline_reason: declineReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data?.detail || data?.error || "Could not submit. Please try again.");
      } else {
        setSubmitted("declined");
      }
    } catch {
      setSubmitError("Could not submit. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        {validationError ? (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">Link not valid</h1>
            <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{validationError}</p>
            </div>
          </>
        ) : submitted === "received" ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />
            <div className="text-sm">
              <div className="font-medium">Thank you, {referenceName.split(" ")[0]}!</div>
              <p className="mt-1">Your feedback has been recorded. Cethos appreciates the time you took to respond.</p>
            </div>
          </div>
        ) : submitted === "declined" ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-800">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-gray-500" />
            <div className="text-sm">
              <div className="font-medium">Noted — thanks for letting us know.</div>
              <p className="mt-1">You won't hear from us again about this request.</p>
            </div>
          </div>
        ) : alreadyResponded ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-sm">You've already responded to this request. Thanks!</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              {vendorFullName} listed you as a reference
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              Hi {referenceName.split(" ")[0]} — Cethos is asking for a brief reference about <strong>{vendorFullName}</strong>'s translation work. Should take under 5 minutes. Your response goes directly to our vendor-management team and isn't shared with them.
            </p>

            {mode === "form" ? (
              <>
                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Overall rating *
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className="p-1 hover:scale-110 transition-transform"
                        aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      >
                        <Star
                          className={`w-7 h-7 ${
                            n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-2 text-xs text-gray-500">{rating} / 5</span>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <CompetenceMcqSection
                    vendorFirstName={vendorFullName.split(" ")[0] || "this translator"}
                    value={mcq}
                    onChange={setMcq}
                  />
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Anything else? <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={4}
                    placeholder={`Anything you'd want Cethos to know that the questions above didn't cover — context, a specific story, or a caveat.`}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none resize-y"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    {feedback.trim().length > 0 && feedback.trim().length < SUGGESTED_FEEDBACK_CHARS
                      ? "Short responses are fine — only fill this if you have something extra to add."
                      : ""}
                  </p>
                </div>

                {submitError && (
                  <div className="mb-4 flex items-start gap-2 text-sm text-red-700 p-3 bg-red-50 border border-red-200 rounded-md">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => { setMode("decline"); setSubmitError(null); }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Decline to respond
                  </button>
                  <button
                    type="button"
                    onClick={submitFeedback}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0F9DA0] rounded-md hover:bg-[#0d8688] disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {submitting ? "Submitting…" : "Submit feedback"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Reason (optional)
                  </label>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. I don't recall working with this person."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none resize-y"
                  />
                </div>
                {submitError && (
                  <div className="mb-4 flex items-start gap-2 text-sm text-red-700 p-3 bg-red-50 border border-red-200 rounded-md">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => { setMode("form"); setSubmitError(null); }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submitDecline}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {submitting ? "Submitting…" : "Confirm decline"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
