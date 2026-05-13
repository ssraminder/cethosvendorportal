/**
 * PrivacyAcceptanceGate
 *
 * One-time consent gate that opens before the first file upload on the
 * iso-evidence flow. Vendor must tick the box and confirm before any
 * upload action is enabled. Acceptance is stored in localStorage so
 * vendors don't see the gate on every upload during the same session;
 * it re-shows after a session/browser switch (low friction, high audit
 * value).
 *
 * The gate is for FILE uploads only — profile-field saves don't ship
 * personal documents to storage, so they don't trigger the gate.
 */

import { useEffect, useState } from "react";
import { ShieldCheck, X as XIcon, ExternalLink } from "lucide-react";

const LS_KEY = "cethos-iso-evidence-privacy-accepted";

export function hasAcceptedPrivacy(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "true";
  } catch {
    return false;
  }
}

export function markPrivacyAccepted(): void {
  try {
    localStorage.setItem(LS_KEY, "true");
  } catch {
    /* ignore — some browsers block storage */
  }
}

interface Props {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
  /** Optional URL to the full privacy policy. */
  privacyUrl?: string;
  /** Optional URL to the full terms of service. */
  termsUrl?: string;
}

export function PrivacyAcceptanceGate({
  open,
  onAccept,
  onCancel,
  privacyUrl = "https://cethos.com/privacy",
  termsUrl = "https://cethos.com/terms",
}: Props) {
  const [checked, setChecked] = useState(false);

  // Reset the checkbox each time the modal re-opens so a stray accept
  // can't carry over across uploads.
  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-semibold text-gray-900">
              Before you upload — privacy &amp; consent
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 text-sm text-gray-700 space-y-3">
          <p>
            The documents you upload here may include personal data — name,
            education, certifications, and financial / insurance details.
            Before you proceed, please confirm:
          </p>

          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              The documents you upload are <strong>yours</strong> or you have
              explicit permission from the document owner to share them.
            </li>
            <li>
              Cethos will store them on encrypted private storage and use them
              <strong> only</strong> for translator competence assessment,
              ISO 17100 audit evidence, and client / regulator inquiries that
              require proof of qualifications.
            </li>
            <li>
              Cethos will not publish, sell, or share your documents with
              third parties beyond what's required to deliver translation
              services you've agreed to.
            </li>
            <li>
              You can request access, correction, or deletion of your data at
              any time by emailing{" "}
              <a
                href="mailto:privacy@cethos.com"
                className="text-teal-600 hover:text-teal-800"
              >
                privacy@cethos.com
              </a>
              . Some records (those tied to invoiced work) must be retained
              under applicable accounting and tax law.
            </li>
            <li>
              You may redact home addresses, government ID numbers, or
              financial figures from the documents you upload — we only need
              what evidences the credential.
            </li>
          </ul>

          <div className="flex flex-wrap gap-3 pt-2 text-xs">
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
            >
              Read the full Privacy Policy <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
            >
              Read the Vendor Terms <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <label className="mt-4 flex items-start gap-2.5 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-800">
              I confirm the above and authorise Cethos to receive, store, and
              process the documents I upload for the purposes described.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (checked) { markPrivacyAccepted(); onAccept(); } }}
            disabled={!checked}
            className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Accept &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}
