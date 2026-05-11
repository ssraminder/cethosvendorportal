-- ============================================================================
-- QMS Phase 1 / Migration 1 of 6
-- Schema, enum types, reference tables, role assignments, helpers, seed data.
-- ISO 9001:2015, ISO 17100:2015, ISO 18587:2017, ISO 18841:2018, NSGCIS.
-- ============================================================================

create schema if not exists qms;
comment on schema qms is 'Quality Management System — ISO 9001 / 17100 / 18587 / 18841 / NSGCIS conformance layer. Sits on top of public.vendors as canonical linguist record. Phase 1: vendor qualification.';

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
create type qms.qualification_status as enum (
  'under_review','qualified','suspended','expired','withdrawn'
);
create type qms.pair_direction as enum (
  'source_to_target','both_directions'
);
create type qms.proficiency_level as enum (
  'familiar','experienced','specialist'
);
create type qms.nda_status as enum (
  'active','expired','superseded','revoked'
);
create type qms.audit_action as enum (
  'applied','submitted_for_review','qualified','re_qualified','suspended','reinstated',
  'withdrawn','offboarded','archived','evidence_added','evidence_verified','evidence_superseded',
  'nda_signed','nda_renewed','nda_revoked','performance_flag','config_changed'
);
create type qms.performance_event_type as enum (
  'project_completed','revision_finding','client_complaint','client_compliment',
  'late_delivery','quality_issue','capa_action_opened','capa_action_closed'
);
create type qms.severity as enum ('low','medium','high','critical');
create type qms.qms_role as enum (
  'qms_admin','qms_vendor_manager','qms_project_manager','qms_auditor'
);

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------
create table qms.role_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  iso_clause_reference text not null,
  description text,
  created_at timestamptz not null default now()
);
comment on table qms.role_types is 'Linguist role taxonomy. Each role maps to specific ISO competence clauses.';

create table qms.competence_bases (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  role_type_code text not null references qms.role_types(code) on update cascade,
  iso_clause_reference text not null,
  short_label text not null,
  description text not null,
  created_at timestamptz not null default now()
);
comment on table qms.competence_bases is 'Enumerated competence pathways from ISO 17100 §3.1.4 / §3.1.5, ISO 18587 §3.1, ISO 18841 §6, NSGCIS. Spine of audit traceability — every qualified linguist is qualified via exactly one basis.';

create table qms.evidence_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  applies_to_roles text[],
  iso_clause_reference text,
  created_at timestamptz not null default now()
);
comment on table qms.evidence_types is 'Categories of competence evidence. Each tagged to the ISO clause it satisfies.';

create table qms.subject_matters (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  parent_id uuid references qms.subject_matters(id),
  level int not null check (level in (1,2)),
  sort_order int not null default 0,
  description text,
  created_at timestamptz not null default now()
);
comment on table qms.subject_matters is 'Hierarchical taxonomy (two levels) of translation/interpretation domains.';

create table qms.interpreter_modes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  nsgcis_relevant boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table qms.interpreter_modes is 'Interpreter delivery modes. NSGCIS-relevant flag highlights community-interpreting modes.';

-- ---------------------------------------------------------------------------
-- Role assignments — who has QMS authority
-- ---------------------------------------------------------------------------
create table qms.role_assignments (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  qms_role qms.qms_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  expires_at timestamptz,
  notes text,
  unique (auth_user_id, qms_role)
);
create index role_assignments_user_idx on qms.role_assignments (auth_user_id);
create index role_assignments_role_idx on qms.role_assignments (qms_role);
comment on table qms.role_assignments is 'Maps auth users to QMS roles. expires_at enables time-bounded auditor access.';

-- ---------------------------------------------------------------------------
-- Config table — cadences, thresholds, governed parameters
-- ---------------------------------------------------------------------------
create table qms.config (
  key text primary key,
  value jsonb not null,
  description text not null,
  iso_clause_reference text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
comment on table qms.config is 'QMS governance parameters (re-qualification cadence, NDA lifetimes, SLAs). Auditable: updates write to qualification_audit_log.';

-- ---------------------------------------------------------------------------
-- Policy versions skeleton (populated in Phase 4)
-- ---------------------------------------------------------------------------
create table qms.policy_versions (
  id uuid primary key default gen_random_uuid(),
  document_code text not null,
  version text not null,
  effective_from date not null,
  effective_to date,
  iso_clause_references text[],
  storage_path text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (document_code, version)
);
create index policy_versions_effective_idx on qms.policy_versions (document_code, effective_from desc);
comment on table qms.policy_versions is 'Versioned QMS procedure documents. Populated in Phase 4. Allows any qualification decision to cite the procedure version in force at decision time.';

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, STABLE)
-- ---------------------------------------------------------------------------
create or replace function qms.has_qms_role(p_role qms.qms_role)
returns boolean
language sql
stable
security definer
set search_path = public, qms
as $fn$
  select exists (
    select 1 from qms.role_assignments ra
    where ra.auth_user_id = auth.uid()
      and ra.qms_role = p_role
      and (ra.expires_at is null or ra.expires_at > now())
  );
