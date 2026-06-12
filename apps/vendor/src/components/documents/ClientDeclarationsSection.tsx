/**
 * ClientDeclarationsSection — /documents
 *
 * NDA clause 3.4: vendors may declare pre-existing client relationships
 * (with supporting evidence) for Cethos review. Approved declarations
 * exempt that client from the non-solicitation restrictions; anything
 * not declared is presumed to have arisen through Cethos.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  XCircle,
} from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { FUNCTIONS_BASE } from "../../api/functionsBase";

interface EvidenceFile {
  path: string;
  name: string;
  size_bytes: number;
  content_type: string;
  url?: string | null;
}

interface Declaration {
  id: string;
  client_name: string;
  relationship_details: string | null;
  first_engaged_date: string | null;
  evidence_files: EvidenceFile[];
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_CHIP: Record<Declaration["status"], { bg: string; fg: string; label: string; icon: typeof Clock }> = {
  pending: { bg: "bg-amber-100", fg: "text-amber-800", label: "Pending review", icon: Clock },
  approved: { bg: "bg-emerald-100", fg: "text-emerald-800", label: "Approved", icon: CheckCircle2 },
  rejected: { bg: "bg-red-100", fg: "text-red-800", label: "Rejected", icon: XCircle },
};

export function ClientDeclarationsSection() {
  const { sessionToken } = useVendorAuth();
  const [loading, setLoading] = useState(true);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [details, setDetails] = useState("");
  const [firstEngaged, setFirstEngaged] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/vendor-list-client-declarations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) setDeclarations(data.declarations ?? []);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!sessionToken || !clientName.trim()) {
      setError("Client name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("client_name", clientName.trim());
      if (details.trim()) form.append("relationship_details", details.trim());
      if (firstEngaged) form.append("first_engaged_date", firstEngaged);
      for (const f of files) form.append("evidence", f);

      const res = await fetch(`${FUNCTIONS_BASE}/vendor-submit-client-declaration`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: form,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Submission failed");
      setClientName("");
      setDetails("");
      setFirstEngaged("");
      setFiles([]);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Pre-existing client declarations
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
          >
            <Plus className="w-3.5 h-3.5" /> Declare a client
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Under clause 3.4 of the Confidentiality Agreement, clients you worked with <em>before</em> your first engagement with Cethos can be exempted from the non-solicitation restrictions — declare them here with supporting evidence (contracts, invoices, emails). Cethos reviews each declaration; undeclared relationships are presumed to have arisen through Cethos.
      </p>

      {showForm && (
        <div className="bg-white border-2 border-teal-500 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Client name *</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Pharma GmbH"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Relationship details — how and when did you start working with them?
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="e.g. Direct client since 2021; regular medical-device translations invoiced quarterly."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">First engaged (approx.)</label>
              <input
                type="date"
                value={firstEngaged}
                onChange={(e) => setFirstEngaged(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Evidence (PDF, image, DOCX, EML — up to 5 files)
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx,.eml,.txt"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
                className="w-full text-xs text-gray-600"
              />
            </div>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {files.map((f) => (
                <span key={f.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">
                  <Paperclip className="w-2.5 h-2.5" /> {f.name}
                </span>
              ))}
            </div>
          )}
          {error && (
            <p className="text-xs text-red-700 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={submitting || !clientName.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit for review
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              disabled={submitting}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : declarations.length === 0 && !showForm ? (
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
          No declarations yet. If every client you work with came through Cethos, there's nothing to do here.
        </div>
      ) : (
        <div className="space-y-2">
          {declarations.map((d) => {
            const chip = STATUS_CHIP[d.status];
            const ChipIcon = chip.icon;
            return (
              <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{d.client_name}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${chip.bg} ${chip.fg}`}>
                        <ChipIcon className="w-3 h-3" /> {chip.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Submitted {new Date(d.created_at).toLocaleDateString()}
                      {d.first_engaged_date && <> · First engaged {d.first_engaged_date}</>}
                    </div>
                    {d.relationship_details && (
                      <p className="text-xs text-gray-600 mt-1.5">{d.relationship_details}</p>
                    )}
                    {d.review_notes && d.status !== "pending" && (
                      <p className="text-xs text-gray-500 mt-1.5 italic">Cethos: "{d.review_notes}"</p>
                    )}
                    {d.evidence_files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {d.evidence_files.map((f) => (
                          <a
                            key={f.path}
                            href={f.url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 hover:bg-teal-50 text-gray-700 text-[11px]"
                          >
                            <FileText className="w-2.5 h-2.5" /> {f.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
