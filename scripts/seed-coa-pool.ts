/**
 * Seed the qualified COA translator pool into the QMS schema.
 *
 * Spec source: D:\cethos-vendor\Documents\claude-code-prompt-cethos-qms-phase-1.md §10.5
 *              D:\cethos-vendor\Documents\cethos-audit-readiness-and-iso-roadmap-v0.2.md §3.4
 *              D:\cethos-vendor\Documents\training-fayza-prerequisite-vendor-management-v0.1.md §6
 *
 * Input CSV format (UTF-8, comma-delimited, headers required):
 *   vendor_email          (required, must match an existing public.vendors.email)
 *   role                  (translator | reviser | post_editor | interpreter)
 *   competence_basis      (one of qms.competence_bases.code)
 *   competence_basis_notes (free text, e.g. "MA Translation, Univ of Geneva 2014")
 *   subject_matter_codes  (semicolon-separated list of qms.subject_matters.code)
 *   language_pairs        (semicolon-separated "src->tgt" pairs using public.languages.code,
 *                          e.g. "es->en;es-MX->en-US")
 *   nda_template_version  (e.g. "v2.0")
 *   nda_signed_date       (YYYY-MM-DD)
 *   nda_expiry_date       (YYYY-MM-DD, optional)
 *   evidence_titles       (semicolon-separated list of evidence titles to record)
 *   evidence_types        (semicolon-separated codes from qms.evidence_types, same order)
 *   notes                 (free-text internal notes — not exposed to project_manager or auditor)
 *
 * One CSV row per (vendor × role) qualification. Re-running is idempotent on
 * the (vendor_id, role_type_id) UNIQUE constraint and the partial unique NDA
 * index (one active NDA per vendor).
 *
 * Every insert mirrors an entry into qms.qualification_audit_log so the audit
 * trail starts from seed time.
 *
 * Usage:
 *   SUPABASE_URL=https://lmzoyezvsjgsxveoakdr.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<sb_secret_*> \
 *   QUALIFIED_BY_STAFF_ID=<uuid of Fayza's staff_users.id> \
 *   COA_POOL_CSV=./coa-pool.csv \
 *   npx tsx scripts/seed-coa-pool.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

interface CoaRow {
  vendor_email: string;
  role: "translator" | "reviser" | "post_editor" | "interpreter";
  competence_basis: string;
  competence_basis_notes: string;
  subject_matter_codes: string[];
  language_pairs: Array<{ source: string; target: string }>;
  nda_template_version: string;
  nda_signed_date: string;
  nda_expiry_date: string | null;
  evidence_titles: string[];
  evidence_types: string[];
  notes: string;
}

function parseCsv(raw: string): CoaRow[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => {
    const i = headers.indexOf(name);
    if (i < 0) throw new Error(`CSV missing column: ${name}`);
    return i;
  };
  const cVendorEmail = idx("vendor_email");
  const cRole = idx("role");
  const cBasis = idx("competence_basis");
  const cBasisNotes = idx("competence_basis_notes");
  const cSubjects = idx("subject_matter_codes");
  const cPairs = idx("language_pairs");
  const cNdaTpl = idx("nda_template_version");
  const cNdaSigned = idx("nda_signed_date");
  const cNdaExpiry = idx("nda_expiry_date");
  const cEvTitles = idx("evidence_titles");
  const cEvTypes = idx("evidence_types");
  const cNotes = idx("notes");

  const rows: CoaRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const pairsRaw = (cols[cPairs] ?? "").split(";").map((s) => s.trim()).filter(Boolean);
    const pairs = pairsRaw.map((p) => {
      const m = p.split("->").map((s) => s.trim());
      if (m.length !== 2) throw new Error(`bad pair on row ${i + 1}: ${p}`);
      return { source: m[0], target: m[1] };
    });
    rows.push({
      vendor_email: (cols[cVendorEmail] ?? "").trim().toLowerCase(),
      role: ((cols[cRole] ?? "").trim() as CoaRow["role"]),
      competence_basis: (cols[cBasis] ?? "").trim(),
      competence_basis_notes: (cols[cBasisNotes] ?? "").trim(),
      subject_matter_codes: (cols[cSubjects] ?? "").split(";").map((s) => s.trim()).filter(Boolean),
      language_pairs: pairs,
      nda_template_version: (cols[cNdaTpl] ?? "").trim(),
      nda_signed_date: (cols[cNdaSigned] ?? "").trim(),
      nda_expiry_date: ((cols[cNdaExpiry] ?? "").trim() || null),
      evidence_titles: (cols[cEvTitles] ?? "").split(";").map((s) => s.trim()).filter(Boolean),
      evidence_types: (cols[cEvTypes] ?? "").split(";").map((s) => s.trim()).filter(Boolean),
      notes: (cols[cNotes] ?? "").trim(),
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === ",") { out.push(cur); cur = ""; }
      else if (ch === '"') inQuotes = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const qualifiedBy = process.env.QUALIFIED_BY_STAFF_ID;
  const csvPath = process.env.COA_POOL_CSV;
  if (!url || !key || !qualifiedBy || !csvPath) {
    console.error("missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, QUALIFIED_BY_STAFF_ID, COA_POOL_CSV");
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    console.log("no rows in CSV — nothing to seed");
    return;
  }
  console.log(`parsed ${rows.length} CSV rows`);

  const sb = createClient(url, key);
  const qms = sb.schema("qms");

  // Pre-load lookup maps
  const [{ data: roleTypes }, { data: bases }, { data: subjects }, { data: evTypes }] = await Promise.all([
    qms.from("role_types").select("id, code"),
    qms.from("competence_bases").select("id, code"),
    qms.from("subject_matters").select("id, code"),
    qms.from("evidence_types").select("id, code"),
  ]);
  if (!roleTypes || !bases || !subjects || !evTypes) {
    throw new Error("failed to load qms lookups — check schema is applied");
  }
  const roleByCode = new Map(roleTypes.map((r: { id: string; code: string }) => [r.code, r.id]));
  const basisByCode = new Map(bases.map((r: { id: string; code: string }) => [r.code, r.id]));
  const subjectByCode = new Map(subjects.map((r: { id: string; code: string }) => [r.code, r.id]));
  const evTypeByCode = new Map(evTypes.map((r: { id: string; code: string }) => [r.code, r.id]));

  const today = new Date().toISOString().slice(0, 10);
  const reQualDueIso = addDaysIso(today, 365);

  let seeded = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      // Resolve vendor
      const { data: vendor, error: vErr } = await sb
        .from("vendors")
        .select("id, email, full_name")
        .ilike("email", row.vendor_email)
        .maybeSingle();
      if (vErr) throw vErr;
      if (!vendor) {
        console.warn(`  skip ${row.vendor_email}: not in public.vendors`);
        skipped++;
        continue;
      }
      const vendorId = vendor.id as string;

      const roleTypeId = roleByCode.get(row.role);
      const basisId = basisByCode.get(row.competence_basis);
      if (!roleTypeId) throw new Error(`unknown role ${row.role}`);
      if (!basisId) throw new Error(`unknown competence_basis ${row.competence_basis}`);

      // Upsert role qualification
      const { data: existingRq } = await qms
        .from("role_qualifications")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("role_type_id", roleTypeId)
        .maybeSingle();

      let roleQualId: string;
      let priorStatus: string | null = null;
      if (existingRq) {
        roleQualId = existingRq.id as string;
        const { data: prior } = await qms
          .from("role_qualifications")
          .select("status")
          .eq("id", roleQualId)
          .maybeSingle();
        priorStatus = (prior?.status as string | null) ?? null;
        await qms
          .from("role_qualifications")
          .update({
            competence_basis_id: basisId,
            competence_basis_notes: row.competence_basis_notes,
            status: "qualified",
            qualified_at: new Date().toISOString(),
            qualified_by: qualifiedBy,
            re_qualification_due: reQualDueIso,
            internal_notes: row.notes || null,
          })
          .eq("id", roleQualId);
      } else {
        const { data: inserted, error: rqErr } = await qms
          .from("role_qualifications")
          .insert({
            vendor_id: vendorId,
            role_type_id: roleTypeId,
            competence_basis_id: basisId,
            competence_basis_notes: row.competence_basis_notes,
            status: "qualified",
            qualified_at: new Date().toISOString(),
            qualified_by: qualifiedBy,
            re_qualification_due: reQualDueIso,
            internal_notes: row.notes || null,
          })
          .select("id")
          .single();
        if (rqErr) throw rqErr;
        roleQualId = inserted!.id as string;
      }

      // Evidence (no file at this stage — Amrita uploads to qms-evidence bucket separately)
      const evidenceIds: string[] = [];
      const evMax = Math.max(row.evidence_titles.length, row.evidence_types.length);
      for (let i = 0; i < evMax; i++) {
        const title = row.evidence_titles[i] ?? row.evidence_types[i];
        const typeCode = row.evidence_types[i];
        if (!typeCode) continue;
        const typeId = evTypeByCode.get(typeCode);
        if (!typeId) {
          console.warn(`  evidence type unknown for ${row.vendor_email}: ${typeCode}`);
          continue;
        }
        const { data: ev, error: evErr } = await qms
          .from("competence_evidence")
          .insert({
            vendor_id: vendorId,
            role_qualification_id: roleQualId,
            evidence_type_id: typeId,
            title: title || typeCode,
            verified: false,
          })
          .select("id")
          .single();
        if (evErr) throw evErr;
        evidenceIds.push(ev!.id as string);
      }

      // Subject matter qualifications
      for (const code of row.subject_matter_codes) {
        const subjectId = subjectByCode.get(code);
        if (!subjectId) {
          console.warn(`  subject_matter unknown for ${row.vendor_email}: ${code}`);
          continue;
        }
        await qms
          .from("subject_matter_qualifications")
          .upsert(
            {
              role_qualification_id: roleQualId,
              subject_matter_id: subjectId,
              proficiency_level: "experienced",
            },
            { onConflict: "role_qualification_id,subject_matter_id" },
          );
      }

      // Language pair qualifications — resolve via public.languages.code
      for (const pair of row.language_pairs) {
        const { data: srcLang } = await sb
          .from("languages")
          .select("id")
          .ilike("code", pair.source)
          .maybeSingle();
        const { data: tgtLang } = await sb
          .from("languages")
          .select("id")
          .ilike("code", pair.target)
          .maybeSingle();
        if (!srcLang || !tgtLang) {
          console.warn(`  language pair unresolved for ${row.vendor_email}: ${pair.source}->${pair.target}`);
          continue;
        }
        await qms
          .from("language_pair_qualifications")
          .upsert(
            {
              role_qualification_id: roleQualId,
              source_language_id: srcLang.id,
              target_language_id: tgtLang.id,
              direction: row.role === "interpreter" ? "both_directions" : "source_to_target",
            },
            { onConflict: "role_qualification_id,source_language_id,target_language_id" },
          );
      }

      // NDA — partial unique index on (vendor_id) where status='active' enforces one active.
      const { data: existingNda } = await qms
        .from("nda_agreements")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("status", "active")
        .maybeSingle();
      if (!existingNda && row.nda_signed_date) {
        await qms.from("nda_agreements").insert({
          vendor_id: vendorId,
          template_version: row.nda_template_version || "unknown",
          signed_date: row.nda_signed_date,
          effective_date: row.nda_signed_date,
          expiry_date: row.nda_expiry_date,
          status: "active",
        });
      }

      // Audit log — qualified action
      await qms.from("qualification_audit_log").insert({
        vendor_id: vendorId,
        role_qualification_id: roleQualId,
        action: "qualified",
        prior_status: priorStatus,
        new_status: "qualified",
        reason: `Seeded into qualified COA pool — basis ${row.competence_basis}.`,
        linked_evidence_ids: evidenceIds,
        performed_by: qualifiedBy,
      });

      console.log(`  seeded ${row.vendor_email} as ${row.role}`);
      seeded++;
    } catch (err) {
      console.error(`  ERROR on ${row.vendor_email}:`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  console.log(`\ndone — ${seeded} seeded, ${skipped} skipped/errored`);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
