import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { CheckCircle, Loader2, AlertTriangle, X } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface Preview {
  referenceName: string;
  applicantName: string;
  applicationNumber: string;
  alreadySubmitted: boolean;
  previousStatus: string;
}

export function ReferenceFeedback() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string>("");

  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<"submitted" | "declined" | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/cvp-submit-reference-feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ feedbackToken: token, validateOnly: true }),
        });
        const data = await resp.json();
        if (cancelled) return;
        if (!resp.ok || data?.success === false) {
          setError(data?.error || `HTTP ${resp.status}`);
        } else {
          setPreview(data.data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async () => {
    if (feedbackText.trim().length < 30) {
      setError("Please write at least a few sentences (30+ characters).");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cvp-submit-reference-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          feedbackToken: token,
          action: "submit",
          feedbackText,
          feedbackRating: rating,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data?.success === false) {
        setError(data?.detail || data?.error || `HTTP ${resp.status}`);
      } else {
        setOutcome("submitted");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setSubmitting(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cvp-submit-reference-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          feedbackToken: token,
          action: "decline",
          reason: declineReason.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data?.success === false) {
        setError(data?.detail || data?.error || `HTTP ${resp.status}`);
      } else {
        setOutcome("declined");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 px-6 flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      </Layout>
    );
  }

  if (error && !preview) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 px-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-red-900">Link not valid</h2>
              <p className="text-sm text-red-800 mt-1">
                {error === "token_expired"
                  ? "This reference questionnaire has expired."
                  : error === "invalid_token"
                  ? "We couldn't find this request. The link may have been mistyped."
                  : `We couldn't load this page (${error}).`}
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (outcome === "submitted" || preview?.previousStatus === "received") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 px-6">
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-emerald-900 text-lg">Thank you</h2>
              <p className="text-sm text-emerald-800 mt-2">
                Your reference for {preview?.applicantName} has been recorded. We'll send you a brief acknowledgement email shortly. No further action is needed.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (outcome === "declined" || preview?.previousStatus === "declined") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 px-6">
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <h2 className="font-semibold text-gray-900 text-lg">Got it — declined</h2>
            <p className="text-sm text-gray-700 mt-2">
              No problem. We won't contact you again about this. Thanks for letting us know.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-10 px-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Reference for {preview?.applicantName}
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Hi {preview?.referenceName.split(" ")[0]} — {preview?.applicantName} listed you as a
          professional reference for their CETHOS application
          (<span className="font-mono">{preview?.applicationNumber}</span>). A few short questions
          below; should take under 5 minutes. Your responses go directly to our vendor-management
          team and are not shared with {preview?.applicantName.split(" ")[0]}.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              In your own words: how was {preview?.applicantName.split(" ")[0]} to work with as a
              translator? Strengths, weaknesses, anything notable.
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={8}
              placeholder="Their domain expertise, attention to deadlines, communication style — whatever stands out. The more specific the better."
              className="w-full p-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              {feedbackText.trim().length} characters · minimum 30
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Overall, would you recommend {preview?.applicantName.split(" ")[0]}?
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`w-10 h-10 rounded border text-sm font-medium transition-colors ${
                    rating === n
                      ? "bg-teal-600 border-teal-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-teal-400"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              1 = wouldn't recommend, 5 = strongly recommend. Optional.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowDecline(true)}
              className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              I don't recall this person / decline to respond
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || feedbackText.trim().length < 30}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded disabled:opacity-50 inline-flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Submit feedback
            </button>
          </div>
        </div>

        {showDecline && (
          <div className="mt-5 p-4 bg-gray-50 border border-gray-200 rounded">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              (Optional) Anything you'd like us to know?
            </label>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={2}
              placeholder="e.g. 'I don't remember working with this person.'"
              className="w-full p-2 border border-gray-300 rounded text-sm"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDecline(false)}
                disabled={submitting}
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={submitting}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-800 text-white rounded disabled:opacity-50"
              >
                Confirm decline
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
