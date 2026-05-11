# QMS Phase 1 — Vendor Qualification Schema

**Status:** Implemented 2026-05-11. Pending apply via `supabase db push` in Week 2 of the audit-readiness sprint (May 18-22).
**Audit context:** Pharma sponsor vendor QA audit, June 29-30, 2026. Orion ISO 17100/9001/18587/18841/NSGCIS Stage 2 audit, December 2026 (February 2027 fallback).
**Source spec:** [`D:\cethos-vendor\Documents\claude-code-prompt-cethos-qms-phase-1.md`](../../Documents/claude-code-prompt-cethos-qms-phase-1.md) (the briefing this implements verbatim).

This document describes what is in the database after the three Phase 1 migrations run. It is the developer-facing reference; the auditor-facing artefact is the live database itself plus the dossier index Amrita maintains.

## Architectural pivot

`public.vendors` is the canonical linguist record. CVP (`cvp_*` tables) is the qualification *pipeline* that feeds it. The new `qms` schema is the *conformance layer* — it carries the ISO-clause-tagged evidence and decisions that an audit examines. **The QMS layer does not duplicate anything in `public.vendors` or `cvp_*`. It adds FKs back to them.**

Every record in `qms.*` is the evidence for a specific ISO clause-level conformance claim.

## Migrations applied

| File | Purpose |
|---|---|
| [20260511150000_qms_schema_foundation.sql](../../supabase/migrations/20260511150000_qms_schema_foundation.sql) | Schema, enums, lookup tables + seeds, record tables, audit log (with REVOKE), indexes, updated_at triggers. |
| [20260511150100_qms_rls_and_views.sql](../../supabase/migrations/20260511150100_qms_rls_and_views.sql) | Postgres roles, staff role assignments, RLS policies, internal_notes-hiding views, auditor-facing decisive views, performance snapshot materialised view. |
| [20260511150200_qms_evidence_storage.sql](../../supabase/migrations/20260511150200_qms_evidence_storage.sql) | Private `qms-evidence` storage bucket. |

## Enums

`qms.qualification_status` · `qms.pair_direction` · `qms.proficiency_level` · `qms.nda_status` · `qms.audit_action` · `qms.performance_event_type` · `qms.severity`

## Lookup tables (seeded inline)

| Table | Rows | Purpose |
|---|---|---|
| `qms.role_types` | 4 | translator, reviser, post_editor, interpreter |
| `qms.competence_bases` | 7 | ISO 17100 §3.1.4 paths (a)/(b)/(c), §3.1.5, ISO 18587 §3.1, ISO 18841 §6 + alt |
| `qms.subject_matters` | 6 parents + 24 subdomains | Hierarchical taxonomy (Legal, Life Sciences, Business, Technical, Government, Interpretation Domains) |
| `qms.interpreter_modes` | 6 | consecutive, simultaneous, sight_translation, whispered, opi, vri |
| `qms.evidence_types` | 18 | Tagged to issuing ISO clause where applicable |

The `competence_bases` lookup is the spine. Every qualified role qualification carries a `competence_basis_id` and rationale text plus linked evidence — this is what the auditor keys on for ISO 17100 §3.1.4 / §3.1.5 / ISO 18587 §3.1 / ISO 18841 §6 conformance.

## Record tables

- `qms.role_qualifications` — one row per (vendor × role). Status: `under_review`, `qualified`, `suspended`, `expired`, `withdrawn`. UNIQUE on (vendor_id, role_type_id). **This is the table that gates assignment to ISO-scoped projects.**
- `qms.competence_evidence` — verified credentials per vendor. Includes optional FKs back to `cvp_applications` and `cvp_test_submissions` for "this evidence came from CVP" linkage.
- `qms.subject_matter_qualifications` — per role qualification × subject matter, with proficiency level (familiar / experienced / specialist).
- `qms.interpreter_mode_qualifications` — only used when role_type is interpreter.
- `qms.language_pair_qualifications` — keyed to `public.languages(id)` (the uuid-keyed canonical reference).
- `qms.nda_agreements` — NDA lifecycle. Partial unique index enforces one active NDA per vendor.
- `qms.professional_experience` — for ISO 17100 §3.1.4(b)/(c) — the documented-experience paths.
- `qms.performance_events` — granular events feeding re-qualification decisions.
- `qms.qualification_audit_log` — append-only, tamper-evident.

## Tamper-evident audit log

`qms.qualification_audit_log` is the single non-negotiable element of this design.

- INSERT is allowed for admin and vendor_manager via RLS.
- SELECT is allowed for all four internal staff roles plus the auditor.
- **UPDATE and DELETE are blocked at the database privilege level via `REVOKE`** — not by convention, not by RLS alone. Every PUBLIC / authenticated / anon / service_role grant for UPDATE and DELETE has been revoked.

