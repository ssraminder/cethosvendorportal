/**
 * OnboardingSignTokenPage — /onboarding-sign/:token  (PUBLIC, no login)
 *
 * Sign the External Contractor Onboarding & Compliance Package via the emailed
 * signing-link token. No portal login: the unguessable token (delivered only to
 * the contractor's email) is the identity anchor. Type full legal name, tick the
 * acknowledgement, sign. Mirrors the public token pages (references / iso-evidence).
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ShieldCheck, AlertTriangle, FileText, Download, CheckCircle2, Calendar } from "lucide-react";

const SB_BASE = "/sb";
const LOGO = "https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/png_logo_cethos_light_bg.png";

async function postSb<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SB_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

interface PackageInfo {
  title: string;
  reference_code: string | null;
  contractor_name: string | null;
  language_pair_display: string | null;
  engagement_effective_date: string | null;
  body_html: string;
}

interface GetResp {
  success?: boolean;
  found?: boolean;
  signed?: boolean;
  signed_full_name?: string | null;
  signed_at?: string | null;
  masked_email?: string | null;
  package?: PackageInfo;
  error?: string;
}

interface SignResp { success?: boolean; signature_id?: string; signed_at?: string; already_signed?: boolean; error?: string }

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function OnboardingSignTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [signed, setSigned] = useState(false);
  const [signedName, setSignedName] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const data = await postSb<GetResp>("get-onboarding-by-token", { token });
      if (data?.error) { setError(data.error); setFound(false); }
      else if (!data?.found) { setFound(false); }
      else {
        setFound(true);
        setPkg(data.package ?? null);
        setSigned(!!data.signed);
        setSignedName(data.signed_full_name ?? null);
        setSignedAt(data.signed_at ?? null);
        setMaskedEmail(data.masked_email ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSign = async () => {
    if (!token) return;
    if (typedName.trim().length < 3) { setError("Please type your full legal name."); return; }
    if (!agreed) { setError("Please tick the acknowledgement checkbox."); return; }
    setSubmitting(true);
    setError("");
    try {
      const data = await postSb<SignResp>("sign-onboarding-by-token", { token, signed_full_name: typedName.trim() });
      if (!data.success) { setError(data.error || "Failed to sign"); return; }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSignedCopy = () => {
    if (!pkg || !signedAt || !signedName) return;
    const at = new Date(signedAt).toUTCString();
    const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(pkg.title)} — ${escapeHtml(signedName)}</title>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.6;
   max-width:780px;margin:0 auto;padding:32px 24px;font-size:15px}
 .bar{height:6px;background:linear-gradient(90deg,#0C2340,#0891B2);border-radius:3px;margin-bottom:20px}
 h2{color:#0C2340;font-size:19px;margin:28px 0 8px;padding-top:14px;border-top:1px solid #e2e8f0}
 h3{color:#0f766e;font-size:15px;margin:18px 0 6px} p{margin:9px 0} ul{padding-left:22px} li{margin:4px 0}
 .audit{margin-top:28px;padding:16px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-size:13px}
 .audit b{color:#0C2340}
</style></head><body>
<div class="bar"></div>
${pkg.body_html}
<div class="audit"><h3 style="margin-top:0">Signing audit</h3>
<p><b>Signed by:</b> ${escapeHtml(signedName)}<br><b>Signed at:</b> ${escapeHtml(at)}<br>
<b>Contractor reference:</b> ${escapeHtml(pkg.reference_code ?? "—")}</p>
<p style="color:#475569">Electronically signed via a unique link delivered to the contractor's email. A
countersigned copy is retained by Cethos Solutions Inc.</p></div></body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cethos-onboarding-${pkg.reference_code ?? "package"}-${signedAt.slice(0, 10)}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <img src={LOGO} alt="CETHOS" style={{ height: 26 }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !found ? (
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">This signing link is invalid or has expired</div>
              <div className="mt-0.5">
                {error || "Please use the most recent link from your Cethos email, or contact"}{" "}
                <a className="text-teal-700 underline" href="mailto:vm@cethos.com">vm@cethos.com</a>.
              </div>
            </div>
          </div>
        ) : pkg ? (
          <>
            <div className="flex items-start gap-3 mb-6">
              <FileText className="w-7 h-7 text-teal-600 mt-1" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Onboarding &amp; Compliance Package</h1>
                <p className="text-sm text-gray-600 mt-0.5">
                  {pkg.contractor_name ? <>For {pkg.contractor_name}. </> : null}
                  Please review all seven documents and sign once at the foot of the page.
                </p>
              </div>
            </div>

            {signed && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-green-700 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-green-900">Signed — thank you</div>
                  <div className="text-xs text-green-800 flex items-center gap-3 mt-1">
                    {signedAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(signedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {signedName && (<><span>·</span><span>By: {signedName}</span></>)}
                  </div>
                </div>
                <button onClick={downloadSignedCopy} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-800 bg-white border border-green-300 rounded hover:bg-green-100">
                  <Download className="w-3.5 h-3.5" /> Download signed copy
                </button>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{pkg.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {pkg.reference_code ? <>Reference {pkg.reference_code}</> : null}
                    {pkg.language_pair_display ? <> · {pkg.language_pair_display}</> : null}
                  </p>
                </div>
              </div>
              <div className="nda-body text-gray-800" dangerouslySetInnerHTML={{ __html: pkg.body_html }} />
            </div>

            {!signed && (
              <div className="bg-white border-2 border-teal-500 rounded-lg p-6 space-y-4">
                <h3 className="text-base font-semibold text-gray-900">Sign electronically</h3>
                <p className="text-xs text-gray-600">
                  {maskedEmail ? <>This link was sent to <strong>{maskedEmail}</strong>. </> : null}
                  By typing your full legal name and clicking <strong>Agree &amp; sign</strong>, you electronically
                  execute all seven documents in the package above, including the supersession of your prior agreements
                  (clause 11). We record your name, timestamp, and IP address as proof of signing.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type your full legal name *</label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="e.g. Jane Marie Translator"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                  <span>
                    I have read, understood, and agree to be bound by all seven documents in this onboarding package, and
                    I agree that this package supersedes and replaces my prior agreements with Cethos as set out in clause 11.
                  </span>
                </label>
                {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-800">{error}</div>}
                <button
                  onClick={handleSign}
                  disabled={submitting || typedName.trim().length < 3 || !agreed}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <ShieldCheck className="w-4 h-4" /> Agree &amp; sign
                </button>
              </div>
            )}

            {signed && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Your onboarding package is on file with Cethos. You can download a copy above. Our team will be in touch about your assignments.</span>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
