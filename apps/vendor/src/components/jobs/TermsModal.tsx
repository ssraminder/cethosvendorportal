import { useState } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { X, Loader2, AlertTriangle } from "lucide-react";

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/^/, '<p class="mb-2">')
    .replace(/$/, "</p>");
}

export interface TermsData {
  id: string;
  title: string;
  content: string;
  version: string;
}

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (acceptanceId: string) => void;
  terms: TermsData;
  offerId: string;
  stepId: string;
  orderId: string;
  serviceId?: string | null;
  actionType: "accept_offer" | "submit_counter";
}

export function TermsModal({
  isOpen,
  onClose,
  onAccept,
  terms,
  offerId,
  stepId,
  orderId,
  serviceId,
  actionType,
}: TermsModalProps) {
  const { sessionToken } = useVendorAuth();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isImmediate = actionType === "accept_offer";
  const acceptanceType = isImmediate ? "immediate" : "conditional";

  const checkboxText = isImmediate
    ? "I have read and agree to these terms and conditions"
    : "I have read and agree that if my proposal is accepted, these terms become a binding agreement";

  const handleAccept = async () => {
    if (!sessionToken) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${FUNCTIONS_URL}/vendor-accept-terms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "accept_terms",
          terms_id: terms.id,
          offer_id: offerId,
          step_id: stepId,
          order_id: orderId,
          service_id: serviceId || undefined,
          action_type: actionType,
          acceptance_type: acceptanceType,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        setError(data.error || "Failed to record acceptance");
        return;
      }

      onAccept(data.acceptance_id);
    } catch {
      setError("Failed to record acceptance");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">
            Terms &amp; Conditions
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <div className="px-4 pt-3 flex-shrink-0">
          <h4 className="font-medium text-gray-700">{terms.title}</h4>
          <span className="text-xs text-gray-400">
            Version {terms.version}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <div
            className="prose prose-sm max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(terms.content) }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0 space-y-3">
          {/* Checkbox */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">{checkboxText}</span>
          </label>

          {/* Conditional notice */}
          {!isImmediate && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
              Your acceptance is conditional. These terms become binding only if
              the project manager accepts your counter-proposal.
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={!agreed || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Processing..." : "Accept & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Helper to check terms before proceeding ---

interface CheckTermsResult {
  needsTerms: boolean;
  terms?: TermsData;
}

export async function checkTermsForOffer(
  sessionToken: string,
  offerId: string,
  serviceId?: string | null
): Promise<CheckTermsResult> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/vendor-accept-terms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "get_terms",
        offer_id: offerId,
        service_id: serviceId || undefined,
      }),
    });

    const data = await response.json();

    if (!data.success || !data.has_terms) {
      return { needsTerms: false };
    }

    if (data.already_accepted) {
      return { needsTerms: false };
    }

    return {
      needsTerms: true,
      terms: data.terms,
    };
  } catch (err) {
    console.error("Failed to check terms:", err);
    // On error, proceed anyway — don't block the vendor on a terms check failure
    return { needsTerms: false };
  }
}
