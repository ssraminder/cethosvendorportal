# QMS — Quality Management System (`qms` schema)

ISO 9001:2015 / 17100:2015 / 18587:2017 / 18841:2018 / NSGCIS conformance layer sitting on top of `public.vendors` as the canonical linguist record. Phase 1 is **vendor qualification**.

## Status

**Live in production.** Built April 28–30, 2026 over 10 migrations. The eligibility gate has been running in `warn` mode since April 30; as of 2026-05-11, 142 eligibility checks recorded in `qms.assignment_eligibility_events`, 0 block-mode rejections (block mode not yet engaged).

## Migration index

| File | Purpose |
|---|---|
| [20260428152239_qms_phase1_01_schema_enums_reference.sql](../../supabase/migrations/20260428152239_qms_phase1_01_schema_enums_reference.sql) | Schema, 8 enums, 5 reference tables (role_types, competence_bases, evidence_types, subject_matters, interpreter_modes) seeded, role_assignments, config, policy_versions, RLS helpers. |
| [20260428152332_qms_phase1_02_core_qualification_tables.sql](../../supabase/migrations/20260428152332_qms_phase1_02_core_qualification_tables.sql) | role_qualifications, competence_evidence, subject_matter_qualifications, interpreter_mode_qualifications, language_pair_qualifications, professional_experience, nda_agreements, `qms-evidence` storage bucket. |
| [20260428152447_qms_phase1_03_audit_log_and_performance.sql](../../supabase/migrations/20260428152447_qms_phase1_03_audit_log_and_performance.sql) | qualification_audit_log with **sha256 hash chain + BEFORE UPDATE/DELETE trigger + REVOKE** (three layers of tamper resistance), `verify_audit_log_integrity()`, qualification preconditions trigger, auto-logging triggers, performance_events, linguist_performance_snapshot materialised view. |
| [20260428152512_qms_phase1_04_language_aliases_and_cvp_bridge.sql](../../supabase/migrations/20260428152512_qms_phase1_04_language_aliases_and_cvp_bridge.sql) | `language_code_aliases` bridge (141 rows) from uppercase text codes in `vendor_language_pairs` to `public.languages(id)`; `resolve_language(text)` helper; `cvp_translators.vendor_id` FK to `public.vendors`. |
| [20260428152605_qms_phase1_05_auditor_views.sql](../../supabase/migrations/20260428152605_qms_phase1_05_auditor_views.sql) | The four decisive auditor views — `v_qualified_translators_by_pair_and_subject`, `v_qualified_revisers_*`, `v_qualified_post_editors_*`, `v_qualified_interpreters_by_mode_and_domain` — plus `v_evidence_expiring_soon`, `v_re_qualification_due`, `v_nda_expiring_soon`, `v_retroactive_qualification_candidates`, `v_qualification_summary`, `v_audit_log_recent`. |
| [20260428152704_qms_phase1_06_rls_and_grants.sql](../../supabase/migrations/20260428152704_qms_phase1_06_rls_and_grants.sql) | RLS policies for all five roles; storage policies for `qms-evidence`; grants. |
| [20260428152902_qms_phase1_07_fix_digest_search_path.sql](../../supabase/migrations/20260428152902_qms_phase1_07_fix_digest_search_path.sql) | Hotfix — qualify `extensions.digest()` and pin search_path on `audit_log_hash_chain()` + `verify_audit_log_integrity()`. |
| [20260428153839_qms_phase1_08_fix_function_search_paths.sql](../../supabase/migrations/20260428153839_qms_phase1_08_fix_function_search_paths.sql) | Hotfix — pin `search_path` on the remaining 7 qms.* functions to satisfy advisor `0011 function_search_path_mutable`. |
| [20260430183506_qms_phase1_09_assignment_gating_infrastructure.sql](../../supabase/migrations/20260430183506_qms_phase1_09_assignment_gating_infrastructure.sql) | `public.services.requires_iso_qualification` column; `qms.service_iso_requirements` (42 rows); `qms.assignment_eligibility_events`; `qms.is_vendor_eligible()`, `qms.log_eligibility_check()`, `qms.requires_iso_qualification()`; `v_iso_scoped_services`, `v_recent_ineligible_assignments`; gating-mode config keys. |
| [20260430183709_qms_phase1_10_public_rpc_wrapper.sql](../../supabase/migrations/20260430183709_qms_phase1_10_public_rpc_wrapper.sql) | `public.qms_check_assignment(...)` — single RPC the edge functions call. Resolves text language codes, checks eligibility, writes audit event, returns JSON verdict including `should_block` / `should_warn`. |

## How to use

**From an edge function** (the assignment hot path):

```ts
const { data } = await supabase.rpc("qms_check_assignment", {
  p_vendor_id: vendorId,
  p_service_id: serviceId,
  p_source_language_code: srcCode,    // text — alias-resolved
  p_target_language_code: tgtCode,
  p_call_site: "offer_vendor",         // one of: find_matching_vendors, direct_assign, offer_vendor, offer_multiple, counter_offer_accept, cvp_approve_application, manual_check
  p_order_id: orderId,
});
if (data.should_block) return { error: data.reason };
if (data.should_warn)  console.warn("[QMS]", data.reason); // notify warning recipient
```

Already wired into `find_matching_vendors`, `direct_assign`, `offer_vendor`, `offer_multiple`, `counter_offer_accept`, `cvp_approve_application`.

**From admin UI** — read views directly. The auditor query (briefing §7.9):

