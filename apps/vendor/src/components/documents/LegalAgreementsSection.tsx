/**
 * LegalAgreementsSection — top of /documents
 *
 * Mirrors the "Legal and Reference Documents" pattern: amber banners
 * for agreements that need (re-)signing, then a table of currently
 * signed documents. Signing + PDF download happen on /nda and /gvsa.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, FileSignature, Loader2 } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { fetchAgreementStatus, type AgreementStatusItem } from "../../hooks/useOnboardingGate";

const DOC_LABEL: Record<string, { title: string; route: string }> = {
  nda: { title: "Confidentiality Agreement (NDA)", route: "/nda" },
  gvsa: { title: "General Vendor Service Agreement", route: "/gvsa" },
};

export function LegalAgreementsSection() {
  const { sessionToken } = useVendorAuth();
  const [loading, setLoading] = useState(true);
  const [agreements, setAgreements] = useState<AgreementStatusItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sessionToken) return;
      const res = await fetchAgreementStatus(sessionToken);
      if (cancelled) return;
      setAgreements(res?.agreements?.filter((a) => a.template || a.current_signature) ?? []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading agreements…
      </div>
    );
  }
  if (agreements.length === 0) return null;

  const pending = agreements.filter((a) => a.needs_signature);
  const signed = agreements.filter((a) => a.current_signature);

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Legal agreements
      </h2>

      {pending.map((a) => (
        <div
          key={a.agreement_type}
          className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0 text-sm text-amber-900">
            {a.current_signature
              ? `There is a new version of the ${DOC_LABEL[a.agreement_type].title}. Please review and sign it to keep your profile current.`
              : `The ${DOC_LABEL[a.agreement_type].title} requires your signature.`}
            {a.grace_ends_at && a.enforcement === "dismissable" && (
              <span className="block text-xs text-amber-700 mt-0.5">
                Signing becomes required on {new Date(a.grace_ends_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.
              </span>
            )}
          </div>
          <Link
            to={DOC_LABEL[a.agreement_type].route}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shrink-0"
          >
            Review &amp; sign
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ))}

      {signed.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">Signed</th>
                <th className="px-4 py-2.5 font-medium">Signed by</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {signed.map((a) => {
                const sig = a.current_signature!;
                return (
                  <tr key={a.agreement_type} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-gray-900 font-medium">
                        <FileSignature className="w-4 h-4 text-teal-600" />
                        {DOC_LABEL[a.agreement_type].title}
                      </span>
                      {a.needs_signature && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                          Older version
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {sig.template_version_label ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {new Date(sig.signed_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{sig.signed_full_name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={DOC_LABEL[a.agreement_type].route}
                        className="text-xs text-teal-700 hover:text-teal-900 font-medium"
                      >
                        View / download
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
