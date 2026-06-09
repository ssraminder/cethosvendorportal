-- PR A1b: refactor agency applications to a single multi-service form.
-- Drops the role-eligibility CHECK that forced agency rows to a specific
-- individual role; agencies now apply once and declare which services
-- they cover via agency_services_offered.

ALTER TABLE public.cvp_applications
  DROP CONSTRAINT IF EXISTS cvp_applications_agency_role_check;

-- Widen role_type to include 'agency' as a valid value.
ALTER TABLE public.cvp_applications
  DROP CONSTRAINT IF EXISTS cvp_applications_role_type_check;
ALTER TABLE public.cvp_applications
  ADD CONSTRAINT cvp_applications_role_type_check
  CHECK (role_type IN (
    'translator',
    'cognitive_debriefing',
    'interpreter',
    'transcriber',
    'clinician_reviewer',
    'agency'
  ));

ALTER TABLE public.cvp_applications
  ADD COLUMN IF NOT EXISTS agency_services_offered text[];

-- Cross-check: when applicant_type='agency', role_type MUST be 'agency'.
ALTER TABLE public.cvp_applications
  ADD CONSTRAINT cvp_applications_applicant_role_consistency_check
  CHECK (
    (applicant_type = 'individual' AND role_type <> 'agency')
    OR (applicant_type = 'agency' AND role_type = 'agency')
  );

COMMENT ON COLUMN public.cvp_applications.agency_services_offered IS
  'Services the agency declares at application time: subset of {translation, interpretation, transcription}.';
