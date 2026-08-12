import { useState, useEffect, useCallback, useRef } from "react";
import { init, createElement } from "@airwallex/components-sdk";
import { FUNCTIONS_BASE, safePost } from "../../api/functionsBase";
import { Loader2, ShieldCheck, CheckCircle, AlertTriangle } from "lucide-react";

// Airwallex Embedded Beneficiary form. Availability is decided by the server
// (manage-vendor-payments awx_embedded_enabled) — as of the 2026-08-11 rollout
// that is every vendor with a live session, not just the original pilot. The
// vendor types bank details straight into Airwallex's hosted form (iframe);
// Cethos stores only the resulting beneficiary object + shows a masked summary.
// See manage-vendor-payments actions awx_embedded_enabled /
// awx_embedded_auth_code / awx_embedded_save_beneficiary.

interface EnabledResp {
  enabled: boolean;
  // Masked one-liner from the server, e.g. "Name · IN · INR · …3503".
  summary?: string | null;
  updated_at?: string | null;
}

// PKCE (RFC 7636, S256) — verifier stays in the browser, only the challenge
// goes to the server.
function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const arr = new Uint8Array(48);
  crypto.getRandomValues(arr);
  const verifier = Array.from(arr, (b) => ("0" + b.toString(16)).slice(-2)).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

async function mvp(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await safePost(`${FUNCTIONS_BASE}/manage-vendor-payments`, body);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export function AirwallexEmbeddedBank({
  sessionToken,
  onEnabledChange,
  onDetailsOnFileChange,
}: {
  sessionToken: string;
  // Lets PaymentInfo hide the manual bank options when this vendor does bank
  // transfers through Airwallex instead.
  onEnabledChange?: (enabled: boolean) => void;
  // Whether a payout account is already saved, so PaymentInfo can say either
  // "please re-enter above" or "these fields are no longer used".
  onDetailsOnFileChange?: (onFile: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const elementRef = useRef<{ submit: () => Promise<any>; unmount?: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionToken) return;
    mvp({ action: "awx_embedded_enabled", session_token: sessionToken })
      .then((r) => {
        const resp = r as unknown as EnabledResp;
        setEnabled(!!resp.enabled);
        onEnabledChange?.(!!resp.enabled);
        setSummary(resp.summary ?? null);
        onDetailsOnFileChange?.(Boolean(resp.summary));
        setUpdatedAt(resp.updated_at ?? null);
      })
      .catch(() => {
        setEnabled(false);
        onEnabledChange?.(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const openForm = useCallback(async () => {
    setError("");
    setSuccess("");
    setOpen(true);
    setLoadingForm(true);
    try {
      const { verifier, challenge } = await pkce();
      const auth = await mvp({
        action: "awx_embedded_auth_code",
        session_token: sessionToken,
        code_challenge: challenge,
      });
      await init({
        locale: "en",
        env: auth.env as "prod" | "demo",
        enabledElements: ["payouts"],
        authCode: String(auth.authorization_code),
        clientId: String(auth.client_id),
        codeVerifier: verifier,
      });
      const element = await createElement("beneficiaryForm", {});
      elementRef.current = element as never;
      if (containerRef.current) element.mount(containerRef.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the Airwallex form");
      setOpen(false);
    } finally {
      setLoadingForm(false);
    }
  }, [sessionToken]);

  const save = useCallback(async () => {
    if (!elementRef.current) return;
    setSaving(true);
    setError("");
    try {
      const result = await elementRef.current.submit();
      const errs = result?.errors && Object.keys(result.errors).length > 0;
      if (errs || !result?.values?.beneficiary) {
        setError("Please complete the highlighted fields above.");
        setSaving(false);
        return;
      }
      const saved = await mvp({
        action: "awx_embedded_save_beneficiary",
        session_token: sessionToken,
        beneficiary: result.values.beneficiary,
        // Airwallex's validate endpoint requires transfer_methods for some
        // corridors (e.g. IN) — forward what the widget selected.
        payment_methods: result.values.payment_methods,
      });
      setSummary(typeof saved.summary === "string" ? saved.summary : null);
      onDetailsOnFileChange?.(typeof saved.summary === "string" && !!saved.summary);
      setUpdatedAt(new Date().toISOString());
      setSuccess("Bank details saved securely via Airwallex.");
      setOpen(false);
      elementRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save bank details");
    } finally {
      setSaving(false);
    }
  }, [sessionToken]);

  if (!enabled) return null;

  // The server's masked summary is a single line ("Name · IN · INR · …3503"),
  // not an object — render it as-is. (Iterating a string with Object.entries
  // printed one row per character; that's the bug this replaces.)
  const summaryText = typeof summary === "string" && summary ? summary : null;

  return (
    <div className="mb-6 rounded-xl border border-teal-200 bg-white p-6">
      <div className="flex items-start gap-3 mb-3">
        <ShieldCheck className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Bank Transfer
            <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">Beta</span>
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter your bank details in the secure form below (powered by
            Airwallex) — Cethos stores only a masked summary.
          </p>
        </div>
      </div>

      {success && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {!open && (
        <div>
          {summaryText && (
            <div className="mb-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
              <div className="font-medium text-gray-900 mb-1">
                On file{updatedAt ? ` · updated ${new Date(updatedAt).toLocaleDateString("en-CA")}` : ""}
              </div>
              <div className="text-gray-800 font-mono text-xs">{summaryText}</div>
            </div>
          )}
          <button
            onClick={openForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
          >
            <ShieldCheck className="h-4 w-4" />
            {summaryText ? "Update bank details with Airwallex" : "Add bank details with Airwallex"}
          </button>
        </div>
      )}

      {open && (
        <div>
          {loadingForm && (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading secure Airwallex form…
            </div>
          )}
          <div ref={containerRef} />
          {!loadingForm && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setOpen(false); elementRef.current = null; }}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Save bank details
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
