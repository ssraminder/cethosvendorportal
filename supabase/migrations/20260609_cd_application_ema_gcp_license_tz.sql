-- CD application form nice-to-haves (PR 2 of 3):
--   * EMA COA familiarity (mirrors ISPOR/FDA)
--   * Concept-elicitation years (distinct skill from CD)
--   * Special populations (pediatric/elderly/cognitively impaired/etc.)
--   * GCP training (boolean + year)
--   * Professional license details (clinician-style CD paths)
--   * Time zone (IANA)

ALTER TABLE public.cvp_applications
  ADD COLUMN IF NOT EXISTS cog_ema_familiarity varchar,
  ADD COLUMN IF NOT EXISTS cog_concept_elicitation_years varchar,
  ADD COLUMN IF NOT EXISTS cog_special_populations text[],
  ADD COLUMN IF NOT EXISTS cog_gcp_trained boolean,
  ADD COLUMN IF NOT EXISTS cog_gcp_year smallint,
  ADD COLUMN IF NOT EXISTS cog_license_type varchar,
  ADD COLUMN IF NOT EXISTS cog_license_jurisdiction varchar,
  ADD COLUMN IF NOT EXISTS cog_license_number varchar,
  ADD COLUMN IF NOT EXISTS cog_license_active boolean,
  ADD COLUMN IF NOT EXISTS cog_timezone varchar;

COMMENT ON COLUMN public.cvp_applications.cog_ema_familiarity IS
  'EMA COA guidance familiarity (yes / no / partially).';
COMMENT ON COLUMN public.cvp_applications.cog_concept_elicitation_years IS
  'Years of concept-elicitation experience (bracketed; distinct from cognitive debriefing).';
COMMENT ON COLUMN public.cvp_applications.cog_special_populations IS
  'Special populations the applicant has worked with: pediatric, elderly, cognitively_impaired, rare_disease, immigrant_refugee, lgbtq, none.';
COMMENT ON COLUMN public.cvp_applications.cog_gcp_trained IS
  'Applicant has completed GCP (Good Clinical Practice) training.';
COMMENT ON COLUMN public.cvp_applications.cog_gcp_year IS
  'Year of most recent GCP training (only if cog_gcp_trained=true).';
COMMENT ON COLUMN public.cvp_applications.cog_license_type IS
  'Professional license type (RN, MD, PsyD, etc.) — optional.';
COMMENT ON COLUMN public.cvp_applications.cog_license_jurisdiction IS
  'Issuing jurisdiction for the professional license (state/province/country).';
COMMENT ON COLUMN public.cvp_applications.cog_license_number IS
  'Professional license number.';
COMMENT ON COLUMN public.cvp_applications.cog_license_active IS
  'License currently active in good standing.';
COMMENT ON COLUMN public.cvp_applications.cog_timezone IS
  'IANA time zone for scheduling interviews (e.g. America/New_York).';