$fn$;

create or replace function qms.is_qms_admin()
returns boolean
language sql
stable
security definer
set search_path = public, qms
as $fn$
  select qms.has_qms_role('qms_admin'::qms.qms_role);
$fn$;

create or replace function qms.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public, qms
as $fn$
  select v.id from public.vendors v where v.auth_user_id = auth.uid() limit 1;
$fn$;

-- Convenience: combined "is QMS staff" — admin or vendor manager or pm
create or replace function qms.is_qms_staff()
returns boolean
language sql
stable
security definer
set search_path = public, qms
as $fn$
  select exists (
    select 1 from qms.role_assignments ra
    where ra.auth_user_id = auth.uid()
      and ra.qms_role in ('qms_admin','qms_vendor_manager','qms_project_manager')
      and (ra.expires_at is null or ra.expires_at > now())
  );
$fn$;

-- ---------------------------------------------------------------------------
-- Seed: role_types
-- ---------------------------------------------------------------------------
insert into qms.role_types (code, name, iso_clause_reference, description) values
  ('translator','Translator','ISO 17100:2015 §3.1.4','Renders source-language content into target-language target text meeting agreed specifications.'),
  ('reviser','Reviser','ISO 17100:2015 §3.1.5','Performs bilingual examination of target content against source content for suitability.'),
  ('post_editor','Post-editor','ISO 18587:2017 §3.1','Edits machine-translated output against source text to meet agreed specifications.'),
  ('interpreter','Interpreter','ISO 18841:2018 §6 / NSGCIS','Renders spoken or signed source-language content into target-language form.');

-- ---------------------------------------------------------------------------
-- Seed: competence_bases
-- ---------------------------------------------------------------------------
insert into qms.competence_bases (code, role_type_code, iso_clause_reference, short_label, description) values
  ('t_a_degree_translation','translator','ISO 17100:2015 §3.1.4(a)','Recognized degree in translation','Recognized graduate qualification in translation studies from an institution of higher education.'),
  ('t_b_degree_other_plus_2y','translator','ISO 17100:2015 §3.1.4(b)','Degree (other field) + 2 years documented experience','Recognized graduate qualification in any other field, plus a minimum of two years documented professional translation experience.'),
  ('t_c_5y_experience','translator','ISO 17100:2015 §3.1.4(c)','5 years documented experience','Minimum five years documented full-time professional translation experience.'),
  ('r_translator_plus_revision','reviser','ISO 17100:2015 §3.1.5','Translator competence + revision experience','Translator competence per §3.1.4 plus translation/revision experience in the relevant subject domain.'),
  ('pe_translator_plus_pemt','post_editor','ISO 18587:2017 §3.1','Translator competence + PEMT training/experience','Translator competence per ISO 17100 §3.1.4 plus training or documented experience in machine-translation post-editing.'),
  ('i_training_plus_proficiency','interpreter','ISO 18841:2018 §6','Recognized interpreter training + verified proficiency','Recognized interpreter training programme plus verified language proficiency in the working languages.'),
  ('i_5y_experience','interpreter','ISO 18841:2018 §6 (alternative)','5 years documented interpreting experience','Five years documented professional interpreting experience as alternative path to formal training.');

