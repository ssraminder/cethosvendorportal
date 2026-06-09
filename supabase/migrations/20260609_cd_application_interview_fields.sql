-- Add cognitive-debriefing fields the schema was missing:
--   cog_interviews_conducted: bracketed count of CD interviews led
--   cog_conducts_direct_patient_interviews: confirms patient-facing work
--   cog_interview_modes: in-person / telephone / video (multiselect)
--   cog_ecoa_platforms: remote eCOA platforms the applicant has worked with
--
-- cog_rate_expectation, cog_rate_currency, cv_storage_path, cog_sample_report_path
-- already exist; the application form was just not wiring them.

ALTER TABLE public.cvp_applications
  ADD COLUMN IF NOT EXISTS cog_interviews_conducted varchar,
  ADD COLUMN IF NOT EXISTS cog_conducts_direct_patient_interviews boolean,
  ADD COLUMN IF NOT EXISTS cog_interview_modes text[],
  ADD COLUMN IF NOT EXISTS cog_ecoa_platforms text[],
  ADD COLUMN IF NOT EXISTS cog_additional_languages uuid[];

COMMENT ON COLUMN public.cvp_applications.cog_interviews_conducted IS
  'Bracketed count of cognitive-debriefing interviews the applicant has personally conducted (e.g. 0, 1-10, 11-50, 51-200, 200+).';
COMMENT ON COLUMN public.cvp_applications.cog_conducts_direct_patient_interviews IS
  'True if the applicant has personally interviewed patients (vs. desk-only linguistic validation work).';
COMMENT ON COLUMN public.cvp_applications.cog_interview_modes IS
  'Interview delivery modes the applicant offers: in_person, telephone, video.';
COMMENT ON COLUMN public.cvp_applications.cog_ecoa_platforms IS
  'Remote eCOA platforms the applicant has hands-on experience with (Signant, Clario/ERT, Medidata, ...).';