This is the demonstration the auditor will ask for. Verification:

```sql
SET ROLE service_role;
UPDATE qms.qualification_audit_log SET reason = 'tampered' WHERE id = '...';
-- ERROR: permission denied for table qualification_audit_log
DELETE FROM qms.qualification_audit_log WHERE id = '...';
-- ERROR: permission denied for table qualification_audit_log
```

## Indexes

Beyond auto-created PK/FK indexes:

- `idx_qms_role_qualifications_qualified` — partial, `WHERE status = 'qualified'`
- `idx_qms_role_qualifications_re_qual_due` — partial, drives re-qualification reminder workflow
- `idx_qms_lpq_pair` — drives "find linguists for this pair"
- `idx_qms_smq_subject`, `idx_qms_evidence_vendor_type`, `idx_qms_evidence_expiry` (partial), `idx_qms_audit_log_role_qual` (DESC), `idx_qms_audit_log_vendor` (DESC), `idx_qms_perf_events_role_qual_time` (DESC), `idx_qms_nda_one_active_per_vendor` (partial unique), `idx_qms_nda_expiry` (partial)

## RLS model

Five logical roles (briefing §7.7), implemented through `qms.staff_role_assignments` (mapping `public.staff_users.id` to one of `qms_admin / qms_vendor_manager / qms_project_manager / qms_auditor`) plus a self-vendor match by `vendors.auth_user_id`.

Helper functions: `qms.is_qms_admin()`, `qms.is_vendor_manager()`, `qms.is_project_manager()`, `qms.is_auditor()`, `qms.is_self_vendor(uuid)`.

`internal_notes` columns are hidden from non-admin roles via `qms.v_*_public` views (briefing §7.7 column-level grants pattern — implemented as view projection rather than column GRANT since RLS in Supabase is row-level only).

## Auditor-facing views

The decisive demonstration is `qms.v_qualified_translators_by_pair_and_subject`. Auditor asks *"show me all translators currently qualified for Spanish→English in life sciences with active NDAs"*:

```sql
SELECT *
FROM qms.v_qualified_translators_by_pair_and_subject
WHERE source_language_code IN ('es', 'es-ES', 'es-MX', 'es-LA')
  AND target_language_code IN ('en', 'en-US', 'en-CA', 'en-GB')
  AND (subject_matter_code = 'life_sciences' OR subject_matter_parent_code = 'life_sciences')
ORDER BY full_name;
```

Analogues exist for each role:
- `qms.v_qualified_revisers_by_pair_and_subject`
- `qms.v_qualified_post_editors_by_pair_and_subject`
- `qms.v_qualified_interpreters_by_mode_and_domain`

All four views are granted SELECT to `authenticated`; their underlying RLS policies still gate row-level access by role.

## Performance snapshot

`qms.linguist_performance_snapshot` (materialised view) rolls `qms.performance_events` up per role qualification: project completions, revision findings, complaints, compliments, late deliveries, quality issues, CAPA opens/closes, high-severity event count, last event timestamp.

Refresh helper: `SELECT qms.refresh_linguist_performance_snapshot();` — schedule via pg_cron nightly when Phase 2 ships. Fayza's weekly performance review (per [training-fayza-prerequisite-vendor-management-v0.1.md §7.6](../../Documents/training-fayza-prerequisite-vendor-management-v0.1.md)) reads from this snapshot.

## Storage

Single private bucket `qms-evidence`. Path convention:

```
qms-evidence/{vendor_id}/evidence/{evidence_id}-{slug}.{ext}
qms-evidence/{vendor_id}/nda/{nda_id}-{slug}.pdf
```

Signed URLs are issued only by the [`qms-evidence-fetch`](../../supabase/functions/qms-evidence-fetch/index.ts) edge function after the caller's `qms_role` is verified through `qms.staff_role_assignments` (admin / vendor_manager / auditor) or the caller is the vendor themselves (`vendors.auth_user_id` match). The function mirrors the existing `cvp-get-cv-url` pattern but adds the role-assignment check.

## Seeding the qualified COA pool

[`scripts/seed-coa-pool.ts`](../../scripts/seed-coa-pool.ts) reads a CSV that Fayza and Amrita maintain ([template](../../scripts/coa-pool.template.csv)) and creates the role qualification, competence evidence stubs, subject matter qualifications, language pair qualifications, NDA, and audit-log entries for each linguist in the qualified COA pool.

Each insert is mirrored to `qms.qualification_audit_log` so the audit trail begins at seed time. Re-qualification due date is set to qualified_at + 365 days.

