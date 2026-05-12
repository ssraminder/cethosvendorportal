# Claude Code Briefing — Cethos QMS / ISO Certification, Phase 1

You are picking up an ISO management system implementation for Cethos Solutions Inc., a Calgary-based language services company. This document gives you everything that's been decided, everything that's been discovered about the existing system, and what you're being asked to build. Read it end-to-end before doing anything.

---

## 1. Mission

Build an integrated Quality Management System (QMS) covering ISO 9001:2015 (without Design), ISO 17100:2015, ISO 18587:2017, ISO 18841:2018, and NSGCIS — all in a single integrated audit conducted by Orion Assessment Services of Canada Inc. The Stage 2 certification audit is targeted for **December 2026** (February 2027 fallback acceptable). The Orion application has already been submitted.

Phase 1 — what this session is about — is the **vendor qualification system**. This is the most-scrutinized area in any ISO 17100 audit and the single biggest differentiator between a defensible Stage 2 outcome and a long Stage 1 nonconformity list. It's also a real operational tool, not audit theater.

## 2. Company and certificate scope

- Cethos Solutions Inc. — Canadian language services company. Owner: Raminder Shah.
- Incorporated 2019-07-12, business commenced 2015-09-11.
- Calgary, Alberta HQ (canonical address still being decided across BBB / LinkedIn / GBP listings — not your problem this phase).
- Website: cethos.com (Next.js + Builder.io on Netlify).
- BBB Accredited Business, A+ rating since September 2020.

**Certificate scope statement (canonical, from Orion application):**

"Provision of translation, post-editing of machine translation, and interpretation services for clients in Canada and globally, including certified translation, life sciences translation, business translation, and community interpretation, supported by project management, vendor qualification, and quality assurance processes."

ISO 9001 exclusion: Clause 8.3 (Design and Development). Cethos delivers services based on client-provided source materials and client-defined specifications.

In scope: certified translation, life sciences translation, business translation, post-editing of MT, community interpretation in 95+ languages.

Out of scope: Commissioner of Oaths services (separate business — calgaryoaths.com), apostille / document legalization.

## 3. Operational scale

- ~12 in-house FTE (project managers, coordinators, vendor management, customer service, finance, admin)
- Was previously ~2,500 external linguists in XTRF (a commercial TMS) — **XTRF is being retired**, do not build anything that depends on it
- Current state: 1,468 linguists imported into Supabase `public.vendors` (749 active), of which 593 came from the XTRF migration
- 200+ languages translation, 95+ languages interpretation
- CAT tools: SDL Trados, MemoQ, Wordfast
- Multi-step QA: translation → revision → proofreading

## 4. Infrastructure

### Supabase projects under the org

- **`Cethos_Translation_App`** (`lmzoyezvsjgsxveoakdr`, us-east-1) — **the project you'll be working in**. Contains vendors, CVP application pipeline, orders, quotes, customer system, the website backend, all production data.
- `cethos-tms` (`idzwtssftpxrsprzjael`, ca-central-1) — newer empty project, may become a future migration target; ignore for now
- `Cethos_Automation` (`vobyyunysesidrpakezw`, us-east-2) — Google APIs / crons / agents, not your concern this phase
- `TimeClock_Cethos` (`eqoauoavoxhkbnqddoas`) — staff timeclock, may matter later for in-house staff training records
- `Financial Dashboard`, `transalation-order`, `SwornNow`, `Giftscart India` — out of scope

### Connected MCP servers you should have

- Supabase (with admin access to `lmzoyezvsjgsxveoakdr` — list_tables, execute_sql, apply_migration, create_branch, list_edge_functions, list_migrations)
- Likely also Netlify, Google Drive, Gmail, Calendar — only relevant to QMS later

### Codebases

If they're checked out locally, you should have access to:
- The Next.js website + admin panel (consumes `Cethos_Translation_App` Supabase)
- Edge functions for the same project (deno-style functions invoked from the admin panel and webhooks)

