/**
 * OnboardingPage — /onboarding
 *
 * Surfaces the two activation gates (CV + NDA) and links each to its
 * completion path. Auto-redirects to the dashboard once both pass.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ShieldCheck,
  FileText,
  Loader2,
  ChevronRight,
  Sparkles,
  Upload,
  AlertCircle,
} from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { useOnboardingGate } from "../../hooks/useOnboardingGate";
import { uploadCv } from "../../api/vendorCvs";

export function OnboardingPage() {
  const { vendor, sessionToken } = useVendorAuth();
  const { loading, passes, hasCv, hasNda, hasGvsa, cvCount, ndaSignedAt, gvsaSignedAt, ndaWaivedUntil, cvRequired, agreements, refresh } = useOnboardingGate();
  const navigate = useNavigate();
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  // Once the upload itself confirms success we mark the CV step done
  // immediately. The gate's refresh re-reads list-cvs, but that fetch can
  // transiently fail/time out (geo-filtered networks) and return no CVs,
  // which previously left the page stuck on "Upload your CV" even though the
  // upload succeeded (bug a1ed4e6c: "after uploading, the page does not
  // update"). This optimistic flag is the source of truth for the card.
  const [cvJustUploaded, setCvJustUploaded] = useState(false);
  const cvDone = hasCv || cvJustUploaded;

  async function handleCvUpload(file: File) {
    if (!sessionToken) return;
    setCvError(null);
    setUploadingCv(true);
    try {
      const res = await uploadCv(sessionToken, file, "Onboarding upload");
      if (!res.success) throw new Error(res.error ?? "Upload failed");
      setCvJustUploaded(true);
      await refresh();
    } catch (e) {
      setCvError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingCv(false);
    }
  }

  // Re-check whenever the page becomes visible — vendor may have
  // uploaded a CV or signed the NDA in another tab.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Auto-redirect to dashboard the moment both gates clear.
  useEffect(() => {
    if (!loading && passes) {
      const t = setTimeout(() => navigate("/", { replace: true }), 1200);
      return () => clearTimeout(t);
    }
  }, [loading, passes, navigate]);

  const firstName = (vendor?.full_name || "").split(" ")[0] || "there";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              Welcome, {firstName} — let's activate your profile
            </h1>
          </div>
          <p className="text-sm text-gray-600">
            A few quick steps are required before you can start receiving job offers and using the rest of the portal. You can come back to this page any time.
          </p>
        </div>

        {passes && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-900">
              <strong>You're all set.</strong> Redirecting you to your dashboard…
            </div>
          </div>
        )}

        {cvRequired && (
          <div className={`bg-white rounded-xl border p-5 ${cvDone ? "border-emerald-200" : "border-gray-200"}`}>
            <div className="flex items-start gap-3">
              {cvDone ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mt-0.5 shrink-0" />
              ) : (
                <FileText className="w-6 h-6 text-teal-600 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-gray-900">Upload your CV</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  A current CV / résumé is required for ISO 17100 compliance. PDF or Word (.docx), up to 10 MB. Word files are converted to PDF automatically.
                </p>
                {cvDone ? (
                  <p className="mt-2 text-xs text-emerald-700">CV on file{cvCount > 0 ? ` (v${cvCount})` : ""}.</p>
                ) : (
                  <div className="mt-3">
                    <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium cursor-pointer ${uploadingCv ? "bg-gray-100 text-gray-400" : "bg-teal-600 text-white hover:bg-teal-700"}`}>
                      {uploadingCv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingCv ? "Uploading…" : "Upload file"}
                      <input
                        type="file"
                        accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={uploadingCv}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleCvUpload(f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {cvError && (
                      <p className="mt-2 text-xs text-red-700 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        {cvError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <GateCard
          icon={ShieldCheck}
          title="Sign the Confidentiality Agreement (NDA)"
          description="Cethos's confidentiality and non-solicitation agreement. Identity verification via email or phone OTP."
          done={hasNda}
          doneCopy={
            ndaSignedAt
              ? `Signed ${new Date(ndaSignedAt).toLocaleDateString()}.`
              : ndaWaivedUntil
                ? `Waived by Cethos staff through ${new Date(ndaWaivedUntil).toLocaleDateString()}.`
                : "Signed."
          }
          action={hasNda ? null : {
            to: "/nda",
            label: "Sign now",
          }}
        />

        {/* Only surfaced once a GVSA template has been published. */}
        {agreements.some((a) => a.agreement_type === "gvsa" && a.template) && (
          <GateCard
            icon={ShieldCheck}
            title="Sign the General Vendor Service Agreement"
            description="The framework service agreement covering assignments, fees, and work product. Sign the NDA first — the same verification code covers both."
            done={hasGvsa}
            doneCopy={
              gvsaSignedAt
                ? `Signed ${new Date(gvsaSignedAt).toLocaleDateString()}.`
                : ndaWaivedUntil
                  ? `Waived by Cethos staff through ${new Date(ndaWaivedUntil).toLocaleDateString()}.`
                  : "Signed."
            }
            action={hasGvsa ? null : {
              to: "/gvsa",
              label: "Review & sign",
            }}
          />
        )}

        <div className="text-center text-[11px] text-gray-400">
          Questions? Email vendor@cethos.com — we're happy to help.
        </div>
      </div>
    </div>
  );
}

function GateCard({
  icon: Icon,
  title,
  description,
  done,
  doneCopy,
  action,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  done: boolean;
  doneCopy: string;
  action: { to: string; label: string } | null;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-5 ${
        done ? "border-emerald-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-3">
        {done ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mt-0.5 shrink-0" />
        ) : (
          <Icon className="w-6 h-6 text-teal-600 mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-0.5">{description}</p>
          {done ? (
            <p className="mt-2 text-xs text-emerald-700">{doneCopy}</p>
          ) : action ? (
            <Link
              to={action.to}
              className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700"
            >
              {action.label}
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
