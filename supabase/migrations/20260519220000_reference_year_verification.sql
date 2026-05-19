-- Reference year-verification: applicant declares the (approximate) year
-- they started working with each reference; reference confirms or corrects
-- on the questionnaire. Mismatches surface as red-flag signal alongside
-- the MCQ responses.
--
-- Tolerance buckets (computed at submit time in cvp-submit-reference-feedback):
--   matches    : abs(applicant - reference) <= 1
--   close      : abs(applicant - reference) in 2..3
--   disagrees  : abs(applicant - reference) >= 4
--   cant_recall: reference picked "I can't recall"
--   NULL       : applicant chose "I don't remember" or didn't answer

ALTER TABLE cvp_application_references
  ADD COLUMN IF NOT EXISTS applicant_stated_start_year  smallint,
  ADD COLUMN IF NOT EXISTS applicant_year_unknown       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference_confirmed_start_year smallint,
  ADD COLUMN IF NOT EXISTS year_verification             text;

ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_applicant_stated_start_year_range;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_applicant_stated_start_year_range
    CHECK (
      applicant_stated_start_year IS NULL
      OR (applicant_stated_start_year BETWEEN 1980 AND 2100)
    );

ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_reference_confirmed_start_year_range;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_reference_confirmed_start_year_range
    CHECK (
      reference_confirmed_start_year IS NULL
      OR (reference_confirmed_start_year BETWEEN 1980 AND 2100)
    );

ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_year_verification_value;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_year_verification_value
    CHECK (
      year_verification IS NULL
      OR year_verification IN ('matches', 'close', 'disagrees', 'cant_recall')
    );

COMMENT ON COLUMN cvp_application_references.applicant_stated_start_year IS
  'Approximate year the applicant said they began working with this reference. NULL when applicant marked applicant_year_unknown=true or the row predates the year-verification feature (2026-05-19).';
COMMENT ON COLUMN cvp_application_references.applicant_year_unknown IS
  'Applicant ticked "I don''t remember" on the reference contacts form. When true, applicant_stated_start_year is NULL and no verification is asked of the reference.';
COMMENT ON COLUMN cvp_application_references.reference_confirmed_start_year IS
  'The year the reference selected on the questionnaire when confirming/correcting the applicant''s stated year. NULL when reference picked "I can''t recall" or when applicant_year_unknown=true (no question shown).';
COMMENT ON COLUMN cvp_application_references.year_verification IS
  'Computed at feedback-submit time. matches: years within 1; close: 2-3 apart; disagrees: 4+ apart; cant_recall: reference said so; NULL: applicant didn''t provide a year.';

CREATE INDEX IF NOT EXISTS idx_cvp_application_references_year_verification
  ON cvp_application_references (year_verification)
  WHERE year_verification IS NOT NULL;
