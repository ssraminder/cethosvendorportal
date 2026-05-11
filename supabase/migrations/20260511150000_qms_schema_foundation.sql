-- QMS Schema Foundation (Phase 1 — Audit-readiness Sprint, narrowed Track A scope)
-- Purpose: ISO 17100 / 18587 / 18841 / NSGCIS vendor qualification layer on top of
--          the canonical public.vendors record. Provides structured, queryable evidence
--          for the June 29-30, 2026 pharma sponsor vendor QA audit and the December 2026
--          Orion Stage 2 audit.
-- Source spec: D:\cethos-vendor\Documents\claude-code-prompt-cethos-qms-phase-1.md
-- Dependencies: public.vendors, public.languages, public.staff_users
-- Date: 2026-05-11

CREATE SCHEMA IF NOT EXISTS qms;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE qms.qualification_status AS ENUM (
    'under_review', 'qualified', 'suspended', 'expired', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qms.pair_direction AS ENUM (
    'source_to_target', 'both_directions'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qms.proficiency_level AS ENUM (
    'familiar', 'experienced', 'specialist'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qms.nda_status AS ENUM (
    'active', 'expired', 'superseded', 'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qms.audit_action AS ENUM (
    'applied',
    'submitted_for_review',
    'qualified',
    're_qualified',
    'suspended',
    'reinstated',
    'withdrawn',
    'offboarded',
    'archived',
    'evidence_added',
    'evidence_verified',
    'nda_signed',
    'nda_renewed',
    'performance_flag'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qms.performance_event_type AS ENUM (
    'project_completed',
    'revision_finding',
    'client_complaint',
    'client_compliment',
    'late_delivery',
    'quality_issue',
    'capa_action_opened',
    'capa_action_closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qms.severity AS ENUM (
    'low', 'medium', 'high', 'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- LOOKUP TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qms.role_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qms.competence_bases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  role_type_code  TEXT NOT NULL REFERENCES qms.role_types(code) ON UPDATE CASCADE,
  iso_clause      TEXT NOT NULL,
  description     TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qms.subject_matters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES qms.subject_matters(id) ON DELETE RESTRICT,
  level       INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qms_subject_matters_parent
  ON qms.subject_matters(parent_id);

CREATE TABLE IF NOT EXISTS qms.interpreter_modes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qms.evidence_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  applies_to_role TEXT,
  iso_clause      TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- LOOKUP SEEDS
-- ----------------------------------------------------------------------------

INSERT INTO qms.role_types (code, display_name, description, sort_order) VALUES
  ('translator',  'Translator',  'ISO 17100 §3.1.4 — produces target-language content from source.', 10),
  ('reviser',     'Reviser',     'ISO 17100 §3.1.5 — bilingually examines target against source.', 20),
  ('post_editor', 'Post-editor', 'ISO 18587 §3.1 — post-edits machine translation output.', 30),
  ('interpreter', 'Interpreter', 'ISO 18841 §6 — renders spoken language in real time.', 40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO qms.competence_bases (code, role_type_code, iso_clause, description, sort_order) VALUES
  ('t_a_degree_translation',        'translator',  'ISO 17100 §3.1.4(a)', 'Recognized degree in translation, translation studies, or equivalent.', 10),
  ('t_b_degree_other_plus_2y',      'translator',  'ISO 17100 §3.1.4(b)', 'Degree in another field plus two years of documented professional translation experience.', 20),
  ('t_c_5y_experience',             'translator',  'ISO 17100 §3.1.4(c)', 'Five years of documented professional translation experience.', 30),
  ('r_translator_plus_revision',    'reviser',     'ISO 17100 §3.1.5',    'Translator competence plus revision experience plus relevant subject expertise.', 40),
  ('pe_translator_plus_pemt',       'post_editor', 'ISO 18587 §3.1',      'Translator competence plus MT post-editing training or documented experience.', 50),
  ('i_training_plus_proficiency',   'interpreter', 'ISO 18841 §6',        'Recognized interpreter training plus verified language proficiency.', 60),
  ('i_5y_experience',               'interpreter', 'ISO 18841 §6 alt',    'Five years of documented professional interpreting experience.', 70)
ON CONFLICT (code) DO NOTHING;

INSERT INTO qms.interpreter_modes (code, display_name, description, sort_order) VALUES
  ('consecutive',        'Consecutive',         'Interpreter speaks after the source speaker pauses.', 10),
  ('simultaneous',       'Simultaneous',        'Interpreter speaks at the same time as the source speaker.', 20),
  ('sight_translation',  'Sight translation',   'Oral rendering of a written source on the fly.', 30),
  ('whispered',          'Whispered (chuchotage)','Simultaneous interpretation whispered to one or two listeners.', 40),
  ('opi',                'Over-the-phone (OPI)','Telephone-based remote interpretation.', 50),
  ('vri',                'Video remote (VRI)',  'Video-based remote interpretation.', 60)
ON CONFLICT (code) DO NOTHING;

-- Subject matter taxonomy (two levels). Insert parents first, then children.
INSERT INTO qms.subject_matters (code, name, parent_id, level, sort_order) VALUES
  ('legal',              'Legal',                            NULL, 1, 10),
  ('life_sciences',      'Life Sciences / Medical',          NULL, 1, 20),
  ('business_financial', 'Business / Financial',             NULL, 1, 30),
  ('technical',          'Technical',                        NULL, 1, 40),
  ('government_public',  'Government / Public Sector',       NULL, 1, 50),
  ('interpretation_domains', 'Interpretation Domains (NSGCIS)', NULL, 1, 60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO qms.subject_matters (code, name, parent_id, level, sort_order)
SELECT v.code, v.name, parent.id, 2, v.sort_order
FROM (VALUES
  ('legal_contracts',          'Contracts and commercial law',     'legal',              10),
  ('legal_litigation',          'Litigation and dispute resolution','legal',              20),
  ('legal_immigration',         'Immigration law',                  'legal',              30),
  ('legal_corporate',           'Corporate and securities law',     'legal',              40),
  ('ls_clinical_trials',        'Clinical trials and COA / PRO',    'life_sciences',      10),
  ('ls_pharmaceutical',         'Pharmaceutical and regulatory',    'life_sciences',      20),
  ('ls_medical_devices',        'Medical devices',                  'life_sciences',      30),
  ('ls_clinical_documentation', 'Clinical documentation',           'life_sciences',      40),
  ('ls_public_health',          'Public health',                    'life_sciences',      50),
  ('bf_financial_reports',      'Financial reports and accounting', 'business_financial', 10),
  ('bf_marketing',              'Marketing and corporate comms',    'business_financial', 20),
  ('bf_hr',                     'Human resources',                  'business_financial', 30),
  ('bf_insurance',              'Insurance',                        'business_financial', 40),
  ('tech_it_software',          'IT and software',                  'technical',          10),
  ('tech_engineering',          'Engineering',                      'technical',          20),
  ('tech_automotive',           'Automotive',                       'technical',          30),
  ('tech_energy',               'Energy and utilities',             'technical',          40),
  ('gp_government_forms',       'Government forms and notices',     'government_public',  10),
  ('gp_social_services',        'Social services and community',    'government_public',  20),
  ('gp_education',              'Education',                        'government_public',  30),
  ('id_healthcare',             'Healthcare interpreting',          'interpretation_domains', 10),
  ('id_legal_interpreting',     'Legal and court interpreting',     'interpretation_domains', 20),
  ('id_social_services_interp', 'Social services interpreting',     'interpretation_domains', 30),
  ('id_education_interp',       'Education interpreting',           'interpretation_domains', 40)
) AS v(code, name, parent_code, sort_order)
JOIN qms.subject_matters parent ON parent.code = v.parent_code
ON CONFLICT (code) DO NOTHING;

INSERT INTO qms.evidence_types (code, display_name, applies_to_role, iso_clause, sort_order) VALUES
  ('degree_translation',                'Degree in translation',                       'translator',  'ISO 17100 §3.1.4(a)', 10),
  ('degree_other',                       'Degree in another field',                     'translator',  'ISO 17100 §3.1.4(b)', 20),
  ('documented_translation_experience',  'Documented translation experience',           'translator',  'ISO 17100 §3.1.4(b)(c)', 30),
  ('documented_interpretation_experience','Documented interpretation experience',       'interpreter', 'ISO 18841 §6 alt',    40),
  ('mt_post_editing_training',           'MT post-editing training',                    'post_editor', 'ISO 18587 §3.1',      50),
  ('interpreter_training_certificate',   'Interpreter training certificate',            'interpreter', 'ISO 18841 §6',        60),
  ('mode_specific_certification',        'Interpreter mode-specific certification',     'interpreter', 'ISO 18841 / NSGCIS',  70),
  ('domain_specific_certification',      'Domain-specific certification',               NULL,          NULL,                  80),
  ('language_proficiency_test',          'Language proficiency test result',            NULL,          'ISO 18841 §6',        90),
  ('professional_membership',            'Professional body membership',                NULL,          NULL,                 100),
  ('continuing_professional_development','Continuing professional development record',  NULL,          'ISO 17100 §4.1.7',   110),
  ('background_check',                   'Background check',                            NULL,          NULL,                 120),
  ('references_verified',                'Verified professional references',            NULL,          NULL,                 130),
  ('internal_test_passed',               'Internal test passed (CVP)',                  NULL,          NULL,                 140),
  ('cultural_competence_training',       'Cultural competence training (NSGCIS)',       'interpreter', 'NSGCIS',             150),
  ('ethics_training',                    'Ethics training (NSGCIS)',                    'interpreter', 'NSGCIS',             160),
  ('passport_id',                        'Passport or government ID',                   NULL,          NULL,                 170),
  ('nda_signed',                         'Signed NDA / confidentiality agreement',      NULL,          NULL,                 180)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- RECORD TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qms.role_qualifications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                   UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  role_type_id                UUID NOT NULL REFERENCES qms.role_types(id) ON DELETE RESTRICT,
  competence_basis_id         UUID REFERENCES qms.competence_bases(id) ON DELETE RESTRICT,
  status                      qms.qualification_status NOT NULL DEFAULT 'under_review',
  qualified_at                TIMESTAMPTZ,
  qualified_by                UUID REFERENCES public.staff_users(id),
  last_re_qualified_at        TIMESTAMPTZ,
  re_qualification_due        DATE,
  competence_basis_notes      TEXT,
  suspended_at                TIMESTAMPTZ,
  suspension_reason           TEXT,
  withdrawn_at                TIMESTAMPTZ,
  withdrawal_reason           TEXT,
  internal_notes              TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_id, role_type_id)
);

CREATE INDEX IF NOT EXISTS idx_qms_role_qualifications_qualified
  ON qms.role_qualifications (status)
  WHERE status = 'qualified';

CREATE INDEX IF NOT EXISTS idx_qms_role_qualifications_re_qual_due
  ON qms.role_qualifications (re_qualification_due)
  WHERE status = 'qualified';

CREATE INDEX IF NOT EXISTS idx_qms_role_qualifications_vendor
  ON qms.role_qualifications (vendor_id);

CREATE TABLE IF NOT EXISTS qms.competence_evidence (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                   UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  role_qualification_id       UUID REFERENCES qms.role_qualifications(id) ON DELETE SET NULL,
  evidence_type_id            UUID NOT NULL REFERENCES qms.evidence_types(id) ON DELETE RESTRICT,
  title                       TEXT NOT NULL,
  issuing_organization        TEXT,
  issuing_country_code        VARCHAR(2),
  issued_date                 DATE,
  expiry_date                 DATE,
  storage_path                TEXT,
  file_name                   TEXT,
  file_mime                   TEXT,
  file_size_bytes             BIGINT,
  sha256                      TEXT,
  verified                    BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by                 UUID REFERENCES public.staff_users(id),
  verified_at                 TIMESTAMPTZ,
  verification_method         TEXT,
  verification_notes          TEXT,
  superseded_by               UUID REFERENCES qms.competence_evidence(id) ON DELETE SET NULL,
  source_cvp_application_id   UUID REFERENCES cvp_applications(id) ON DELETE SET NULL,
  source_cvp_test_submission_id UUID REFERENCES cvp_test_submissions(id) ON DELETE SET NULL,
  internal_notes              TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qms_evidence_vendor_type
  ON qms.competence_evidence (vendor_id, evidence_type_id);

CREATE INDEX IF NOT EXISTS idx_qms_evidence_expiry
  ON qms.competence_evidence (expiry_date)
  WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qms_evidence_role_qual
  ON qms.competence_evidence (role_qualification_id);

CREATE TABLE IF NOT EXISTS qms.subject_matter_qualifications (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_qualification_id    UUID NOT NULL REFERENCES qms.role_qualifications(id) ON DELETE CASCADE,
  subject_matter_id        UUID NOT NULL REFERENCES qms.subject_matters(id) ON DELETE RESTRICT,
  proficiency_level        qms.proficiency_level NOT NULL DEFAULT 'experienced',
  evidence_id              UUID REFERENCES qms.competence_evidence(id) ON DELETE SET NULL,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_qualification_id, subject_matter_id)
);

CREATE INDEX IF NOT EXISTS idx_qms_smq_subject
  ON qms.subject_matter_qualifications (subject_matter_id);

CREATE TABLE IF NOT EXISTS qms.interpreter_mode_qualifications (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_qualification_id    UUID NOT NULL REFERENCES qms.role_qualifications(id) ON DELETE CASCADE,
  mode_id                  UUID NOT NULL REFERENCES qms.interpreter_modes(id) ON DELETE RESTRICT,
  evidence_id              UUID REFERENCES qms.competence_evidence(id) ON DELETE SET NULL,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_qualification_id, mode_id)
);

CREATE TABLE IF NOT EXISTS qms.language_pair_qualifications (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_qualification_id    UUID NOT NULL REFERENCES qms.role_qualifications(id) ON DELETE CASCADE,
  source_language_id       UUID NOT NULL REFERENCES public.languages(id) ON DELETE RESTRICT,
  target_language_id       UUID NOT NULL REFERENCES public.languages(id) ON DELETE RESTRICT,
  direction                qms.pair_direction NOT NULL DEFAULT 'source_to_target',
  evidence_id              UUID REFERENCES qms.competence_evidence(id) ON DELETE SET NULL,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_qualification_id, source_language_id, target_language_id)
);

CREATE INDEX IF NOT EXISTS idx_qms_lpq_pair
  ON qms.language_pair_qualifications (source_language_id, target_language_id);

CREATE TABLE IF NOT EXISTS qms.nda_agreements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  template_version    TEXT NOT NULL,
  signed_date         DATE NOT NULL,
  effective_date      DATE,
  expiry_date         DATE,
  status              qms.nda_status NOT NULL DEFAULT 'active',
  signed_method       TEXT,
  signed_via          TEXT,
  storage_path        TEXT,
  countersigned       BOOLEAN NOT NULL DEFAULT FALSE,
  countersigned_by    UUID REFERENCES public.staff_users(id),
  countersigned_date  DATE,
  superseded_by       UUID REFERENCES qms.nda_agreements(id) ON DELETE SET NULL,
  revoked_at          TIMESTAMPTZ,
  revoke_reason       TEXT,
  internal_notes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qms_nda_one_active_per_vendor
  ON qms.nda_agreements (vendor_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_qms_nda_expiry
  ON qms.nda_agreements (expiry_date)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS qms.professional_experience (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  role_type_id        UUID NOT NULL REFERENCES qms.role_types(id) ON DELETE RESTRICT,
  employer_client     TEXT NOT NULL,
  description         TEXT,
  start_date          DATE,
  end_date            DATE,
  volume_indicator    TEXT,
  is_documented       BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_id         UUID REFERENCES qms.competence_evidence(id) ON DELETE SET NULL,
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by         UUID REFERENCES public.staff_users(id),
  verified_at         TIMESTAMPTZ,
  verification_notes  TEXT,
  internal_notes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qms_prof_exp_vendor_role
  ON qms.professional_experience (vendor_id, role_type_id);

CREATE TABLE IF NOT EXISTS qms.performance_events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_qualification_id       UUID NOT NULL REFERENCES qms.role_qualifications(id) ON DELETE CASCADE,
  event_type                  qms.performance_event_type NOT NULL,
  severity                    qms.severity NOT NULL DEFAULT 'low',
  project_reference           TEXT,
  cvp_job_id                  UUID REFERENCES cvp_jobs(id) ON DELETE SET NULL,
  notes                       TEXT,
  recorded_by                 UUID REFERENCES public.staff_users(id),
  recorded_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qms_perf_events_role_qual_time
  ON qms.performance_events (role_qualification_id, recorded_at DESC);

-- ----------------------------------------------------------------------------
-- AUDIT LOG (append-only, REVOKE UPDATE/DELETE)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qms.qualification_audit_log (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  role_qualification_id    UUID REFERENCES qms.role_qualifications(id) ON DELETE SET NULL,
  action                   qms.audit_action NOT NULL,
  prior_status             qms.qualification_status,
  new_status               qms.qualification_status,
  reason                   TEXT,
  linked_evidence_ids      UUID[] NOT NULL DEFAULT '{}',
  performed_by             UUID REFERENCES public.staff_users(id),
  performed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address               INET,
  user_agent               TEXT
);

CREATE INDEX IF NOT EXISTS idx_qms_audit_log_role_qual
  ON qms.qualification_audit_log (role_qualification_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_qms_audit_log_vendor
  ON qms.qualification_audit_log (vendor_id, performed_at DESC);

-- Non-negotiable: append-only at the database level (briefing §7.7).
REVOKE UPDATE, DELETE ON qms.qualification_audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON qms.qualification_audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON qms.qualification_audit_log FROM anon;
REVOKE UPDATE, DELETE ON qms.qualification_audit_log FROM service_role;

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION qms.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_qms_role_qualifications_updated_at
    BEFORE UPDATE ON qms.role_qualifications
    FOR EACH ROW EXECUTE FUNCTION qms.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_qms_competence_evidence_updated_at
    BEFORE UPDATE ON qms.competence_evidence
    FOR EACH ROW EXECUTE FUNCTION qms.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_qms_nda_agreements_updated_at
    BEFORE UPDATE ON qms.nda_agreements
    FOR EACH ROW EXECUTE FUNCTION qms.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_qms_professional_experience_updated_at
    BEFORE UPDATE ON qms.professional_experience
    FOR EACH ROW EXECUTE FUNCTION qms.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
