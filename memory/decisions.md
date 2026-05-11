# Decisions

Architectural, product, and business decisions made in this project — with rationale, so future sessions don't relitigate settled questions.

## Format
Append new entries at the top (newest first). For each:

```
### YYYY-MM-DD — Short decision title
- **Decision:** what was chosen
- **Rationale:** why
- **Alternatives considered:** what was rejected and why
- **Status:** active | superseded by [date] | reverted
- **Affects:** which parts of the codebase or product this touches
```

If a decision is later reversed or refined, mark the old one **superseded** rather than deleting — the history matters.

## Decisions

### 2026-05-11 — QMS layer lives in a dedicated `qms` schema (not `cvp_`-prefixed)
- **Decision:** Phase 1 ISO 17100 / 18587 / 18841 / NSGCIS conformance tables live in a dedicated `qms` Postgres schema (`qms.role_qualifications`, `qms.competence_evidence`, etc.), not under the `cvp_` prefix in `public`.
- **Rationale:** Per the Phase 1 briefing at `D:\cethos-vendor\Documents\claude-code-prompt-cethos-qms-phase-1.md §7.2` — dedicated schema gives cleaner RLS isolation, supports issuing time-bounded read-only schema-scoped grants to an external auditor's JWT during the June 29-30, 2026 audit, and visually separates the conformance layer from the CVP pipeline. CLAUDE.md's "all new tables MUST use cvp_ prefix" rule scopes to CVP work; QMS is a distinct domain. CLAUDE.md may need an explicit carve-out at next edit.
- **Alternatives considered:** `iso_*` prefix in `public` matching `cvp_*` / `xtrf_*` style — rejected because RLS scoping is per-schema in Postgres and the auditor role needs to be tightly scoped without granting access to unrelated `public.*` tables.
- **Status:** active (migrations 20260511150000 / 20260511150100 / 20260511150200 written; pending `supabase db push` in Week 2 of audit sprint).
- **Affects:** `supabase/migrations/20260511150*`, `supabase/functions/qms-evidence-fetch`, `scripts/seed-coa-pool.ts`, all future QMS code paths.

### 2026-05-11 — Language code normalization deferred to Track B
- **Decision:** Do not migrate `public.vendor_language_pairs.source_language` / `target_language` (uppercase text codes) → FK to `public.languages(id)` as part of Phase 1.
- **Rationale:** Per Phase 1 briefing §8(2) and audit roadmap §3.4. The QMS layer's `language_pair_qualifications` FKs directly to `public.languages(id)`, so the impedance mismatch is contained — consuming CVP code that reads `vendor_language_pairs` is unaffected. Normalizing 5,188 rows + updating all consumers is a Track B (July-Sep 2026) task.
- **Status:** active.
- **Affects:** none in Phase 1; Track B QMS expansion will revisit.

### 2026-05-11 — Existing 1,468 vendors default to no `qms.role_qualifications` rows
- **Decision:** When the QMS migration goes live, none of the 1,468 vendors in `public.vendors` get retroactive `qms.role_qualifications` rows. Only the qualified COA pool (~20-50 names from Fayza's Week 1 deliverable) is seeded via `scripts/seed-coa-pool.ts`. Everyone else is, by absence, ineligible for ISO-scoped projects until documented.
- **Rationale:** Per Phase 1 briefing §8(3). Gives the auditor a deliberate, documented gating mechanism rather than a 1,468-row list of undocumented competence. Retroactive qualification of the broader vendor base is a Track B workflow.
- **Status:** active.
- **Affects:** project assignment logic for ISO-scoped work must check `qms.role_qualifications.status = 'qualified'` before assigning.

### 2026-05-11 — `cvp_translators` ↔ `public.vendors` bridge FK deferred to Track B
- **Decision:** Do not add a bridge FK in Phase 1. The QMS layer FKs directly to `public.vendors` (the canonical record); the CVP pipeline continues to operate on `cvp_translators`.
- **Rationale:** Migration `008_cvp_add_translator_fk.sql` only created `cvp_applications.translator_id → cvp_translators(id)` (internal to CVP). The cross-system bridge is a separate concern that doesn't block Phase 1 — QMS goes straight to vendors.
- **Status:** active.
- **Affects:** none in Phase 1; Track B will add the bridge as part of QMS expansion.

### 2026-05-05 — Project glossary + style guide labelled in Reference Materials
- **Decision:** When `vendor-get-job-detail` returns reference files tagged with `source: "project_glossary"` or `source: "project_style_guide"` (Phase 5 in the portal app), the vendor `JobDetailModal` shows a small green source badge ("Project glossary" / "Project style guide") above the file row so the vendor can spot project-level assets vs per-quote references at a glance.
- **Status:** active — wired alongside `vendor-get-job-detail` v30.
- **Affects:** `apps/vendor/src/components/jobs/JobDetailModal.tsx` reference files section.

### 2026-05-05 — Vendor job detail surfaces internal project number
- **Decision:** Vendors see `PRJ-YYYY-NNNNN`, prior task count for the same project, and project-level vendor notes on the job detail. The client-supplied `client_project_number` stays internal-only and never reaches vendor-facing surfaces.
- **Rationale:** Continuity context for recurring business work without exposing client-supplied identifiers.
- **Implementation:** `vendor-get-job-detail` edge function (v29) fetches `internal_projects.project_number` + `vendor_notes` and counts sibling orders when the underlying order has `internal_project_id`. Returned as a top-level `project` field on the response. JobDetailModal renders a teal banner section between Order Info and Language & Rate.
- **Status:** active — deployed to `lmzoyezvsjgsxveoakdr` 2026-05-05.
- **Pending:** glossary / style guide file surfacing once portal-side asset upload exists. (Customer-name anonymization is explicitly not pursued — confirmed 2026-05-05; see `cethos_app_figma_design_v1/memory/decisions.md`.)
- **Affects:** `vendor-get-job-detail` edge function, `apps/vendor/src/api/vendorJobs.ts`, `apps/vendor/src/components/jobs/JobDetailModal.tsx`.