You will need to read the code that consumes `vendors`, `vendor_language_pairs`, `cvp_applications`, `cvp_translators`, and related tables. **Schema changes that break consuming code are not acceptable.** Find the call sites before changing anything.

## 5. Standards quick reference

You will encounter these clause references throughout. Internalize them — every QMS table you create should map to specific clauses, and the auditor will key on these.

- **ISO 9001:2015** — General QMS, leadership, risk-based thinking, customer focus, continual improvement. §8.4 covers control of externally provided processes, products, and services (i.e., your vendor controls).
- **ISO 17100:2015** — Translation Service Provider requirements. The critical clauses for vendor qualification:
  - §3.1.4 — translator competence (must meet at least one of three paths: (a) recognized degree in translation; (b) recognized degree in any other field plus 2 years documented professional translation experience; (c) 5 years documented professional translation experience)
  - §3.1.5 — reviser competence (translator competence plus revision experience plus relevant subject expertise)
  - §6.1 — Human resources, professional competences and qualifications
- **ISO 18587:2017** — Post-editing of MT output. §3.1 — post-editor competence requires translator competence plus MT post-editing training/experience.
- **ISO 18841:2018** — Interpreting services general requirements. §6 — interpreter competence: recognized interpreter training plus verified language proficiency (or 5 years documented experience as alternative).
- **NSGCIS** — Canadian National Standard Guide for Community Interpreting Services. Adds community-interpreting-specific competence: cultural competence training, ethics training, mode-specific qualification (consecutive / simultaneous / sight / OPI / VRI), domain-specific qualification (healthcare / legal / social services / education).

## 6. What's been verified in the database (do not rediscover)

This is what the prior planning session established by introspecting the live `lmzoyezvsjgsxveoakdr` schema. Verify if you doubt any of it, but don't redo the full investigation.

### 6.1 Vendor data state

`public.vendors` is the canonical linguist record. Counts as of the introspection:

| Metric | Value |
|---|---|
| Total vendor rows | 1,468 |
| Active | 749 |
| From XTRF migration (`xtrf_vendor_id` set) | 593 |
| With `auth_user_id` | 0 |
| Invitation sent | 1 |
| With email | 1,468 |
| With country | 1,432 |
| With `years_experience` | 724 |
| With `total_projects > 0` | 260 |
| With `notes` | 471 |
| With `certifications` (jsonb populated) | **0** |
| With `native_languages` (jsonb populated) | **0** |
| With `specializations` populated | 7 |
| With `vendor_type` set (mostly NULL) | 12 |

**The interpretation that matters:** all 1,468 vendors have basic identity, most have language pair records, but **none have ISO-grade documented competence on file**. From an ISO 17100 §3.1.4 perspective, every one of them is currently unqualified. This is the single most important fact about the system you're building.

### 6.2 The CVP pipeline (the new vetting program)

The Cethos Vetting Program is already a partial ISO 17100 vendor qualification system in everything but explicit ISO clause naming. It includes:

- `cvp_applications` (107 rows) — full applicant intake with role_type, education_level, certifications (jsonb), services_offered, work_samples, AI prescreening score and result, plus specialty branches for clinicians, COG (cognitive debriefing), interpreters, transcribers
- `cvp_test_library` (63 rows) — test bank by source/target language × domain × service type, with AI assessment rubrics and MQM dimensions
- `cvp_test_combinations` (730 rows) — per-application test assignments
- `cvp_test_submissions` — actual submissions with AI assessment scores
- `cvp_translators` (1 row currently) — graduates from CVP with `approved_combinations`, `tier`, `default_rate`
- `cvp_translator_domains` — relational per (translator × language pair × domain) approval state
- `cvp_application_decisions` — decision history with AI-processed staff notes and outbound message
- `cvp_application_reference_requests` and `cvp_application_references` — formal reference checks with AI analysis
- `cvp_inbound_emails` and `cvp_outbound_messages` — full conversation threading
- `cvp_prescreen_flag_feedback` — staff verdicts on AI flags, learning loop
- `cvp_trainings`, `cvp_training_lessons`, `cvp_training_assignments`, `cvp_training_lesson_progress` — training infrastructure