-- ---------------------------------------------------------------------------
-- Seed: evidence_types
-- ---------------------------------------------------------------------------
insert into qms.evidence_types (code, name, description, applies_to_roles, iso_clause_reference) values
  ('degree_translation','Recognized degree in translation','Diploma or transcript from accredited institution of higher education in translation studies.','{translator}','ISO 17100 §3.1.4(a)'),
  ('degree_other','Recognized degree in other field','Diploma or transcript from accredited institution of higher education in any field other than translation.','{translator}','ISO 17100 §3.1.4(b)'),
  ('documented_translation_experience','Documented professional translation experience','Verifiable record of professional translation work — invoices, employer letter, project history, references.','{translator,reviser,post_editor}','ISO 17100 §3.1.4(b)/(c)'),
  ('documented_interpretation_experience','Documented professional interpreting experience','Verifiable record of professional interpreting assignments.','{interpreter}','ISO 18841 §6'),
  ('mt_post_editing_training','MT post-editing training','Certificate or course completion in machine translation post-editing methodology.','{post_editor}','ISO 18587 §3.1'),
  ('interpreter_training_certificate','Interpreter training certificate','Certificate of completion from a recognized interpreter training programme.','{interpreter}','ISO 18841 §6'),
  ('mode_specific_certification','Interpreter mode certification','Certification or training specific to a delivery mode (consecutive, simultaneous, sight, OPI/VRI).','{interpreter}','NSGCIS'),
  ('domain_specific_certification','Domain-specific certification','Certification specific to a domain (healthcare, legal, etc.) — CHIA, CCHI, MITS, etc.','{interpreter,translator}','NSGCIS / ISO 17100 §3.1.5'),
  ('language_proficiency_test','Language proficiency test result','Standardized test result establishing proficiency (DELF, HSK, ILR, etc.).','{translator,interpreter,post_editor}','ISO 18841 §6 / ISO 17100 §3.1.4'),
  ('professional_membership','Professional membership','Active membership in a recognized professional body (ATIO, ATA, AIIC, ITI, etc.).','{translator,reviser,post_editor,interpreter}',null),
  ('continuing_professional_development','Continuing professional development','Record of CPD activity within the qualification cycle.','{translator,reviser,post_editor,interpreter}','ISO 17100 §6.1.4'),
  ('background_check','Background check','Criminal record check or equivalent vetting.','{interpreter}','NSGCIS'),
  ('references_verified','References verified','Verified professional references attesting to competence and conduct.','{translator,reviser,post_editor,interpreter}','ISO 17100 §6.1'),
  ('internal_test_passed','Internal qualification test passed','Pass result on Cethos CVP test for the relevant language pair / domain / service.','{translator,reviser,post_editor,interpreter}',null),
  ('cultural_competence_training','Cultural competence training','Completion of training in cultural mediation appropriate to community interpreting.','{interpreter}','NSGCIS'),
  ('ethics_training','Ethics training','Completion of training in interpreter ethics and professional conduct.','{interpreter}','NSGCIS');

-- ---------------------------------------------------------------------------
-- Seed: subject_matters (level 1 then level 2)
-- ---------------------------------------------------------------------------
insert into qms.subject_matters (code, name, level, sort_order) values
  ('legal','Legal',1,10),
  ('life_sciences','Life Sciences / Medical',1,20),
  ('business_financial','Business / Financial',1,30),
  ('technical','Technical',1,40),
  ('government_public','Government / Public Sector',1,50),
  ('interpretation_domains','Interpretation Domains (NSGCIS)',1,60);

