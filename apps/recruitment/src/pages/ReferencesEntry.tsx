import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { CheckCircle, Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface RefRow {
  name: string;
  email: string;
  company: string;
  relationship: string;
}

interface PreviewData {
  applicantName: string;
  applicationNumber: string;
  alreadyContactsSubmitted: boolean;
  existingReferences: { reference_name: string; reference_email: string; status: string }[];
}

const blankRef = (): RefRow => ({ name: "", email: "", company: "", relationship: "" });

export function ReferencesEntry() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string>("");
  const [refs, setRefs] = useState<RefRow[]>([blankRef(), blankRef()]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/cvp-submit-reference-contacts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ requestToken: token, validateOnly: true }),
        });
        const data = await resp.json();
        if (cancelled) return;
        if (!resp.ok || data?.success === false) {
          setError(data?.error || `HTTP ${resp.status}`);
        } else {
          setPreview(data.data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateRef = (i: number, field: keyof RefRow, value: string) => {
    setRefs((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const addRef = () => {
    if (refs.length >= 3) return;
    setRefs((prev) => [...prev, blankRef()]);
  };

  const removeRef = (i: number) => {
    if (refs.length <= 1) return;
    setRefs((prev) => prev.filter((_, idx) => idx !== i));
  };

  const validRefs = refs
    .map((r) => ({
      name: r.name.trim(),
      email: r.email.trim(),
      company: r.company.trim(),
      relationship: r.relationship.trim(),
    }))
    .filter((r) => r.name.length >= 2 && /\S+@\S+\.\S+/.test(r.email));

  const handleSubmit = async () => {
    if (validRefs.length < 1) {
      setError("Please add at least one reference with name + email.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cvp-submit-reference-contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ requestToken: token, references: validRefs }),
      });
      const data = await resp.json();
      if (!resp.ok || data?.success === false) {
        setError(data?.detail || data?.error || `HTTP ${resp.status}`);
      } else {
        setSubmittedOk(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 px-6 flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      </Layout>
    );
  }

  if (error && !preview) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 px-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-red-900">Link not valid</h2>
              <p className="text-sm text-red-800 mt-1">
                {error === "token_expired"
                  ? "This reference-request link has expired. Reply to your CETHOS contact and we'll send a fresh one."
                  : error === "invalid_token"
                  ? "We couldn't find this request. The link may have been mistyped."
                  : `We couldn't load this page (${error}).`}
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (submittedOk || preview?.alreadyContactsSubmitted) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 px-6">
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-emerald-900 text-lg">Thanks — references submitted</h2>
              <p className="text-sm text-emerald-800 mt-2">
                We've reached out to each of your references with a short questionnaire. You don't need to do anything else; we'll loop you in once they've responded.
              </p>
              {preview?.existingReferences && preview.existingReferences.length > 0 && (
                <ul className="mt-3 text-sm text-emerald-800 list-disc list-inside">
                  {preview.existingReferences.map((r) => (
                    <li key={r.reference_email}>
                      {r.reference_name} ({r.reference_email}) — {r.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-10 px-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Share your references</h1>
        {preview && (
          <p className="text-sm text-gray-600 mb-6">
            Hi {preview.applicantName.split(" ")[0]} — for application{" "}
            <span className="font-mono text-gray-900">{preview.applicationNumber}</span>, please
            list 1–3 professional references below. We'll email each one a short questionnaire
            directly.
          </p>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-5">
          {refs.map((r, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white relative">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-900">Reference {i + 1}</div>
                {refs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRef(i)}
                    className="text-gray-400 hover:text-red-600 text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full name *</label>
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateRef(i, "name", e.target.value)}
                    placeholder="e.g. Maria Lopez"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={r.email}
                    onChange={(e) => updateRef(i, "email", e.target.value)}
                    placeholder="maria@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Company / org</label>
                  <input
                    type="text"
                    value={r.company}
                    onChange={(e) => updateRef(i, "company", e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Your relationship</label>
                  <input
                    type="text"
                    value={r.relationship}
                    onChange={(e) => updateRef(i, "relationship", e.target.value)}
                    placeholder="e.g. former PM, client of 4 years"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {refs.length < 3 && (
          <button
            type="button"
            onClick={addRef}
            className="mt-3 text-sm text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add another reference
          </button>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || validRefs.length < 1}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Submit {validRefs.length} reference{validRefs.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
