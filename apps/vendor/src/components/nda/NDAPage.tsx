import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle, Calendar, FileText, Download } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";

import { FUNCTIONS_BASE } from "../../api/functionsBase";

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface NDATemplate {
  id: string;
  version_label: string;
  jurisdiction: string;
  title: string;
  body_html: string;
  effective_from: string;
}

interface CurrentSignature {
  id: string;
  nda_template_id: string;
  signed_full_name: string;
  signed_email: string | null;
  signed_at: string;
  signer_ip: string | null;
  signed_html_snapshot: string;
}

interface NDAStatus {
  template: NDATemplate;
  current_signature: CurrentSignature | null;
  needs_signature: boolean;
  reason: string | null;
}

export function NDAPage() {
  const { sessionToken } = useVendorAuth();
  const [status, setStatus] = useState<NDAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  const load = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${FUNCTIONS_BASE}/vendor-get-nda-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (!resp.ok || data?.success === false) {
        setError(data?.error || `HTTP ${resp.status}`);
      } else {
        setStatus(data as NDAStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const handleSign = async () => {
    if (!sessionToken) return;
    if (typedName.trim().length < 3) {
      setError("Please type your full legal name.");
      return;
    }
    if (!agreed) {
      setError("Please tick the agreement checkbox.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const resp = await fetch(`${FUNCTIONS_BASE}/vendor-sign-nda`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signed_full_name: typedName.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || data?.success === false) {
        setError(data?.error || `HTTP ${resp.status}`);
      } else {
        setJustSigned(true);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSnapshot = () => {
    if (!status?.current_signature) return;
    const sig = status.current_signature;
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Cethos NDA — signed copy</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.55;color:#222}h1,h2,h3{font-family:-apple-system,BlinkMacSystemFont,sans-serif}.meta{background:#f6f6f6;padding:14px 18px;border-left:3px solid #888;margin:24px 0;font-family:-apple-system,monospace;font-size:13px}.meta b{display:inline-block;width:140px}</style>
</head><body>
<div class="meta">
  <div><b>Signed by:</b> ${escapeHtml(sig.signed_full_name)}</div>
  <div><b>Email:</b> ${escapeHtml(sig.signed_email ?? "—")}</div>
  <div><b>Signed at:</b> ${new Date(sig.signed_at).toUTCString()}</div>
  <div><b>Signer IP:</b> ${escapeHtml(sig.signer_ip ?? "—")}</div>
  <div><b>Signature ID:</b> ${sig.id}</div>
</div>
${sig.signed_html_snapshot}
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cethos-nda-${sig.signed_at.slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Couldn't load the NDA</div>
            <div>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const sig = status.current_signature;
  const showSignForm = status.needs_signature && !justSigned;
  const showSignedState = !status.needs_signature && sig;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-start gap-3 mb-6">
        <FileText className="w-7 h-7 text-teal-600 mt-1" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Confidentiality Agreement</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Cethos is ISO 17100 certified. We're required to keep a signed
            confidentiality agreement on file for every translator.
          </p>
        </div>
      </div>

      {/* Banner: status */}
      {showSignedState && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-green-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-green-900">
              Signed — version {status.template.version_label}
            </div>
            <div className="text-xs text-green-800 flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(sig!.signed_at).toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <span>·</span>
              <span>By: {sig!.signed_full_name}</span>
            </div>
          </div>
          <button
            onClick={downloadSnapshot}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-800 bg-white border border-green-300 rounded hover:bg-green-100"
          >
            <Download className="w-3.5 h-3.5" /> Download signed copy
          </button>
        </div>
      )}

      {status.needs_signature && !justSigned && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-900">
            <div className="font-semibold">Signature required</div>
            <div className="text-amber-800">{status.reason}</div>
          </div>
        </div>
      )}

      {/* The NDA body */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{status.template.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Version {status.template.version_label}
              {" · "}Effective {new Date(status.template.effective_from).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              {status.template.jurisdiction !== "global" && (<> · {status.template.jurisdiction}</>)}
            </p>
          </div>
        </div>
        <div
          className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: status.template.body_html }}
        />
      </div>

      {/* Sign form */}
      {showSignForm && (
        <div className="bg-white border-2 border-teal-500 rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Sign electronically</h3>
          <p className="text-xs text-gray-600 mb-4">
            By typing your full legal name below and clicking <strong>Agree &amp; sign</strong>,
            you electronically execute the agreement above. This has the same
            legal effect as a handwritten signature. We record your name,
            timestamp, and IP address as proof of signing.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Type your full legal name *
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="e.g. Jane Marie Translator"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I have read and understood the agreement above, and I agree to
                be bound by its terms.
              </span>
            </label>
            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                {error}
              </div>
            )}
            <button
              onClick={handleSign}
              disabled={submitting || typedName.trim().length < 3 || !agreed}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <ShieldCheck className="w-4 h-4" />
              Agree &amp; sign
            </button>
          </div>
        </div>
      )}

      {justSigned && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900">
          <strong>Thank you — signed.</strong> A copy is now on file with Cethos
          and downloadable from this page anytime.
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