CVP currently has **only 1 graduate from 107 applications**. Throughput is low. This is a real timeline risk for Stage 2 vendor capacity but it's not the schema's problem.

### 6.3 What's missing relative to ISO/NSGCIS conformance

CVP captures qualification activity but doesn't tag it to ISO clauses or carry the conformance metadata an audit needs. Specifically missing:

- Explicit ISO 17100 §3.1.4 competence basis tagging (which path — degree-translation, degree-other-plus-2y, 5y-experience — was met, with rationale)
- Evidence verification status (CVP captures certifications as jsonb but doesn't track who verified them, how, or when)
- NDA / confidentiality agreement lifecycle tracking
- Re-qualification cadence (annual review trigger)
- Role-type taxonomy as reference data (currently free-text strings)
- NSGCIS interpreter mode and community domain taxonomies as reference data (currently free-text)
- Tamper-evident audit log of qualification decisions (CVP has decision history but it's not append-only enforced at the database level)
- Auditor-facing views that join the data into the queries Orion will run
- A clear gating mechanism: which vendors are eligible for ISO-scoped projects vs not

### 6.4 Architectural pivot decided

**Going forward, `public.vendors` is the canonical linguist record. CVP is the qualification pipeline that feeds it.** The QMS layer extends `vendors` with ISO conformance metadata; it does not duplicate it.

There is currently **no foreign key between `cvp_translators` and `vendors`** — both have `auth_user_id` but neither has FKs to the other. This is a known gap. Long-term these two systems are intended to work together as a single pipeline. Decide whether to add a bridge FK as part of this work or treat it as a separate task.

### 6.5 Language identity is fragmented

Three coding schemes for the same concept across the same database:

- `public.languages` (141 rows) uses lowercase ISO 639-1 codes with locale variants (`en`, `fr-CA`, `ar-EG`, `pt-BR`)
- `public.cethosweb_languages` (75 rows) — separate list, customer-facing on the marketing site
- `public.vendor_language_pairs` (5,188 rows) uses uppercase text codes (`EN`, `FR-CA`, `PT-BR`) — **not foreign-keyed to `languages`**
- CVP tables FK to `public.languages.id` (uuid)

This needs resolving before clean joins are possible across the QMS, CVP, and vendor systems.

## 7. Architectural design for the QMS layer

This is the design that came out of the planning session. Treat it as the working blueprint, not gospel — you may refine specifics, but don't deviate from the core principle without flagging it to Raminder first.

### 7.1 Core principle

The QMS does not duplicate `vendors` or `cvp_*`. It adds a thin conformance layer on top, with FKs back to the canonical records. Every QMS table maps to specific ISO clauses. Every record in the QMS is the evidence for a specific clause-level conformance claim.

### 7.2 Schema location decision (open — confirm with Raminder)

Two options:

- **(A)** Dedicated `qms` schema — cleaner for RLS, easier to grant scoped read-only access to an external auditor, visual separation. **Recommended.**
- **(B)** `iso_*` table prefix in `public` — more consistent with how `cvp_*`, `xtrf_*`, `vendor_*` are already organized.

If Raminder hasn't already answered, ask once and proceed.

### 7.3 Tables to create

Naming below assumes option (A) — `qms` schema. Adjust if option (B) is chosen.

**`qms.role_qualifications`** — the heart of the system. One row per (vendor_id, role_type). Carries `competence_basis_id`, `status`, `qualified_at`, `qualified_by`, `last_re_qualified_at`, `re_qualification_due`, `competence_basis_notes`, `suspended_at`, `suspension_reason`, `withdrawn_at`, `internal_notes`. Unique on (vendor_id, role_type_id). FK to `public.vendors(id)`. **This is the table that gates assignment to certified projects.**

**`qms.competence_evidence`** — verified credentials per vendor. Columns: `vendor_id` (FK), optional `role_qualification_id` (FK — set when role-specific), `evidence_type_id`, `title`, `issuing_organization`, `issuing_country_code`, `issued_date`, `expiry_date`, `storage_path`, `file_name`, `file_mime`, `file_size_bytes`, `sha256`, `verified` boolean, `verified_by`, `verified_at`, `verification_method`, `verification_notes`, `superseded_by` (self-FK), audit columns. Optional FK `source_cvp_application_id` to capture "this evidence came from CVP application X." Optional FK `source_cvp_test_submission_id` for tested competence.

**`qms.subject_matter_qualifications`** — per role qualification × subject matter, with proficiency level (familiar / experienced / specialist) and optional evidence link. Unique on (role_qualification_id, subject_matter_id).

**`qms.interpreter_mode_qualifications`** — per role qualification × interpreter mode. Only relevant when role_type is interpreter. Unique on (role_qualification_id, mode_id).

**`qms.language_pair_qualifications`** — per role qualification × source/target language. FK to `public.languages(id)` (the uuid-keyed canonical reference). For interpreter qualifications, direction is typically `both_directions`. Optional evidence link.

**`qms.nda_agreements`** — vendor NDA lifecycle. `template_version`, `signed_date`, `effective_date`, `expiry_date`, `status` (active / expired / superseded / revoked), `signed_method`, `signed_via`, `storage_path`, `countersigned`, `countersigned_by`, `countersigned_date`, `superseded_by`, `internal_notes`. Partial unique index on `(vendor_id) where status = 'active'`.

**`qms.qualification_audit_log`** — append-only, tamper-evident. Every status change, decision, evidence verification, NDA event, performance flag. Columns: `vendor_id`, optional `role_qualification_id`, `action` (enum: applied, submitted_for_review, qualified, re_qualified, suspended, reinstated, withdrawn, offboarded, archived, evidence_added, evidence_verified, nda_signed, nda_renewed, performance_flag), `prior_status`, `new_status`, `reason`, `linked_evidence_ids` (uuid array), `performed_by`, `performed_at`, `ip_address`, `user_agent`. **Enforce no UPDATE or DELETE at the database level** — `REVOKE UPDATE, DELETE ON qms.qualification_audit_log FROM PUBLIC, authenticated, service_role`. This is non-negotiable for audit grade.

**`qms.performance_events`** — granular events feeding re-qualification. Per (role_qualification_id × event_type), with severity and optional project reference. Materialized view `qms.linguist_performance_snapshot` rolls these up daily.

**`qms.professional_experience`** — for competence path (b) "degree + 2 years documented experience" and (c) "5 years documented experience." Per (vendor_id × role_type), with employer/client, description, start_date, end_date, volume_indicator, is_documented, evidence link, verification status.

### 7.4 Reference / lookup tables

**`qms.role_types`** — seed: translator, reviser, post_editor, interpreter.

**`qms.competence_bases`** — the §3.1.4 path enumeration plus analogues. Initial seed:

| code | role | description |
|---|---|---|
| t_a_degree_translation | translator | ISO 17100 §3.1.4(a) — recognized degree in translation |
| t_b_degree_other_plus_2y | translator | ISO 17100 §3.1.4(b) — degree in other field + 2 years documented experience |
| t_c_5y_experience | translator | ISO 17100 §3.1.4(c) — 5 years documented experience |
| r_translator_plus_revision | reviser | ISO 17100 §3.1.5 — translator competence + revision experience + relevant subject expertise |
| pe_translator_plus_pemt | post_editor | ISO 18587 §3.1 — translator competence + PEMT training/experience |
| i_training_plus_proficiency | interpreter | ISO 18841 §6 — recognized interpreter training + verified language proficiency |
| i_5y_experience | interpreter | ISO 18841 §6 alternative — 5 years documented experience |

This is the field the auditor will key on. Every qualified role qualification needs a competence_basis_id plus rationale plus linked evidence.

**`qms.subject_matters`** — hierarchical taxonomy, two levels. Top-level: Legal, Life Sciences / Medical, Business / Financial, Technical, Government / Public Sector, Interpretation Domains (NSGCIS). Subdomains beneath each. Use code (text unique), parent_id self-FK, level, sort_order.

**`qms.interpreter_modes`** — seed: consecutive, simultaneous, sight_translation, whispered, opi, vri.

**`qms.evidence_types`** — seed includes degree_translation, degree_other, documented_translation_experience, documented_interpretation_experience, mt_post_editing_training, interpreter_training_certificate, mode_specific_certification, domain_specific_certification, language_proficiency_test, professional_membership, continuing_professional_development, background_check, references_verified, internal_test_passed, cultural_competence_training (NSGCIS), ethics_training (NSGCIS).

### 7.5 Enums (Postgres enum types in `qms` schema)

`qms.qualification_status` (under_review, qualified, suspended, expired, withdrawn), `qms.pair_direction` (source_to_target, both_directions), `qms.proficiency_level` (familiar, experienced, specialist), `qms.nda_status` (active, expired, superseded, revoked), `qms.audit_action` (full enum above), `qms.performance_event_type` (project_completed, revision_finding, client_complaint, client_compliment, late_delivery, quality_issue, capa_action_opened, capa_action_closed), `qms.severity` (low, medium, high, critical).

### 7.6 Indexes

Beyond auto-created PK and FK indexes:

- `role_qualifications (status) where status = 'qualified'` — partial, drives the most common auditor query
- `role_qualifications (re_qualification_due) where status in ('qualified')` — drives reminder workflow
- `language_pair_qualifications (source_language_id, target_language_id)` — drives "find me all linguists for this pair"
- `subject_matter_qualifications (subject_matter_id)`
- `competence_evidence (vendor_id, evidence_type_id)`
- `competence_evidence (expiry_date) where expiry_date is not null` — drives expiry alerts
- `qualification_audit_log (role_qualification_id, performed_at desc)`
- `qualification_audit_log (vendor_id, performed_at desc)`
- `performance_events (role_qualification_id, recorded_at desc)`

### 7.7 Row-level security model

- `qms_admin` — Raminder + designated QMS owner. Full read/write.
- `qms_vendor_manager` — qualification authority. Create/update on linguist records, evidence, role_qualifications, NDA. No delete. No edit on audit log (only insert).
- `qms_project_manager` — read-only on qualified vendors and their language/subject/mode qualifications. No internal_notes, no audit log, no performance events.
- `qms_linguist` — sees only their own vendor row and their own evidence/NDA. Matched by JWT email or vendor.auth_user_id.
- `qms_auditor` — read-only across all `qms.*` tables including audit log. Provisioned on demand, time-bounded JWT, every query logged.

`internal_notes` columns are hidden from non-admin roles via column-level grants and views.

The `qualification_audit_log` is INSERT-only for admin and vendor_manager; SELECT for all internal roles plus auditor; **no UPDATE or DELETE for any role at all**.

### 7.8 Storage

Single bucket: `qms-evidence` in Supabase Storage. Path convention:

```
qms-evidence/
  {vendor_id}/
    evidence/
      {evidence_id}-{slug}.{ext}
    nda/
      {nda_id}-{slug}.pdf
```

Bucket is private. Signed URLs generated on demand by an edge function (`qms-evidence-fetch`) that checks RLS-equivalent permissions before issuing.

### 7.9 Auditor query example

The decisive demonstration. Build at least this view as `qms.v_qualified_translators_by_pair_and_subject` — auditor asks "show me all translators currently qualified for Spanish→English in life sciences with active NDAs":

```sql
SELECT
  v.full_name, v.email, v.country,
  rq.qualified_at,
  cb.code AS competence_basis,
  string_agg(DISTINCT sm.name, ', ' ORDER BY sm.name) AS subject_matters,
  nda.signed_date AS nda_signed,
  nda.expiry_date AS nda_expires,
  rq.re_qualification_due
FROM public.vendors v
JOIN qms.role_qualifications rq ON rq.vendor_id = v.id
JOIN qms.role_types rt ON rt.id = rq.role_type_id
JOIN qms.competence_bases cb ON cb.id = rq.competence_basis_id
JOIN qms.language_pair_qualifications lpq ON lpq.role_qualification_id = rq.id
JOIN public.languages src ON src.id = lpq.source_language_id
JOIN public.languages tgt ON tgt.id = lpq.target_language_id
JOIN qms.subject_matter_qualifications smq ON smq.role_qualification_id = rq.id
JOIN qms.subject_matters sm ON sm.id = smq.subject_matter_id
JOIN qms.subject_matters parent ON parent.id = sm.parent_id
JOIN qms.nda_agreements nda
  ON nda.vendor_id = v.id
  AND nda.status = 'active'
  AND (nda.expiry_date IS NULL OR nda.expiry_date > now())
WHERE rt.code = 'translator'
  AND rq.status = 'qualified'
  AND src.code IN ('es', 'es-ES', 'es-MX', 'es-LA')
  AND tgt.code IN ('en', 'en-US', 'en-CA', 'en-GB')
  AND parent.code = 'life_sciences'
GROUP BY v.id, v.full_name, v.email, v.country,
         rq.qualified_at, cb.code, nda.signed_date, nda.expiry_date,
         rq.re_qualification_due
ORDER BY v.full_name;
```

Build this and the analogous views for reviser, post-editor, and interpreter.

## 8. Open decisions — confirm with Raminder before applying anything destructive

**(1) Schema location.** `qms` dedicated schema (recommended) or `iso_*` prefix in `public`?

**(2) Language code normalization.** `vendor_language_pairs.source_language` and `target_language` are text codes (`'EN'`, `'FR-CA'`) not FKs to `public.languages`. This is the single biggest impedance mismatch in the system. Three options:
- **(i)** Migrate `vendor_language_pairs` to FK `languages(id)` (recommended — clean, ~5,188 rows, codes mostly trivial case/format conversions). Requires updating consuming code paths and edge functions.
- **(ii)** Add a `language_code_aliases` lookup table mapping text codes to `languages.id`. Bridge solution; defers the underlying mess.
- **(iii)** Standardize everything on `languages.code` text and drop the uuid pattern. More invasive across CVP code paths.

If Raminder says (i), do it as a **separate migration before the QMS schema migration** — clean foundation first. Audit consuming code paths in the codebase, including edge functions, before applying.

**(3) Default eligibility state for the 1,468 existing vendors.** When the QMS migration goes live, are they all gated out of certified projects until properly qualified, or is there a subset (e.g., `total_projects > N`, `vendor_type = 'in-house'`) you want to flag for retroactive qualification through a dedicated workflow? Recommended default: all 1,468 start with no `qms.role_qualifications` rows, which means no eligibility for ISO-scoped projects until qualification is documented. The retroactive subset can be identified after the schema lands.

**(4) Bridge FK between `cvp_translators` and `vendors`.** Currently no link. Add now (single new column with FK constraint plus migration to populate from auth_user_id where possible) or treat as separate task?

## 9. Working principles

- **Direct execution preferred.** Use Supabase MCP — `apply_migration`, `execute_sql`, `list_tables`, `list_edge_functions` — to do the work, not produce SQL for someone else to run. That said: never run a destructive operation against production without explicit confirmation, and use `create_branch` for the migration before applying to main if risk warrants.
- **Read consuming code before changing schema.** Find all call sites in the Next.js app and edge functions that read/write `vendors`, `vendor_language_pairs`, `cvp_*`. The QMS additions are mostly additive (new tables, new columns, new constraints), but the language code normalization is not. Don't break production.
- **Records-first design.** The procedure document for vendor qualification (a separate Phase 4 deliverable) describes what the system does. The system is the proof. An auditor pulling SQL is convinced; an auditor reading prose is skeptical.
- **Every record maps to a clause.** The `competence_bases` lookup table is the spine. Keep it accurate to the standards. If you find a competence path that isn't covered, add a basis and document the standard reference.
- **Auditor-grade tamper resistance.** `qualification_audit_log` is append-only at the database level. Not by convention, by REVOKE.
- **Prose over bullets in any docs you produce.** Raminder prefers comprehensive multi-system audits followed by direct execution. When unsure about an operational detail, ask once, in one targeted question.
- **Comprehensive context, then act.** Don't ask for permission for every step — work through the briefing, propose your plan, get sign-off on open decisions, then execute.

## 10. Process for this session

1. **Read this brief end-to-end.** Don't start work until you've absorbed it.
2. **Verify the database state matches the briefing.** Run a small set of queries against `lmzoyezvsjgsxveoakdr` to confirm vendor counts, CVP state, language tables, and existing schema are still as described. Flag any drift.
3. **Read the consuming code.** Find every call site that reads/writes `vendors`, `vendor_language_pairs`, `cvp_applications`, `cvp_translators`, `cvp_translator_domains`, `languages`. List them. Identify which paths break under the proposed language normalization.
4. **Confirm the four open decisions** in §8 with Raminder. Don't proceed past this point until they're answered.
5. **Draft the migrations.** Plan: (a) language normalization migration if approved, (b) `qms` schema creation with all tables, enums, indexes, RLS, and seed data for reference tables, (c) any code path updates required by (a). Show the plan to Raminder before applying.
6. **Apply via MCP.** Use `apply_migration` for DDL, `execute_sql` only for verification queries. Consider `create_branch` for safety on the language normalization step.
7. **Verify.** Run the auditor-style queries from §7.9 against the new schema. Confirm RLS by switching JWT roles in test queries. Confirm `qualification_audit_log` rejects UPDATE and DELETE.
8. **Document what was built.** Write a short summary to `/docs/qms/phase-1-vendor-qualification-schema.md` (or wherever the project's docs live) covering: tables created, enums created, indexes, RLS roles, seed data, sample queries, and known gaps for future phases.
9. **Stop.** Do not start Phase 2 (procedure documents, project intake schema, training records) in this session. Phase 1 ends at "schema live, seeded, verified, documented."

## 11. Out of scope for this session

- Marketing / SEO / website edits (handled in a separate Cethos project)
- The `cethos.com` homepage's false "ISO 17100 and ISO 9001 compliant processes" claim (must be removed before audit but is a separate marketing task)
- NAP inconsistency cleanup across BBB / LinkedIn / GBP listings
- The Commissioner of Oaths business and `calgaryoaths.com`
- Apollo outreach pipeline
- QMS procedure documents (Phase 4)
- Internal audit checklists, management review templates (Phases 7–8)
- Training the in-house team on the new QMS (Phase 6)
- The `cethos-tms` Supabase project (out of scope, not migrating to it now)

## 12. Reference: Schema design v0.1 document

There is a longer schema design document at `cethos-qms-vendor-qualification-schema-v0.1.md` from the planning session. It predates the database introspection and proposed a **parallel `qms.linguists` table** that this briefing has explicitly superseded. Read it for context on rationale, but use this briefing for the actual design. Where they conflict, this briefing wins.

---

**Begin by acknowledging you've read the briefing, then run the verification queries in step 2 of §10. Report what you find before proposing the migration plan.**