```sql
SELECT * FROM qms.v_qualified_translators_by_pair_and_subject
WHERE source_language_code IN ('es','es-ES','es-MX')
  AND target_language_code IN ('en','en-US','en-CA')
  AND (subject_matter_code = 'life_sciences' OR subject_matter_parent_code = 'life_sciences');
```

**Audit log integrity check:**

```sql
SELECT * FROM qms.verify_audit_log_integrity();
-- Expected: ok=true, message='OK N rows verified.'
```

## Roles + access

Five-tier role model (see `qms.role_assignments` mapping `auth.users.id` → `qms.qms_role` enum):

| Role | Read | Write | Notes |
|---|---|---|---|
| `qms_admin` | all qms.* | all qms.* | Only role that can assign other roles or mutate `qms.config` |
| `qms_vendor_manager` | all qms.* (qualification authority) | role_qualifications, evidence, NDAs, performance_events, sub-qualifications | Cannot UPDATE/DELETE audit log (REVOKE'd) |
| `qms_project_manager` | qualified vendors + their qualifications | none | No `internal_notes` access (use views) |
| `qms_auditor` | all qms.* including audit log | none | Time-bounded via `expires_at` |
| Linguist (vendor) | own row only | own evidence (unverified), own professional_experience (unverified), own evidence-bucket folder | Matched by `vendors.auth_user_id` |

Grant via:

```sql
insert into qms.role_assignments (auth_user_id, qms_role, expires_at, notes)
values ('<auth-user-uuid>','qms_auditor', now() + interval '14 days', 'June 29-30 audit');
```

## Gating modes

`qms.config.assignment_gating_mode` controls behavior on ineligible-vendor attempts:

- `"off"` — record nothing, allow everything
- `"warn"` — record event, email warning recipient, allow assignment (**current setting**)
- `"block"` — record event, return `should_block=true` to caller, assignment must reject

Current: `warn`. Recipient: `raminder@cethos.com`.

## Tamper resistance — the audit log

`qms.qualification_audit_log` carries three layers:

1. **REVOKE** `UPDATE, DELETE, TRUNCATE` from `PUBLIC, authenticated, anon, service_role`
2. **BEFORE UPDATE/DELETE trigger** `audit_log_no_mutate` that raises `insufficient_privilege`
3. **sha256 hash chain** — each row's `row_hash` = `sha256(prev_hash || canonical_payload)`. `qms.verify_audit_log_integrity()` walks the chain and confirms every row.

Verification queries an auditor will run:

```sql
SET ROLE service_role;
UPDATE qms.qualification_audit_log SET reason='x' WHERE id=1;
-- ERROR: qms.qualification_audit_log is append-only. UPDATE and DELETE are prohibited.

DELETE FROM qms.qualification_audit_log WHERE id=1;
-- ERROR: qms.qualification_audit_log is append-only.

SELECT * FROM qms.verify_audit_log_integrity();
-- ok | rows_checked | first_bad_id | message
-- t  | 2            | NULL         | OK 2 rows verified.
```

## Repo / prod alignment note

The 10 migration files above were originally applied **directly to the Supabase project via MCP `apply_migration`** during the April 28–30 build session and were not checked into this repo at the time. They were back-filled into `supabase/migrations/` on 2026-05-11 (commit history shows them at their original timestamps) to restore source-of-truth alignment. Anyone running `supabase db push` from a fresh checkout will see them as already-applied (matching version strings in `supabase_migrations.schema_migrations`).

## Audit-readiness Documents folder — stale

The audit-readiness documents in `D:\cethos-vendor\Documents\` (audit-readiness roadmap v0.2, 5-week sprint plan, Phase 1 Claude Code briefing, methodology pack, four role training plans) are dated 2026-05-11 and describe Phase 1 as work-to-be-built. They were written without awareness that Phase 1 had already shipped on April 28–30. The briefing's design is also a regression from what's deployed (no language aliases, no gating events, no hash chain, no config table, no service ISO requirements, different column names).

When working from those docs:
- **Phase 1 vendor qualification schema:** treat as done. Read this file and the migrations, not the briefing's §7 design.
- **Track A non-software items** (consultant SOW, 15 SOPs, ISMS-lite, mock audit, marketing scrub, NAP cleanup): still real, still scheduled for the May 12 → June 30 window.
- **Track B items** (full vendor-base qualification, CAPA register, complaint register, internal audit findings, management review records, document register, staff training records): still real, still post-June.
- **The qualified COA pool seeding step** is still needed — Fayza identifies the 20–50 names in Week 1, Amrita collects evidence into the `qms-evidence` bucket and inserts via Supabase admin client or a new seeder script (the prior `scripts/seed-coa-pool.ts` was reverted as it referenced wrong column names — `proficiency_level` vs `proficiency`, `withdrawal_reason` vs `withdrawn_reason`, etc.).

## Known gaps deferred to Phase 2+

- Materialized view refresh schedule for `linguist_performance_snapshot` — Phase 2.
- Internal-notes column hiding for non-admin via column-level grants — currently done by directing project-manager UI to use `v_*` views that exclude internal_notes.
- Document register, CAPA register, complaint register, management review records, internal audit findings as DB tables — Track B / Phase 4.
- `vendor_language_pairs` text → FK normalization — Phase 2 once `v_unresolved_language_codes` is empty.
- Auditor JWT provisioning workflow (auth account + `qms.role_assignments` row with `expires_at = audit_end + 7 days`) — pre-audit task before June 29.
