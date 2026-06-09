-- PR A1 of the agency-onboarding feature (Phase A):
-- Capture applicant_type + agency-specific application fields. Existing
-- individual application path is unchanged (default applicant_type='individual').
--
-- Only translator/interpreter/transcriber may apply as an agency.
-- clinician_reviewer + cognitive_debriefing stay individual-only because
-- those roles vet a specific named credentialed person.

ALTER TABLE public.cvp_applications
  ADD COLUMN IF NOT EXISTS applicant_type varchar NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS agency_business_name varchar,
  ADD COLUMN IF NOT EXISTS agency_registration_country varchar,
  ADD COLUMN IF NOT EXISTS agency_tax_id varchar,
  ADD COLUMN IF NOT EXISTS agency_company_profile_path text,
  ADD COLUMN IF NOT EXISTS agency_primary_contact_name varchar,
  ADD COLUMN IF NOT EXISTS agency_primary_contact_role varchar,
  ADD COLUMN IF NOT EXISTS agency_linguist_count integer,
  ADD COLUMN IF NOT EXISTS agency_years_operating integer,
  ADD COLUMN IF NOT EXISTS agency_language_pairs jsonb;

-- Enforce applicant_type domain + agency role eligibility at the DB level
-- so any future caller (admin imports, scripts) can't slip an agency
-- application through for a role we don't support.
ALTER TABLE public.cvp_applications
  DROP CONSTRAINT IF EXISTS cvp_applications_applicant_type_check;
ALTER TABLE public.cvp_applications
  ADD CONSTRAINT cvp_applications_applicant_type_check
  CHECK (applicant_type IN ('individual', 'agency'));

ALTER TABLE public.cvp_applications
  DROP CONSTRAINT IF EXISTS cvp_applications_agency_role_check;
ALTER TABLE public.cvp_applications
  ADD CONSTRAINT cvp_applications_agency_role_check
  CHECK (
    applicant_type = 'individual'
    OR (applicant_type = 'agency' AND role_type IN ('translator','interpreter','transcriber'))
  );

COMMENT ON COLUMN public.cvp_applications.applicant_type IS
  'Distinguishes individual freelancer applications from agency / LSP applications.';
COMMENT ON COLUMN public.cvp_applications.agency_business_name IS
  'Registered business / trading name (agency path only).';
COMMENT ON COLUMN public.cvp_applications.agency_registration_country IS
  'Country of business registration.';
COMMENT ON COLUMN public.cvp_applications.agency_tax_id IS
  'Tax or business registration ID (free-form per jurisdiction).';
COMMENT ON COLUMN public.cvp_applications.agency_company_profile_path IS
  'Storage path (cvp-applicant-cvs bucket) of the agency company-profile PDF.';
COMMENT ON COLUMN public.cvp_applications.agency_primary_contact_name IS
  'Name of the primary contact at the agency for this application.';
COMMENT ON COLUMN public.cvp_applications.agency_primary_contact_role IS
  'Role / job title of the primary contact.';
COMMENT ON COLUMN public.cvp_applications.agency_linguist_count IS
  'Approximate count of linguists on the agency roster at application time.';
COMMENT ON COLUMN public.cvp_applications.agency_years_operating IS
  'Years the agency has been operating.';
COMMENT ON COLUMN public.cvp_applications.agency_language_pairs IS
  'Approximate language-pair coverage at application time; jsonb array of {sourceLanguageId,targetLanguageId}. The roster (built post-approval) is the source of truth.';