The 1,468 existing vendors in `public.vendors` get **no** `qms.role_qualifications` rows until they're documented — meaning none of them are eligible for ISO-scoped projects until they're qualified through this layer. This is the deliberate gating mechanism the audit roadmap requires.

## Known gaps deferred to Track B (post-June audit)

These are explicitly out of scope for Phase 1:

- **Full vendor-base migration** — qualifying all 1,468 vendors. Track B (Jul-Sep 2026) per roadmap §4.2.
- **Language code normalization** — `public.vendor_language_pairs.source_language` and `target_language` are uppercase text (`'EN'`, `'FR-CA'`) not FKs to `public.languages(id)`. Deferred to Track B.
- **`cvp_translators` ↔ `public.vendors` bridge FK** — migration 008 added the cvp internal FK only. The cross-bridge stays open as a Track B item.
- **CAPA register table** — methodology pack §III calls for a CAPA register. For June audit it lives in Google Sheets per Amrita's training plan. DB-backed version is Track B.
- **Customer complaint register** — same; Track B.
- **Internal audit findings register** — same; Track B.
- **Management review records** — same; Track B.
- **Document register + 3-signature workflow** — Amrita maintains in Google Sheets (per `training-amrita-qms-coordinator-v0.1.md §4.3`). DB-backed Track B.
- **Staff training records** — `cvp_trainings` covers vendor training only. Internal staff training records (NSGCIS, COA methodology, infosec) deferred.
- **Auditor JWT provisioning** — separate task; auditor account created in Supabase auth + `qms.staff_role_assignments` row with `qms_role='qms_auditor'` + `expires_at = audit_end + 7 days`.

## Open decisions resolved

| # | Decision | Resolution |
|---|---|---|
| 1 | Schema location: `qms` vs `iso_*` prefix in public | **`qms` dedicated schema.** Cleaner RLS isolation for the auditor's time-bounded read role; visual separation from CVP. The CLAUDE.md "all new tables MUST use cvp_ prefix" rule is scoped to CVP tables; QMS is a distinct conformance domain. Logged in [memory/decisions.md](../../memory/decisions.md). |
| 2 | Language code normalization timing | **Deferred to Track B.** Per roadmap §3.4 and Phase 1 prompt §8(2). `language_pair_qualifications` FKs to `public.languages(id)` cleanly; consuming code that joins via `vendor_language_pairs` is unaffected. |
| 3 | Default eligibility state for existing 1,468 vendors | **No `qms.role_qualifications` rows until documented.** The qualified COA pool (Fayza's Week 1 deliverable, 20-50 names) is the only seeded subset. |
| 4 | Bridge FK `cvp_translators` ↔ `public.vendors` | **Deferred to Track B.** Migration 008 created the cvp-internal FK only; the QMS layer FKs straight to `public.vendors`, so this doesn't block Phase 1. |

## Verification checklist

Run after `supabase db push`:

1. `SELECT COUNT(*) FROM qms.role_types;` → 4.
2. `SELECT COUNT(*) FROM qms.competence_bases;` → 7.
3. `SELECT COUNT(*) FROM qms.subject_matters WHERE parent_id IS NULL;` → 6.
4. `SELECT COUNT(*) FROM qms.subject_matters WHERE parent_id IS NOT NULL;` → 24.
5. `SELECT COUNT(*) FROM qms.interpreter_modes;` → 6.
6. `SELECT COUNT(*) FROM qms.evidence_types;` → 18.
7. After running `scripts/seed-coa-pool.ts`: `SELECT * FROM qms.v_qualified_translators_by_pair_and_subject LIMIT 5;` → seeded COA pool members visible with non-null competence_basis_code, ISO clause, and active NDA.
8. As `service_role`: `UPDATE qms.qualification_audit_log SET reason='x' WHERE id=...` → **permission denied**.
9. As `service_role`: `DELETE FROM qms.qualification_audit_log WHERE id=...` → **permission denied**.
10. `qms-evidence-fetch` POST with a vendor_manager JWT → signed URL.
11. `qms-evidence-fetch` POST with a JWT lacking any qms role and not matching `vendors.auth_user_id` → 403.

## Sequenced apply order

```
supabase migration up 20260511150000_qms_schema_foundation
supabase migration up 20260511150100_qms_rls_and_views
supabase migration up 20260511150200_qms_evidence_storage
supabase functions deploy qms-evidence-fetch
# then, when Fayza's CSV is ready:
COA_POOL_CSV=./scripts/coa-pool.csv \
QUALIFIED_BY_STAFF_ID=<fayza-staff-uuid> \
npx tsx scripts/seed-coa-pool.ts
```
