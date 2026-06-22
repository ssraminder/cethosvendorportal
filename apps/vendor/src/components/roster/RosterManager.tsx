import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  listRoster, upsertRosterLinguist, deleteRosterLinguist, uploadRosterCv,
  listEvidenceDemands, releaseEvidence,
  type RosterLinguist, type RosterReference, type RosterLanguagePair, type RosterUpsertPayload,
  type EvidenceDemand,
} from "../../api/vendorRoster";
import { listGuides } from "../../api/vendorGuides";
import { SearchableSelect, type SelectOption } from "../shared/SearchableSelect";
import {
  Users, Plus, X, Pencil, Trash2, Upload, CheckCircle2, AlertCircle, ShieldCheck, Loader2, FileText,
  FolderUp, Inbox, BookOpen,
} from "lucide-react";

const EMPTY_REF: RosterReference = { competence_bases: [], role_types: [], subject_matters: [], languages: [] };

export function RosterManager() {
  const { sessionToken } = useVendorAuth();
  const [roster, setRoster] = useState<RosterLinguist[]>([]);
  const [reference, setReference] = useState<RosterReference>(EMPTY_REF);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<RosterLinguist | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [demands, setDemands] = useState<EvidenceDemand[]>([]);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const cvTargetId = useRef<string | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const evidenceDemandId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const [res, dem, guides] = await Promise.all([
        listRoster(sessionToken),
        listEvidenceDemands(sessionToken, false),
        listGuides(sessionToken).catch(() => ({ documents: [] as any[] })),
      ]);
      if (res.error) { setError(res.error); }
      else {
        setRoster(res.roster ?? []);
        setReference(res.reference ?? EMPTY_REF);
        setError("");
      }
      setDemands(dem.demands ?? []);
      const docs = (guides as any).documents ?? [];
      const guide = docs.find((d: any) => d.doc_code === "CTH-ARG-001") ?? docs[0] ?? null;
      setGuideUrl(guide?.url ?? null);
    } catch {
      setError("Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setShowModal(true); };
  const openEdit = (l: RosterLinguist) => { setEditing(l); setShowModal(true); };

  const handleDelete = async (l: RosterLinguist) => {
    if (!sessionToken) return;
    if (!window.confirm(`Remove ${l.handle} from your roster?`)) return;
    setBusyId(l.id);
    try {
      const res = await deleteRosterLinguist(sessionToken, l.id);
      if (res.error) setError(res.error); else await load();
    } finally { setBusyId(null); }
  };

  const triggerRelease = (demandId: string) => { evidenceDemandId.current = demandId; evidenceInputRef.current?.click(); };
  const onEvidenceSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    e.target.value = "";
    const demandId = evidenceDemandId.current;
    if (!fileList || fileList.length === 0 || !demandId || !sessionToken) return;
    setReleasingId(demandId);
    try {
      const res = await releaseEvidence(sessionToken, demandId, Array.from(fileList));
      if (res.error) setError(res.detail || res.error); else await load();
    } finally { setReleasingId(null); }
  };

  const triggerCvUpload = (id: string) => { cvTargetId.current = id; cvInputRef.current?.click(); };
  const onCvSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const id = cvTargetId.current;
    if (!file || !id || !sessionToken) return;
    setBusyId(id);
    try {
      const res = await uploadRosterCv(sessionToken, id, file);
      if (res.error) setError(res.detail || res.error); else await load();
    } finally { setBusyId(null); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 text-[#0F9DA0] animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <input ref={cvInputRef} type="file" className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={onCvSelected} />
      <input ref={evidenceInputRef} type="file" multiple className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={onEvidenceSelected} />

      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" /> Linguist Roster
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            The subcontractors you assign to Cethos projects. You pick one for each step at delivery time.
          </p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 shrink-0">
          <Plus className="w-4 h-4" /> Add linguist
        </button>
      </div>

      {/* Link to the training guide */}
      {guideUrl && (
        <a href={guideUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-4 py-2.5 mb-3 text-sm text-gray-700 hover:border-teal-300 hover:bg-teal-50/40 transition-colors">
          <BookOpen className="w-4 h-4 text-teal-600 shrink-0" />
          <span>New here? Read the <span className="font-medium text-teal-700">Agency Linguist Roster Guide</span> — building your roster &amp; tagging linguists at delivery.</span>
        </a>
      )}

      {/* Privacy + ISO explainer */}
      <div className="rounded-lg bg-teal-50 border border-teal-200 p-4 mb-5 text-sm text-teal-900">
        <p className="font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Your roster is private.</p>
        <p className="mt-1 text-teal-800">
          Cethos sees only an opaque handle, the language pairs, specializations and a readiness flag — never the
          real name, CV, or evidence files. You attest that each linguist meets ISO 17100 §6.1 competence and that
          you hold their evidence; Cethos may request those documents for a specific project, and you release them then.
        </p>
      </div>

      {/* Evidence requests from Cethos */}
      {demands.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-5">
          <p className="font-medium text-amber-900 flex items-center gap-2 mb-2">
            <Inbox className="w-4 h-4" /> Evidence requested by Cethos ({demands.length})
          </p>
          <div className="space-y-2">
            {demands.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-3 rounded-lg bg-white border border-amber-200 p-3">
                <div className="text-sm text-gray-700 min-w-0">
                  <p className="font-medium text-gray-900">
                    {d.handle ?? "Linguist"}{d.order_number ? ` · ${d.order_number}` : ""}{d.step_label ? ` · ${d.step_label}` : ""}
                  </p>
                  {d.reason && <p className="text-xs text-gray-500 mt-0.5">{d.reason}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">Requested {new Date(d.raised_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => triggerRelease(d.id)} disabled={releasingId === d.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 shrink-0">
                  {releasingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderUp className="w-3.5 h-3.5" />}
                  Upload & release
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {roster.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
          <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm">No linguists yet. Add the subcontractors you use for Cethos work.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roster.map((l) => (
            <RosterCard key={l.id} linguist={l} reference={reference} busy={busyId === l.id}
              onEdit={() => openEdit(l)} onDelete={() => handleDelete(l)} onUploadCv={() => triggerCvUpload(l.id)} />
          ))}
        </div>
      )}

      {showModal && (
        <RosterModal
          linguist={editing}
          reference={reference}
          onClose={() => setShowModal(false)}
          onSaved={async () => { setShowModal(false); await load(); }}
        />
      )}
    </div>
  );
}

function RosterCard({ linguist, reference, busy, onEdit, onDelete, onUploadCv }: {
  linguist: RosterLinguist; reference: RosterReference; busy: boolean;
  onEdit: () => void; onDelete: () => void; onUploadCv: () => void;
}) {
  const domainNames = linguist.domain_ids
    .map((id) => reference.subject_matters.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];
  const competence = reference.competence_bases.find((c) => c.code === linguist.competence_basis_code);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{linguist.handle}</span>
            {linguist.real_name && <span className="text-xs text-gray-400">({linguist.real_name})</span>}
            {linguist.is_eligible ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold">
                <AlertCircle className="w-3 h-3" /> Incomplete
              </span>
            )}
            {!linguist.is_active && (
              <span className="rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-[11px]">Inactive</span>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-600 space-y-1">
            {competence && <p><span className="text-gray-400">Competence:</span> {competence.short_label}</p>}
            <p><span className="text-gray-400">Roles:</span> {linguist.role_codes.length ? linguist.role_codes.join(", ") : "—"}</p>
            <p><span className="text-gray-400">Pairs:</span> {linguist.language_pairs.length
              ? linguist.language_pairs.map((p) => `${p.source_language}→${p.target_language}`).join(", ") : "—"}</p>
            <p><span className="text-gray-400">Specializations:</span> {domainNames.length ? domainNames.join(", ") : "—"}</p>
            <p className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-gray-400" />
              {linguist.has_cv
                ? <span>CV on file{linguist.cv_original_filename ? ` (${linguist.cv_original_filename})` : ""}</span>
                : <span className="text-amber-600">No CV uploaded</span>}
            </p>
            <p><ShieldCheck className="w-3 h-3 inline text-gray-400 mr-1" />
              {linguist.iso_attested ? "ISO competence attested" : <span className="text-amber-600">Attestation pending</span>}</p>
          </div>
          {!linguist.is_eligible && linguist.missing.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-700">Needs: {linguist.missing.join(" · ")}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {busy && <Loader2 className="w-4 h-4 text-gray-400 animate-spin mr-1" />}
          <button onClick={onUploadCv} title={linguist.has_cv ? "Replace CV" : "Upload CV"}
            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-lg"><Upload className="w-4 h-4" /></button>
          <button onClick={onEdit} title="Edit"
            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
          <button onClick={onDelete} title="Remove"
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function RosterModal({ linguist, reference, onClose, onSaved }: {
  linguist: RosterLinguist | null; reference: RosterReference;
  onClose: () => void; onSaved: () => void;
}) {
  const { sessionToken } = useVendorAuth();
  const [handle, setHandle] = useState(linguist?.handle ?? "");
  const [realName, setRealName] = useState(linguist?.real_name ?? "");
  const [competence, setCompetence] = useState(linguist?.competence_basis_code ?? "");
  const [roleCodes, setRoleCodes] = useState<string[]>(linguist?.role_codes ?? []);
  const [domainIds, setDomainIds] = useState<string[]>(linguist?.domain_ids ?? []);
  const [pairs, setPairs] = useState<RosterLanguagePair[]>(linguist?.language_pairs ?? []);
  const [isoAttested, setIsoAttested] = useState(linguist?.iso_attested ?? false);
  const [isActive, setIsActive] = useState(linguist?.is_active ?? true);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const langOptions: SelectOption[] = useMemo(
    () => reference.languages.map((l) => ({ value: l.code, label: `${l.name} (${l.code})` })),
    [reference.languages],
  );

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const addPair = () => {
    if (!newSource || !newTarget) return;
    const s = newSource.toUpperCase(), t = newTarget.toUpperCase();
    if (pairs.some((p) => p.source_language === s && p.target_language === t)) return;
    setPairs([...pairs, { source_language: s, target_language: t }]);
    setNewSource(""); setNewTarget("");
  };

  const handleSave = async () => {
    if (!sessionToken) return;
    if (!handle.trim()) { setError("A handle is required (e.g. L-01)."); return; }
    setSaving(true); setError("");
    const payload: RosterUpsertPayload = {
      id: linguist?.id,
      handle: handle.trim(),
      real_name: realName.trim() || null,
      competence_basis_code: competence || null,
      is_active: isActive,
      iso_attested: isoAttested,
      language_pairs: pairs,
      domain_ids: domainIds,
      role_codes: roleCodes,
    };
    try {
      const res = await upsertRosterLinguist(sessionToken, payload);
      if (res.error) setError(res.detail || res.error); else onSaved();
    } catch {
      setError("Failed to save");
    } finally { setSaving(false); }
  };

  // Subject matters: top-level groups first, then children
  const sortedDomains = useMemo(
    () => [...reference.subject_matters].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [reference.subject_matters],
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{linguist ? "Edit linguist" : "Add linguist"}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Handle <span className="text-red-500">*</span></label>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="e.g. L-01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              <p className="mt-1 text-xs text-gray-400">An opaque label visible to Cethos.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Internal name <span className="text-gray-400 font-normal">(optional, private)</span></label>
              <input value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="For your reference only"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              <p className="mt-1 text-xs text-gray-400">Never shown to Cethos.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Competence basis (ISO 17100 §3.1.4)</label>
            <select value={competence} onChange={(e) => setCompetence(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500">
              <option value="">Select competence basis…</option>
              {reference.competence_bases.map((c) => (
                <option key={c.code} value={c.code}>{c.short_label}{c.iso_clause_reference ? ` — ${c.iso_clause_reference}` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
            <div className="flex flex-wrap gap-2">
              {reference.role_types.map((r) => (
                <button key={r.code} type="button" onClick={() => toggle(roleCodes, r.code, setRoleCodes)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${roleCodes.includes(r.code)
                    ? "bg-teal-50 text-teal-700 border-teal-300" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language pairs</label>
            {pairs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pairs.map((p, i) => (
                  <span key={`${p.source_language}-${p.target_language}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                    {p.source_language}→{p.target_language}
                    <button onClick={() => setPairs(pairs.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1"><SearchableSelect options={langOptions} value={newSource} onChange={setNewSource} placeholder="Source" /></div>
              <span className="pb-2 text-gray-400">→</span>
              <div className="flex-1"><SearchableSelect options={langOptions} value={newTarget} onChange={setNewTarget} placeholder="Target" /></div>
              <button type="button" onClick={addPair}
                className="px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100">Add</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Specializations / domains</label>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 p-2 grid grid-cols-2 gap-1">
              {sortedDomains.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-xs text-gray-700 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={domainIds.includes(s.id)} onChange={() => toggle(domainIds, s.id, setDomainIds)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <span className={s.level && s.level > 1 ? "" : "font-medium"}>{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700 rounded-lg bg-gray-50 border border-gray-200 p-3 cursor-pointer">
            <input type="checkbox" checked={isoAttested} onChange={(e) => setIsoAttested(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
            <span>
              I confirm this linguist meets the ISO 17100 §6.1 competence requirements, that we hold the supporting
              evidence (degrees, certificates and/or documented experience), and that we will produce it, with personal
              information redacted, on demand if Cethos or its client requests it.
            </span>
          </label>

          {linguist && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Active (available to assign to projects)
            </label>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {linguist ? "Save changes" : "Add linguist"}
          </button>
        </div>
      </div>
    </div>
  );
}
