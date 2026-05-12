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

interface VerificationFactor {
  otp_id?: string;
  verified_at?: string;
  masked?: string | null;
}

interface VerificationLog {
  channels?: string[];
  email?: VerificationFactor;
  phone?: VerificationFactor;
}

interface CurrentSignature {
  id: string;
  nda_template_id: string;
  signed_full_name: string;
  signed_email: string | null;
  signed_at: string;
  signer_ip: string | null;
  signer_user_agent?: string | null;
  signed_html_snapshot: string;
  verification_log?: VerificationLog | null;
  template_version_label?: string | null;
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
    const versionLabel = status.template.version_label;
    setDownloading(true);
    try {
      const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);

      // Fetch logo + measure its native aspect ratio so we don't squash
      // it. The hardcoded 90x32 size in the previous version produced a
      // visibly skewed logo when the actual asset is closer to 4:1.
      const logo = await fetchLogo();

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Page layout: 80pt top header band, 56pt bottom footer band,
      // 40pt side margins for the body.
      const HEADER_H = 80;
      const FOOTER_H = 56;
      const SIDE = 40;

      // jsPDF.html() handles pagination natively, including page breaks
      // through long content. We feed it a styled DOM and it slices
      // intelligently across pages using its margin args. The previous
      // implementation tried to slice a tall html2canvas image manually
      // and got the math wrong, producing 100+ blank-tail pages.
      const wrap = document.createElement("div");
      wrap.style.cssText = `position:absolute;left:-10000px;top:0;width:${pageWidth - SIDE * 2}pt;background:#fff;color:#1f2937;padding:0`;
      wrap.innerHTML = `
        <style>
          .nda-pdf-body { font-family: 'Times New Roman', Georgia, serif; font-size: 11pt; line-height: 1.55; color: #1f2937; }
          .nda-pdf-body h1, .nda-pdf-body h2, .nda-pdf-body h3 {
            font-family: Helvetica, Arial, sans-serif;
            color: #111827; line-height: 1.25;
            page-break-after: avoid; break-after: avoid;
          }
          .nda-pdf-body h1 { font-size: 16pt; margin: 14pt 0 8pt; }
          .nda-pdf-body h2 { font-size: 13pt; margin: 14pt 0 6pt; }
          .nda-pdf-body h3 { font-size: 11.5pt; margin: 12pt 0 4pt; }
          .nda-pdf-body p { margin: 0 0 8pt; }
          .nda-pdf-body ul, .nda-pdf-body ol { margin: 0 0 8pt 18pt; padding: 0; }
          .nda-pdf-body li { margin: 3pt 0; }
          .nda-pdf-body strong { color: #111827; font-weight: bold; }
        </style>
        <div class="nda-pdf-body">${sig.signed_html_snapshot}</div>
      `;
      document.body.appendChild(wrap);

      try {
        await pdf.html(wrap, {
          x: SIDE,
          y: HEADER_H,
          width: pageWidth - SIDE * 2,
          windowWidth: wrap.offsetWidth,
          margin: [HEADER_H, SIDE, FOOTER_H, SIDE],
          autoPaging: "text",
          html2canvas: { scale: 0.75, useCORS: true, backgroundColor: "#ffffff" },
        });

        // Append an audit page that travels with the signature: factors
        // verified, signer fingerprint, timestamps. Auditor-friendly.
        pdf.addPage();
        drawAuditPage(pdf, {
          sig,
          versionLabel: sig.template_version_label ?? versionLabel,
          pageWidth,
          pageHeight,
          headerH: HEADER_H,
          footerH: FOOTER_H,
          side: SIDE,
        });

        // Header + footer overlays on every page — native PDF text so
        // they stay crisp.
        const pageCount = pdf.getNumberOfPages();
        for (let p = 1; p <= pageCount; p++) {
          pdf.setPage(p);
          drawHeader(pdf, { logo, versionLabel, pageWidth, headerH: HEADER_H, side: SIDE });
          drawFooter(pdf, { sig, pageWidth, pageHeight, footerH: FOOTER_H, side: SIDE, pageNum: p, pageCount });
        }

        pdf.save(`cethos-nda-${versionLabel}-${sig.signed_at.slice(0, 10)}.pdf`);
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

const CETHOS_LOGO_URL = "https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/png_logo_cethos_light_bg.png";

interface LogoData {
  dataUrl: string;
  width: number;
  height: number;
}

async function fetchLogo(): Promise<LogoData | null> {
  try {
    const res = await fetch(CETHOS_LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    // Measure native dimensions so we can preserve aspect ratio when
    // placing into the PDF — the previous hardcoded 90x32pt squashed
    // a logo with a different native aspect.
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("logo image load failed"));
      img.src = dataUrl;
    });
    return { dataUrl, width: dims.w, height: dims.h };
  } catch {
    return null;
  }
}

interface HeaderArgs {
  logo: LogoData | null;
  versionLabel: string;
  pageWidth: number;
  headerH: number;
  side: number;
}

