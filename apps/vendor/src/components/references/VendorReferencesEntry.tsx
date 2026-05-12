/**
 * VendorReferencesEntry
 *
 * Public page at /vendor-references/:token. The vendor lands here from
 * the request email and enters 1-3 reference contacts. No login —
 * the token in the URL is the authentication.
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, Plus, X } from "lucide-react";
import { FUNCTIONS_BASE } from "../../api/functionsBase";

interface ContactRow {
  name: string;
  email: string;
  company: string;
  relationship: string;
}

const EMPTY: ContactRow = { name: "", email: "", company: "", relationship: "" };

export function VendorReferencesEntry() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [vendorFullName, setVendorFullName] = useState<string>("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([{ ...EMPTY }]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/vendor-submit-reference-contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_token: token, validate_only: true }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          const code = data?.error ?? "invalid_token";
          setValidationError(
            code === "token_expired" ? "This link has expired. Please ask Cethos for a new one." :
            code === "request_cancelled" ? "This request was cancelled. Please contact Cethos." :
            "This link is not valid. Please check the URL or ask Cethos for a new one.",
          );
        } else {
          setVendorFullName(data.data.vendor_full_name);
          setAlreadySubmitted(!!data.data.already_submitted);
        }
      } catch {
        if (!cancelled) setValidationError("Could not validate the link. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  function updateContact(i: number, patch: Partial<ContactRow>) {
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addContact() {
    if (contacts.length < 3) setContacts((cs) => [...cs, { ...EMPTY }]);
  }
  function removeContact(i: number) {
    setContacts((cs) => cs.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!token) return;
    const cleaned = contacts
      .map((c) => ({ name: c.name.trim(), email: c.email.trim().toLowerCase(), company: c.company.trim(), relationship: c.relationship.trim() }))
      .filter((c) => c.name && c.email);
    if (cleaned.length === 0) {
      setSubmitError("Please add at least one reference with name and email.");
      return;
    }
    for (const c of cleaned) {
      if (!/\S+@\S+\.\S+/.test(c.email)) {
        setSubmitError(`The email "${c.email}" looks invalid.`);
        return;
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/vendor-submit-reference-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_token: token, references: cleaned }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const code = data?.error ?? "submit_failed";
        setSubmitError(
          code === "contacts_already_submitted" ? "Your contacts have already been submitted." :
          code === "token_expired" ? "This link has expired. Please ask Cethos for a new one." :
          data?.detail || "Could not submit. Please try again.",
        );
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitError("Could not submit. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          References for your Cethos profile
        </h1>
        {!validationError && (
          <p className="text-sm text-gray-600 mb-6">
            Add 1–3 professional references — former clients, project managers, or peer translators. We'll email each contact a short questionnaire (under 5 minutes).
          </p>
        )}

        {validationError ? (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="text-sm">{validationError}</p>
          </div>
        ) : submitted ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />
            <div className="text-sm">
              <div className="font-medium">Thanks {vendorFullName.split(" ")[0]}!</div>
              <p className="mt-1">We've emailed each reference. You don't need to do anything else.</p>
            </div>
          </div>
        ) : alreadySubmitted ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-sm">Your references have already been submitted. Thanks!</p>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              {contacts.map((c, i) => (
                <div key={i} className="relative p-4 border border-gray-200 rounded-lg">
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(i)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-700"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Reference {i + 1}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Full name *</label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateContact(i, { name: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={c.email}
                        onChange={(e) => updateContact(i, { email: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                      <input
                        type="text"
                        value={c.company}
                        onChange={(e) => updateContact(i, { company: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Relationship</label>
                      <input
                        type="text"
                        value={c.relationship}
                        onChange={(e) => updateContact(i, { relationship: e.target.value })}
                        placeholder="e.g. Project Manager"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-[#0F9DA0] focus:ring-2 focus:ring-[#0F9DA0]/20 outline-none"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {contacts.length < 3 && (
                <button
                  type="button"
                  onClick={addContact}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0F9DA0] border border-[#0F9DA0] rounded-md hover:bg-[#0F9DA0]/5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another reference
                </button>
              )}
            </div>

            {submitError && (
              <div className="mt-5 flex items-start gap-2 text-sm text-red-700 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0F9DA0] rounded-md hover:bg-[#0d8688] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? "Submitting…" : "Submit references"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
