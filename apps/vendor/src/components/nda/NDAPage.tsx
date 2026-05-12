import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle, Calendar, FileText, Download, Mail, Phone, CheckCircle2 } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";

// Same-origin /sb/* (Netlify Function → Postgres). Mirrors the Phase 2/3
// bypass — keeps the NDA flow working from regions that block Supabase
// edge domains.
const SB_BASE = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "/sb"
  : "/sb";

async function postSb<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SB_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

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
  error?: string;
}

interface OtpSendResp { success?: boolean; channel?: string; masked_contact?: string; error?: string }
interface OtpVerifyResp { success?: boolean; error?: string }
interface SignResp { success?: boolean; signature_id?: string; error?: string; missing?: string[] }

type OtpState = {
  sent: boolean;
  sending: boolean;
  verified: boolean;
  code: string;
  maskedTo: string | null;
  error: string;
};

const blankOtp: OtpState = { sent: false, sending: false, verified: false, code: "", maskedTo: null, error: "" };

export function NDAPage() {
  const { sessionToken, vendor } = useVendorAuth();
  const [status, setStatus] = useState<NDAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Two-factor OTP state. Phone is only relevant when vendor.phone is set.
  const [emailOtp, setEmailOtp] = useState<OtpState>(blankOtp);
  const [phoneOtp, setPhoneOtp] = useState<OtpState>(blankOtp);

  const hasPhone = !!vendor?.phone;
  // Either channel is enough. Showing both keeps the option open for
  // vendors who prefer one over the other (poor email reach vs. phone
  // landed in a different country), and the audit log records which
  // factor was used.
  const allVerified = emailOtp.verified || phoneOtp.verified;

  const load = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await postSb<NDAStatus>("get-nda-status", { session_token: sessionToken });
      if (data?.error) {
        setError(data.error);
      } else {
        setStatus(data);
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
    if (!agreed) { setError("Please tick the agreement checkbox."); return; }
    if (!allVerified) { setError("Please verify the codes sent to you first."); return; }

    setSubmitting(true);
    setError("");
    try {
      const data = await postSb<SignResp>("sign-nda", {
        session_token: sessionToken,
        signed_full_name: typedName.trim(),
      });
      if (!data.success) {
        setError(data.error || "Failed to sign");
        return;
      }
      setJustSigned(true);
      // Reset OTP state — next sign (if ever) will require fresh codes.
      setEmailOtp(blankOtp);
      setPhoneOtp(blankOtp);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSnapshot = async () => {
    if (!status?.current_signature) return;
    const sig = status.current_signature;
    setDownloading(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;left:-99999px;top:0;width:794px;padding:48px 56px;background:#fff;font-family:Georgia,serif;line-height:1.55;color:#222";
      wrap.innerHTML = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f6f6f6;padding:14px 18px;border-left:3px solid #888;margin:0 0 24px;font-size:12px">
          <div><b style="display:inline-block;width:140px">Signed by:</b> ${escapeHtml(sig.signed_full_name)}</div>
          <div><b style="display:inline-block;width:140px">Email:</b> ${escapeHtml(sig.signed_email ?? "—")}</div>
          <div><b style="display:inline-block;width:140px">Signed at:</b> ${new Date(sig.signed_at).toUTCString()}</div>
          <div><b style="display:inline-block;width:140px">Signer IP:</b> ${escapeHtml(sig.signer_ip ?? "—")}</div>
          <div><b style="display:inline-block;width:140px">Signature ID:</b> ${sig.id}</div>
        </div>
        ${sig.signed_html_snapshot}
      `;
      document.body.appendChild(wrap);
      try {
        const canvas = await html2canvas(wrap, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/png");
        if (imgHeight <= pageHeight) {
          pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
        } else {
          let heightLeft = imgHeight;
          let position = 0;
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          while (heightLeft > 0) {
            position -= pageHeight;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
        }
        pdf.save(`cethos-nda-${sig.signed_at.slice(0, 10)}.pdf`);
      } finally {
        document.body.removeChild(wrap);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
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
            Cethos is working toward ISO 17100 certification. As part of
            that, we keep a signed confidentiality agreement on file for
            every translator we work with.
          </p>
        </div>
      </div>

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
            disabled={downloading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-800 bg-white border border-green-300 rounded hover:bg-green-100 disabled:opacity-60"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {downloading ? "Generating PDF…" : "Download signed copy (PDF)"}
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

      {/* OTP gating + sign form */}
      {showSignForm && (
        <div className="bg-white border-2 border-teal-500 rounded-lg p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Verify your identity</h3>
            <p className="text-xs text-gray-600">
              For ISO audit purposes we re-verify your identity at the moment of signing — even if you're already logged in. Verify <strong>either</strong> your email or phone to continue.
            </p>
          </div>

          <OtpRow
            icon={<Mail className="w-4 h-4" />}
            label={`Email${vendor?.email ? ` (${vendor.email})` : ""}`}
            state={emailOtp}
            setter={setEmailOtp}
            onSend={() => sendOtp("email")}
            onVerify={() => verifyOtp("email")}
          />

          {hasPhone ? (
            <OtpRow
              icon={<Phone className="w-4 h-4" />}
              label={`Phone${vendor?.phone ? ` (${vendor.phone})` : ""}`}
              state={phoneOtp}
              setter={setPhoneOtp}
              onSend={() => sendOtp("phone")}
              onVerify={() => verifyOtp("phone")}
            />
          ) : (
            <div className="text-xs text-gray-500 italic px-1">
              No phone on file. Add a phone in your Profile if you'd like to verify by SMS.
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Sign electronically</h3>
            <p className="text-xs text-gray-600">
              By typing your full legal name below and clicking <strong>Agree &amp; sign</strong>, you electronically execute the agreement above. We record your name, timestamp, and IP address as proof of signing.
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
              <span>I have read and understood the agreement above, and I agree to be bound by its terms.</span>
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
          <strong>Thank you — signed.</strong> A copy is now on file with Cethos and downloadable from this page anytime.
        </div>
      )}
    </div>
  );
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
