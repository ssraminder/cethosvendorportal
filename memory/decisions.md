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

### 2026-05-11 — QMS lives in `qms` schema; Documents-folder briefing is superseded by prod
- **Decision:** The ISO 9001/17100/18587/18841/NSGCIS conformance layer lives in the `qms` Postgres schema (already built April 28-30, 2026 over 10 migrations). The Phase 1 design in `D:\cethos-vendor\Documents\claude-code-prompt-cethos-qms-phase-1.md` (dated 2026-05-11) describes Phase 1 as work-to-be-built — but that's stale: Phase 1 shipped two weeks earlier and the prod schema is more sophisticated than the briefing describes. Treat the Documents-folder briefing as historical context; use `docs/qms/README.md` and the `20260428*_qms_phase1_*.sql` migration files as the source of truth.
- **Rationale:** Discovered during attempted PR #65 apply on 2026-05-11. The qms schema already existed in prod with 142 active assignment_eligibility_events, hash-chained audit log, language code aliases (141 rows), and service-ISO mapping (42 rows). PR #65 was reverted as a regression.
- **What's actually in prod:** `qms.role_types` (4), `qms.competence_bases` (7), `qms.evidence_types` (16), `qms.subject_matters` (32), `qms.interpreter_modes` (6), `qms.role_assignments`, `qms.config`, `qms.policy_versions`, `qms.role_qualifications`, `qms.competence_evidence`, `qms.subject_matter_qualifications`, `qms.interpreter_mode_qualifications`, `qms.language_pair_qualifications`, `qms.professional_experience`, `qms.nda_agreements`, `qms.qualification_audit_log`, `qms.performance_events`, `qms.language_code_aliases`, `qms.service_iso_requirements`, `qms.assignment_eligibility_events`. Plus 11 views, 1 materialized view, 16 functions, `qms-evidence` storage bucket. The `public.qms_check_assignment(...)` RPC is the entry point for assignment-flow edge functions.
- **Column-name traps for future work:** `withdrawn_reason` (not withdrawal_reason), `proficiency` (not proficiency_level), `revoked_reason` (not revoke_reason), `employer_or_client` (not employer_client), `re_qualification_due timestamptz` (not date), audit log `id bigint` (not uuid), role assignments keyed to `auth.users.id` (not staff_users.id).
- **Status:** active — repo aligned with prod on 2026-05-11.
- **Affects:** all QMS work, supabase/migrations/20260428*_qms_phase1_*.sql, supabase/migrations/20260430183*_qms_phase1_*.sql, docs/qms/README.md, the QMS-touching call sites in `find_matching_vendors`, `direct_assign`, `offer_vendor`, `offer_multiple`, `counter_offer_accept`, `cvp_approve_application` edge functions.

### 2026-05-11 — Apply migrations via supabase MCP, not just `supabase db push`
- **Decision:** When a session applies DDL directly to the Supabase project via the MCP `apply_migration` tool, the resulting migration **must also be checked into `supabase/migrations/` with the exact same version timestamp**. The migration history in `supabase_migrations.schema_migrations` and the repo's migration files are dual sources that must agree.
- **Rationale:** The April 28-30 QMS Phase 1 work applied 10 migrations via MCP but did not back-fill them into the repo. This caused a silent schema/repo divergence that was only caught two weeks later when a new session designed a regressed Phase 1 from scratch.
- **How to apply:** After every `apply_migration` MCP call, immediately write the same SQL body to `supabase/migrations/<version>_<name>.sql` and commit it as part of the same PR.
- **Status:** active.
- **Affects:** any session that uses Supabase MCP DDL tools (`apply_migration`, `deploy_edge_function`, etc.).

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
