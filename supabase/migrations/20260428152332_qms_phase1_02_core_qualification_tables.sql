-- ============================================================================
-- QMS Phase 1 / Migration 2 of 6
-- Core qualification tables (no triggers yet — added in M3 alongside audit log).
-- All tables FK to public.vendors(id) — no columns added to public.vendors.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- role_qualifications — heart of the system. Gates assignment to ISO projects.
-- ---------------------------------------------------------------------------
create table qms.role_qualifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  role_type_id uuid not null references qms.role_types(id) on delete restrict,
  competence_basis_id uuid references qms.competence_bases(id),
  status qms.qualification_status not null default 'under_review',
  qualified_at timestamptz,
  qualified_by uuid references auth.users(id),
  last_re_qualified_at timestamptz,
  re_qualification_due timestamptz,
  competence_basis_notes text,
  suspended_at timestamptz,
  suspension_reason text,
  reinstated_at timestamptz,
  reinstated_by uuid references auth.users(id),
  withdrawn_at timestamptz,
  withdrawn_reason text,
  policy_version_id uuid references qms.policy_versions(id),
  internal_notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (vendor_id, role_type_id)
);
comment on table qms.role_qualifications is 'One row per (vendor, role). competence_basis_id + status=qualified is the certificate-grade claim. Preconditions enforced by trigger in M3.';

create index role_qualifications_status_qualified_idx
  on qms.role_qualifications (status) where status = 'qualified';
create index role_qualifications_re_qual_due_idx
  on qms.role_qualifications (re_qualification_due) where status = 'qualified';
create index role_qualifications_vendor_idx
  on qms.role_qualifications (vendor_id);
create index role_qualifications_role_type_idx
  on qms.role_qualifications (role_type_id);

-- ---------------------------------------------------------------------------
-- competence_evidence — verified credentials per vendor
-- ---------------------------------------------------------------------------
create table qms.competence_evidence (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  role_qualification_id uuid references qms.role_qualifications(id) on delete set null,
  evidence_type_id uuid not null references qms.evidence_types(id),
  title text not null,
  issuing_organization text,
  issuing_country_code text,
  issued_date date,
  expiry_date date,
  storage_path text,
  file_name text,
  file_mime text,
  file_size_bytes bigint,
  sha256 text,
  verified boolean not null default false,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  verification_method text,
  verification_notes text,
  superseded_by uuid references qms.competence_evidence(id),
  source_cvp_application_id uuid,
  source_cvp_test_submission_id uuid,
  internal_notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check (verified = false or verified_by is not null),
  check (verified = false or verified_at is not null)
);
comment on table qms.competence_evidence is 'Evidence supporting role qualifications. verified flag + verifier identity + verification method are required for use in qualification preconditions.';

create index competence_evidence_vendor_idx
  on qms.competence_evidence (vendor_id);
create index competence_evidence_role_qual_idx
  on qms.competence_evidence (role_qualification_id);
create index competence_evidence_type_idx
  on qms.competence_evidence (vendor_id, evidence_type_id);
create index competence_evidence_expiry_idx
  on qms.competence_evidence (expiry_date) where expiry_date is not null;
create index competence_evidence_verified_idx
  on qms.competence_evidence (verified) where verified = true;

-- ---------------------------------------------------------------------------
-- subject_matter_qualifications
-- ---------------------------------------------------------------------------
create table qms.subject_matter_qualifications (
  id uuid primary key default gen_random_uuid(),
  role_qualification_id uuid not null references qms.role_qualifications(id) on delete cascade,
  subject_matter_id uuid not null references qms.subject_matters(id),
  proficiency qms.proficiency_level not null default 'experienced',
  evidence_id uuid references qms.competence_evidence(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (role_qualification_id, subject_matter_id)
);
create index subject_matter_qualifications_subject_idx
  on qms.subject_matter_qualifications (subject_matter_id);

-- ---------------------------------------------------------------------------
-- interpreter_mode_qualifications
-- ---------------------------------------------------------------------------
create table qms.interpreter_mode_qualifications (
  id uuid primary key default gen_random_uuid(),
  role_qualification_id uuid not null references qms.role_qualifications(id) on delete cascade,
  mode_id uuid not null references qms.interpreter_modes(id),
  evidence_id uuid references qms.competence_evidence(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (role_qualification_id, mode_id)
);
create index interpreter_mode_qualifications_mode_idx
  on qms.interpreter_mode_qualifications (mode_id);

-- ---------------------------------------------------------------------------
-- language_pair_qualifications
-- ---------------------------------------------------------------------------
create table qms.language_pair_qualifications (
  id uuid primary key default gen_random_uuid(),
  role_qualification_id uuid not null references qms.role_qualifications(id) on delete cascade,
  source_language_id uuid not null references public.languages(id),
  target_language_id uuid not null references public.languages(id),
  direction qms.pair_direction not null default 'source_to_target',
  evidence_id uuid references qms.competence_evidence(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (role_qualification_id, source_language_id, target_language_id, direction),
  check (source_language_id <> target_language_id)
);
create index language_pair_qualifications_pair_idx
  on qms.language_pair_qualifications (source_language_id, target_language_id);
create index language_pair_qualifications_role_qual_idx
  on qms.language_pair_qualifications (role_qualification_id);

-- ---------------------------------------------------------------------------
-- professional_experience — for §3.1.4(b) and (c) and §6 alternative paths
-- ---------------------------------------------------------------------------
create table qms.professional_experience (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  role_type_id uuid not null references qms.role_types(id),
  employer_or_client text not null,
  description text,
  start_date date not null,
  end_date date,
  volume_indicator text,
  is_documented boolean not null default false,
  evidence_id uuid references qms.competence_evidence(id),
  verified boolean not null default false,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (end_date is null or end_date >= start_date)
);
create index professional_experience_vendor_idx
  on qms.professional_experience (vendor_id, role_type_id);

-- ---------------------------------------------------------------------------
-- nda_agreements — confidentiality lifecycle
-- ---------------------------------------------------------------------------
create table qms.nda_agreements (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  template_version text not null,
  signed_date date not null,
  effective_date date not null,
  expiry_date date,
  status qms.nda_status not null default 'active',
  signed_method text,
  signed_via text,
  storage_path text,
  countersigned boolean not null default false,
  countersigned_by uuid references auth.users(id),
  countersigned_date date,
  superseded_by uuid references qms.nda_agreements(id),
  revoked_at timestamptz,
  revoked_reason text,
  internal_notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check (effective_date >= signed_date),
  check (expiry_date is null or expiry_date >= effective_date)
);
create unique index nda_agreements_active_per_vendor_idx
  on qms.nda_agreements (vendor_id) where status = 'active';
create index nda_agreements_vendor_idx
  on qms.nda_agreements (vendor_id);
create index nda_agreements_expiry_idx
  on qms.nda_agreements (expiry_date) where expiry_date is not null and status = 'active';

-- ---------------------------------------------------------------------------
-- Storage bucket for evidence + NDA files (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qms-evidence',
  'qms-evidence',
  false,
  104857600,  -- 100 MB per file
  array['application/pdf','image/jpeg','image/png','image/heic','image/heif',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain']
)
on conflict (id) do nothing;