insert into qms.subject_matters (code, name, parent_id, level, sort_order)
select 'legal_corporate','Corporate / Commercial Law', id, 2, 10 from qms.subject_matters where code='legal' union all
select 'legal_litigation','Litigation', id, 2, 20 from qms.subject_matters where code='legal' union all
select 'legal_immigration','Immigration', id, 2, 30 from qms.subject_matters where code='legal' union all
select 'legal_certified_translation','Certified Translation (legal documents)', id, 2, 40 from qms.subject_matters where code='legal' union all
select 'legal_court_interpreting','Court Interpreting', id, 2, 50 from qms.subject_matters where code='legal' union all
select 'ls_clinical','Clinical / Patient-facing', id, 2, 10 from qms.subject_matters where code='life_sciences' union all
select 'ls_regulatory','Regulatory (FDA / Health Canada / EMA)', id, 2, 20 from qms.subject_matters where code='life_sciences' union all
select 'ls_pharmaceutical','Pharmaceutical', id, 2, 30 from qms.subject_matters where code='life_sciences' union all
select 'ls_medical_devices','Medical Devices', id, 2, 40 from qms.subject_matters where code='life_sciences' union all
select 'ls_clinical_trials','Clinical Trials (ICF, COA, COG)', id, 2, 50 from qms.subject_matters where code='life_sciences' union all
select 'ls_cognitive_debriefing','Cognitive Debriefing', id, 2, 60 from qms.subject_matters where code='life_sciences' union all
select 'bf_finance','Finance / Banking', id, 2, 10 from qms.subject_matters where code='business_financial' union all
select 'bf_marketing','Marketing / Transcreation', id, 2, 20 from qms.subject_matters where code='business_financial' union all
select 'bf_hr','HR / Internal Communications', id, 2, 30 from qms.subject_matters where code='business_financial' union all
select 'bf_general','General Business', id, 2, 40 from qms.subject_matters where code='business_financial' union all
select 'tech_software','Software / IT / Localization', id, 2, 10 from qms.subject_matters where code='technical' union all
select 'tech_engineering','Engineering / Manufacturing', id, 2, 20 from qms.subject_matters where code='technical' union all
select 'tech_oil_gas','Oil & Gas / Energy', id, 2, 30 from qms.subject_matters where code='technical' union all
select 'gov_immigration','Immigration / IRCC', id, 2, 10 from qms.subject_matters where code='government_public' union all
select 'gov_education','Education', id, 2, 20 from qms.subject_matters where code='government_public' union all
select 'gov_social_services','Social Services', id, 2, 30 from qms.subject_matters where code='government_public' union all
select 'int_healthcare','Community Interpreting — Healthcare', id, 2, 10 from qms.subject_matters where code='interpretation_domains' union all
select 'int_legal','Community Interpreting — Legal', id, 2, 20 from qms.subject_matters where code='interpretation_domains' union all
select 'int_social_services','Community Interpreting — Social Services', id, 2, 30 from qms.subject_matters where code='interpretation_domains' union all
select 'int_education','Community Interpreting — Education', id, 2, 40 from qms.subject_matters where code='interpretation_domains' union all
select 'int_mental_health','Community Interpreting — Mental Health', id, 2, 50 from qms.subject_matters where code='interpretation_domains';

-- ---------------------------------------------------------------------------
-- Seed: interpreter_modes
-- ---------------------------------------------------------------------------
insert into qms.interpreter_modes (code, name, description, nsgcis_relevant) values
  ('consecutive','Consecutive interpreting','Speaker pauses for the interpreter to render content in segments.',true),
  ('simultaneous','Simultaneous interpreting','Real-time rendering during the speaker''s delivery.',true),
  ('sight_translation','Sight translation','Oral rendering of a written source document.',true),
  ('whispered','Whispered (chuchotage)','Simultaneous interpreting whispered to one or two listeners.',false),
  ('opi','Over-the-phone interpreting','Telephone-based interpreting.',true),
  ('vri','Video remote interpreting','Video-based remote interpreting.',true);

-- ---------------------------------------------------------------------------
-- Seed: config (governance parameters)
-- ---------------------------------------------------------------------------
insert into qms.config (key, value, description, iso_clause_reference) values
  ('re_qualification_interval_months', '12'::jsonb, 'Default cadence (months) for periodic re-qualification of qualified linguists.','ISO 17100 §6.1'),
  ('nda_renewal_interval_months', '60'::jsonb, 'Default lifetime (months) of an active NDA before renewal is required.','ISO 17100 §5.4'),
  ('evidence_verification_sla_days', '14'::jsonb, 'Maximum days from evidence upload to verification by qualification authority.','ISO 9001 §8.4'),
  ('cpd_minimum_hours_annual', '20'::jsonb, 'Minimum continuing professional development hours required per qualification cycle.','ISO 17100 §6.1.4'),
  ('qualification_requires_active_nda', 'true'::jsonb, 'Whether transition to status=qualified requires an active NDA. Enforced by trigger.','ISO 17100 §5.4'),
  ('qualification_requires_verified_evidence', 'true'::jsonb, 'Whether transition to status=qualified requires at least one verified competence_evidence row.','ISO 17100 §6.1');

-- ---------------------------------------------------------------------------
-- Seed: qms_admin role for raminder@cethos.com
-- ---------------------------------------------------------------------------
insert into qms.role_assignments (auth_user_id, qms_role, notes)
select su.auth_user_id,
       'qms_admin'::qms.qms_role,
       'Seeded with QMS Phase 1. Qualification authority for ISO 9001 / 17100 / 18587 / 18841 / NSGCIS scope.'
from public.staff_users su
where lower(su.email) = lower('raminder@cethos.com')
  and su.auth_user_id is not null
on conflict (auth_user_id, qms_role) do nothing;
