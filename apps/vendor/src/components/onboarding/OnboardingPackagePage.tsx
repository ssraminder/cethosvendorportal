/**
 * OnboardingPackagePage — /onboarding-package
 *
 * Clickwrap signing for the External Contractor Onboarding & Compliance
 * Package (the 7-document IQVIA package: Services Agreement, NDA, Data
 * Security, Conflict of Interest, Training, Code of Conduct, Qualifications,
 * plus the supersession clause). Distinct from the existing /onboarding
 * CV+NDA+GVSA activation checklist — this is the comprehensive package a
 * specific cohort of external contractors signs once, in place of the
 * separate global NDA/GVSA (which is staff-waived for them).
 *
 * Mirrors the NDA signing UX: re-verify identity via email/phone OTP at the
 * moment of signing, type full legal name, tick the acknowledgement, sign.
 * The fully-rendered package HTML is captured server-side as the immutable
 * audit snapshot.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, ShieldCheck, AlertTriangle, Calendar, FileText, Download,
  Mail, Phone, CheckCircle2,
} from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";

const SB_BASE = "/sb";

async function postSb<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SB_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

interface PackageInfo {
  id: string;
  title: string;
  reference_code: string | null;
  contractor_name: string | null;
  language_pair_display: string | null;
  engagement_effective_date: string | null;
  body_html: string;
}

interface SignatureInfo {
  id: string;
  signed_full_name: string;
  signed_at: string;
}

interface GetResp {
  success?: boolean;
  has_package?: boolean;
  package?: PackageInfo;
  signed?: boolean;
  signature?: SignatureInfo | null;
  error?: string;
}

interface OtpSendResp { success?: boolean; channel?: string; masked_contact?: string; error?: string }
interface OtpVerifyResp { success?: boolean; error?: string }
interface SignResp { success?: boolean; signature_id?: string; signed_at?: string; error?: string; missing?: string[] }

type OtpState = {
  sent: boolean;
  sending: boolean;
  verified: boolean;
  code: string;
  maskedTo: string | null;
  error: string;
};

const blankOtp: OtpState = { sent: false, sending: false, verified: false, code: "", maskedTo: null, error: "" };

export function OnboardingPackagePage() {
  const { sessionToken, vendor } = useVendorAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasPackage, setHasPackage] = useState(false);
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [signed, setSigned] = useState(false);
  const [signature, setSignature] = useState<SignatureInfo | null>(null);

  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  const [emailOtp, setEmailOtp] = useState<OtpState>(blankOtp);
  const [phoneOtp, setPhoneOtp] = useState<OtpState>(blankOtp);
  const [selectedChannel, setSelectedChannel] = useState<"email" | "phone" | null>(null);

  const hasPhone = !!vendor?.phone;
  useEffect(() => {
    if (!hasPhone && selectedChannel === null) setSelectedChannel("email");
  }, [hasPhone, selectedChannel]);
  const allVerified = emailOtp.verified || phoneOtp.verified;

  const load = async () => {
    if (!sessionToken) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const data = await postSb<GetResp>("get-onboarding-package", { session_token: sessionToken });
      if (data?.error) {
        setError(data.error);
      } else if (!data?.has_package) {
        setHasPackage(false);
      } else {
        setHasPackage(true);
        setPkg(data.package ?? null);
        setSigned(!!data.signed);
        setSignature(data.signature ?? null);
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
  }, [sessionToken]);

  const sendOtp = async (channel: "email" | "phone") => {
    if (!sessionToken) return;
    const setter = channel === "email" ? setEmailOtp : setPhoneOtp;
    setter((s) => ({ ...s, sending: true, error: "" }));
    try {
      const resp = await postSb<OtpSendResp>("nda-otp-send", { session_token: sessionToken, channel });
      if (!resp.success) {
        setter((s) => ({ ...s, sending: false, error: resp.error || "Failed to send code" }));
        return;
      }
      setter((s) => ({ ...s, sending: false, sent: true, maskedTo: resp.masked_contact ?? null, error: "" }));
    } catch (e) {
      setter((s) => ({ ...s, sending: false, error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const verifyOtp = async (channel: "email" | "phone") => {
    if (!sessionToken) return;
    const state = channel === "email" ? emailOtp : phoneOtp;
    const setter = channel === "email" ? setEmailOtp : setPhoneOtp;
    if (!/^\d{6}$/.test(state.code.trim())) {
      setter((s) => ({ ...s, error: "Enter the 6-digit code" }));
      return;
    }
    setter((s) => ({ ...s, sending: true, error: "" }));
    try {
      const resp = await postSb<OtpVerifyResp>("nda-otp-verify", {
        session_token: sessionToken,
        channel,
        code: state.code.trim(),
      });
      if (!resp.success) {
        setter((s) => ({ ...s, sending: false, error: resp.error || "Invalid code" }));
        return;
      }
      setter((s) => ({ ...s, sending: false, verified: true, error: "" }));
    } catch (e) {
      setter((s) => ({ ...s, sending: false, error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const handleSign = async () => {
    if (!sessionToken) return;
    if (typedName.trim().length < 3) { setError("Please type your full legal name."); return; }
    if (!agreed) { setError("Please tick the acknowledgement checkbox."); return; }
    if (!allVerified) { setError("Please verify the code sent to you first."); return; }

    setSubmitting(true);
    setError("");
    try {
      const data = await postSb<SignResp>("sign-onboarding-package", {
        session_token: sessionToken,
        signed_full_name: typedName.trim(),
      });
      if (!data.success) {
        setError(data.error || "Failed to sign");
        return;
      }
      setJustSigned(true);
      setEmailOtp(blankOtp);
      setPhoneOtp(blankOtp);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSignedCopy = () => {
    if (!pkg || !signature) return;
    const signedAt = new Date(signature.signed_at).toUTCString();
    const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(pkg.title)} — ${escapeHtml(signature.signed_full_name)}</title>
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
<div class="audit">
  <h3 style="margin-top:0">Signing audit</h3>
  <p><b>Signed by:</b> ${escapeHtml(signature.signed_full_name)}<br>
  <b>Signed at:</b> ${escapeHtml(signedAt)}<br>
  <b>Signature ID:</b> ${escapeHtml(signature.id)}<br>
  <b>Contractor reference:</b> ${escapeHtml(pkg.reference_code ?? "—")}</p>
  <p style="color:#475569">Electronic signature captured with verified identity (email/phone OTP). A countersigned
  copy is retained by Cethos Solutions Inc.</p>
</div></body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cethos-onboarding-${pkg.reference_code ?? "package"}-${signature.signed_at.slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Couldn't load your onboarding package</div>
            <div>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPackage || !pkg) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="p-5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 flex items-start gap-3">
          <FileText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-gray-800">No onboarding package assigned</div>
            <div className="mt-0.5">
              There's no onboarding &amp; compliance package on your profile. If you were expecting one, contact your
              Cethos coordinator or email <a className="text-teal-700 underline" href="mailto:vm@cethos.com">vm@cethos.com</a>.
            </div>
            <Link to="/" className="inline-block mt-3 text-teal-700 underline">Back to portal</Link>
          </div>
        </div>
      </div>
    );
  }

  const showSignForm = !signed && !justSigned;
  const showSignedState = signed || justSigned;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-start gap-3 mb-6">
        <FileText className="w-7 h-7 text-teal-600 mt-1" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Onboarding &amp; Compliance Package</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Your contractor onboarding package — a single agreement covering services, confidentiality, data security,
            and professional conduct. Please review all documents and sign once at the foot of the page.
          </p>
        </div>
      </div>

      {showSignedState && signature && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-green-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-green-900">Signed — your onboarding package is on file</div>
            <div className="text-xs text-green-800 flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(signature.signed_at).toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <span>·</span>
              <span>By: {signature.signed_full_name}</span>
            </div>
          </div>
          <button
            onClick={downloadSignedCopy}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-800 bg-white border border-green-300 rounded hover:bg-green-100"
          >
            <Download className="w-3.5 h-3.5" />
            Download signed copy
          </button>
        </div>
      )}

      {showSignForm && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-900">
            <div className="font-semibold">Signature required</div>
            <div className="text-amber-800">
              Please review the package below and sign to complete your onboarding with Cethos.
            </div>
          </div>
        </div>
      )}

      {/* Package body */}
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

      {showSignForm && (
        <div className="bg-white border-2 border-teal-500 rounded-lg p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Verify your identity</h3>
            <p className="text-xs text-gray-600">
              For ISO audit purposes we re-verify your identity at the moment of signing — even if you're already
              logged in. Choose <strong>email or phone</strong>; either is enough.
            </p>
          </div>

          {hasPhone && !allVerified && selectedChannel === null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedChannel("email")}
                className="flex items-start gap-3 text-left rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50/40 p-3 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Email me a code</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{vendor?.email}</p>
                </div>
              </button>
              <button
                onClick={() => setSelectedChannel("phone")}
                className="flex items-start gap-3 text-left rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50/40 p-3 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Text me a code</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{vendor?.phone}</p>
                </div>
              </button>
            </div>
          )}

          {selectedChannel === "email" && (
            <div className="space-y-2">
              <OtpRow
                icon={<Mail className="w-4 h-4" />}
                label={`Email${vendor?.email ? ` (${vendor.email})` : ""}`}
                state={emailOtp}
                setter={setEmailOtp}
                onSend={() => sendOtp("email")}
                onVerify={() => verifyOtp("email")}
              />
              {hasPhone && !emailOtp.verified && (
                <button
                  onClick={() => { setEmailOtp(blankOtp); setSelectedChannel(null); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Use phone instead
                </button>
              )}
            </div>
          )}

          {selectedChannel === "phone" && (
            <div className="space-y-2">
              <OtpRow
                icon={<Phone className="w-4 h-4" />}
                label={`Phone${vendor?.phone ? ` (${vendor.phone})` : ""}`}
                state={phoneOtp}
                setter={setPhoneOtp}
                onSend={() => sendOtp("phone")}
                onVerify={() => verifyOtp("phone")}
              />
              {!phoneOtp.verified && (
                <button
                  onClick={() => { setPhoneOtp(blankOtp); setSelectedChannel(null); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Use email instead
                </button>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Sign electronically</h3>
            <p className="text-xs text-gray-600">
              By typing your full legal name below and clicking <strong>Agree &amp; sign</strong>, you electronically
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
                disabled={!allVerified}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={!allVerified}
                className="mt-0.5"
              />
              <span>
                I have read, understood, and agree to be bound by all seven documents in this onboarding package, and I
                agree that this package supersedes and replaces my prior agreements with Cethos as set out in clause 11.
              </span>
            </label>
            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-800">{error}</div>
            )}
            <button
              onClick={handleSign}
              disabled={submitting || !allVerified || typedName.trim().length < 3 || !agreed}
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
          <strong>Thank you — signed.</strong> Your onboarding package is now on file with Cethos and downloadable from
          this page anytime. Our team will be in touch about your first assignments.
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface OtpRowProps {
  icon: React.ReactNode;
  label: string;
  state: OtpState;
  setter: React.Dispatch<React.SetStateAction<OtpState>>;
  onSend: () => void;
  onVerify: () => void;
}

function OtpRow({ icon, label, state, setter, onSend, onVerify }: OtpRowProps) {
  return (
    <div className={`rounded-lg border ${state.verified ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50"} p-3`}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
        <span className="text-gray-500">{icon}</span>
        <span className="flex-1">{label}</span>
        {state.verified && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
        )}
      </div>

      {!state.verified && (
        <div className="flex items-center gap-2">
          {!state.sent ? (
            <button
              onClick={onSend}
              disabled={state.sending}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-white border border-teal-300 rounded hover:bg-teal-50 disabled:opacity-50"
            >
              {state.sending ? "Sending…" : "Send code"}
            </button>
          ) : (
            <>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={state.code}
                onChange={(e) => setter((s) => ({ ...s, code: e.target.value.replace(/\D/g, ""), error: "" }))}
                placeholder="6-digit code"
                className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={onVerify}
                disabled={state.sending || state.code.length !== 6}
                className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
              >
                {state.sending ? "Verifying…" : "Verify"}
              </button>
              <button
                onClick={onSend}
                disabled={state.sending}
                className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
              >
                Resend
              </button>
            </>
          )}
        </div>
      )}

      {state.sent && state.maskedTo && !state.verified && (
        <p className="text-xs text-gray-500 mt-1.5">Code sent to {state.maskedTo}. Expires in 10 minutes.</p>
      )}
      {state.error && (
        <p className="text-xs text-red-600 mt-1.5">{state.error}</p>
      )}
    </div>
  );
}