// Disabling explicit jsPDF type for the helpers below — the dynamic
// import gives us a typed instance at the call site, and forwarding
// that type adds a lot of generic noise for no real benefit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawHeader(pdf: any, args: HeaderArgs) {
  const { logo, versionLabel, pageWidth, headerH, side } = args;
  // Logo target height: 36pt; width derived from native aspect ratio.
  if (logo) {
    try {
      const targetH = 36;
      const targetW = (logo.width / logo.height) * targetH;
      pdf.addImage(logo.dataUrl, "PNG", side, (headerH - targetH) / 2, targetW, targetH);
    } catch {
      /* logo failed — fall back silently to text-only header */
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(31, 41, 55);
  pdf.text("Confidentiality & Non-Disclosure Agreement", pageWidth / 2, headerH / 2 - 2, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 128);
  pdf.text(`Version ${versionLabel}`, pageWidth / 2, headerH / 2 + 12, { align: "center" });

  // Underline rule beneath the header band.
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.line(side, headerH - 6, pageWidth - side, headerH - 6);
}

interface FooterArgs {
  sig: { id: string; signed_full_name: string; signed_at: string };
  pageWidth: number;
  pageHeight: number;
  footerH: number;
  side: number;
  pageNum: number;
  pageCount: number;
}

interface AuditArgs {
  sig: CurrentSignature;
  versionLabel: string;
  pageWidth: number;
  pageHeight: number;
  headerH: number;
  footerH: number;
  side: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawAuditPage(pdf: any, args: AuditArgs) {
  const { sig, versionLabel, pageWidth, headerH, side } = args;
  let y = headerH + 14;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(17, 24, 39);
  pdf.text("Signing audit", side, y);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(107, 114, 128);
  pdf.text(
    "Proof-of-identity factors verified at the moment this NDA was signed.",
    side,
    y + 8,
  );
  y += 28;

  // Two-column key/value table.
  const labelX = side;
  const valueX = side + 130;
  const rowGap = 16;
  pdf.setFontSize(10);

  const row = (label: string, value: string) => {
    pdf.setTextColor(107, 114, 128);
    pdf.setFont("helvetica", "normal");
    pdf.text(label, labelX, y);
    pdf.setTextColor(17, 24, 39);
    pdf.setFont("helvetica", "bold");
    // Wrap long values so user-agent strings don't overrun the page.
    const lines = pdf.splitTextToSize(value, pageWidth - valueX - side);
    pdf.text(lines, valueX, y);
    y += rowGap * Math.max(1, lines.length);
  };

  row("Signed by", sig.signed_full_name);
  row("Email", sig.signed_email ?? "—");
  row("Signed at", new Date(sig.signed_at).toUTCString());
  row("Template version", versionLabel);
  row("Signature ID", sig.id);
  row("Signer IP", sig.signer_ip ?? "—");
  if (sig.signer_user_agent) row("User agent", sig.signer_user_agent);

  // Verification log section.
  y += 8;
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.line(side, y, pageWidth - side, y);
  y += 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(17, 24, 39);
  pdf.text("Verification factors", side, y);
  y += rowGap;

  const v = sig.verification_log ?? null;
  if (!v || !v.channels || v.channels.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(10);
    pdf.setTextColor(107, 114, 128);
    pdf.text("No OTP verification recorded on this signature.", side, y);
  } else {
    const channels = v.channels;
    const factor = (label: string, key: "email" | "phone") => {
      const f = v[key];
      if (!f) return;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(22, 101, 52);
      pdf.text(`✓  ${label}`, labelX, y);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(75, 85, 99);
      pdf.text(
        `${f.masked ?? "—"}   ·   verified ${f.verified_at ? new Date(f.verified_at).toUTCString() : "—"}`,
        valueX,
        y,
      );
      y += rowGap;
      if (f.otp_id) {
        pdf.setFontSize(8.5);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`OTP ID: ${f.otp_id}`, valueX, y);
        y += rowGap - 2;
      }
    };
    if (channels.includes("email")) factor("Email OTP", "email");
    if (channels.includes("phone")) factor("Phone OTP", "phone");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawFooter(pdf: any, args: FooterArgs) {
  const { sig, pageWidth, pageHeight, footerH, side, pageNum, pageCount } = args;
  const y0 = pageHeight - footerH;

  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.line(side, y0 + 8, pageWidth - side, y0 + 8);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(107, 114, 128);

  // Left: company address. Two lines.
  pdf.text("Cethos Solutions Inc.", side, y0 + 22);
  pdf.text("Calgary, Alberta, Canada · support@cethos.com", side, y0 + 34);

  // Centre: page numbers.
  pdf.text(`Page ${pageNum} of ${pageCount}`, pageWidth / 2, y0 + 28, { align: "center" });

  // Right: signature ID + signer.
  pdf.text(`Signed by ${sig.signed_full_name}`, pageWidth - side, y0 + 22, { align: "right" });
  pdf.text(`Signature ID: ${sig.id.slice(0, 8)}…`, pageWidth - side, y0 + 34, { align: "right" });
}
