-- Referee reference-form enhancements (2026-06-23).
--
-- Adds richer §3.1.4 engagement evidence the referee can attest to, beyond the
-- existing start-year + domain confirmation + competence MCQs:
--   * full-time vs part-time (Gap 7 — route-c rigor; advisory for now)
--   * approximate annual translation volume
--   * end of the working relationship / still ongoing (bounds the duration)
--   * independence attestation (not a relative, no financial stake) — ISO/IQVIA credibility
--   * the referee's own role + how they worked with the applicant
--
-- The domain-confirmation checklist now keys off the applicant's CLAIMED approval
-- domains (cvp_applications.domains_offered, 23-code set), not the legacy 8-bucket
-- per-referee selection. reference_confirmed_domains therefore now stores
-- domains_offered codes; domain_verification is recomputed against domains_offered.
-- (Legacy received rows keep their 8-bucket codes — read-only history.)
--
-- All columns are nullable / default-safe so pending + already-submitted rows are
-- unaffected; the form/edge function populate them on new submissions.

ALTER TABLE cvp_application_references
  ADD COLUMN IF NOT EXISTS referee_employment_type        text,
  ADD COLUMN IF NOT EXISTS referee_annual_volume          text,
  ADD COLUMN IF NOT EXISTS reference_confirmed_end_year    smallint,
  ADD COLUMN IF NOT EXISTS reference_relationship_ongoing  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referee_independent             boolean,
  ADD COLUMN IF NOT EXISTS referee_independence_note       text,
  ADD COLUMN IF NOT EXISTS referee_relationship_type       text,
  ADD COLUMN IF NOT EXISTS referee_role_title              text,
  ADD COLUMN IF NOT EXISTS referee_relationship_other      text;

-- Employment type (referee's view of how the applicant worked as a translator).
ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_referee_employment_type;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_referee_employment_type
    CHECK (referee_employment_type IS NULL
      OR referee_employment_type IN ('full_time', 'part_time', 'unsure'));

-- Approx annual volume (words/year buckets).
ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_referee_annual_volume;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_referee_annual_volume
    CHECK (referee_annual_volume IS NULL
      OR referee_annual_volume IN ('lt_50k', '50k_150k', '150k_500k', 'gt_500k', 'unsure'));

-- End year (static range; precise current-year check enforced in the edge fn).
ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_reference_confirmed_end_year;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_reference_confirmed_end_year
    CHECK (reference_confirmed_end_year IS NULL
      OR reference_confirmed_end_year BETWEEN 1980 AND 2100);

-- Relationship type (how the referee worked with the applicant).
ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_referee_relationship_type;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_referee_relationship_type
    CHECK (referee_relationship_type IS NULL
      OR referee_relationship_type IN ('client', 'employer', 'project_manager', 'reviser_editor', 'peer_translator', 'other'));

-- Free-text length guards.
ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_referee_independence_note_len;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_referee_independence_note_len
    CHECK (referee_independence_note IS NULL OR char_length(referee_independence_note) <= 500);
ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_referee_role_title_len;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_referee_role_title_len
    CHECK (referee_role_title IS NULL OR char_length(referee_role_title) <= 200);
ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_referee_relationship_other_len;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_referee_relationship_other_len
    CHECK (referee_relationship_other IS NULL OR char_length(referee_relationship_other) <= 200);

COMMENT ON COLUMN cvp_application_references.referee_employment_type IS
  'Referee''s statement of whether the applicant worked full_time / part_time as a translator during the period they worked together (or unsure). Advisory input to ISO 17100 route-c (5-yr) rigor; not a hard gate.';
COMMENT ON COLUMN cvp_application_references.referee_annual_volume IS
  'Approx annual translation volume the referee observed, words/year bucket: lt_50k | 50k_150k | 150k_500k | gt_500k | unsure.';
COMMENT ON COLUMN cvp_application_references.reference_confirmed_end_year IS
  'Last year the referee worked with the applicant. NULL when reference_relationship_ongoing=true or not provided. Bounds route-c duration with reference_confirmed_start_year.';
COMMENT ON COLUMN cvp_application_references.reference_relationship_ongoing IS
  'Referee says they still work with the applicant (so there is no end year).';
COMMENT ON COLUMN cvp_application_references.referee_independent IS
  'Referee attests they are not a relative and have no financial stake in the application. false => credibility red flag.';
COMMENT ON COLUMN cvp_application_references.referee_independence_note IS
  'Optional free text when the referee cannot fully attest independence.';
COMMENT ON COLUMN cvp_application_references.referee_relationship_type IS
  'How the referee worked with the applicant: client | employer | project_manager | reviser_editor | peer_translator | other. Referee-stated (vs the applicant-entered reference_relationship free text).';
COMMENT ON COLUMN cvp_application_references.referee_role_title IS 'Referee''s own job title / role, as they state it.';
COMMENT ON COLUMN cvp_application_references.referee_relationship_other IS 'Free text when referee_relationship_type = other.';
COMMENT ON COLUMN cvp_application_references.reference_confirmed_domains IS
  'Domains the referee confirmed. As of 2026-06-23 these are the applicant''s CLAIMED approval-domain codes (cvp_applications.domains_offered, 23-code set); rows before that date hold the legacy 8-bucket codes.';