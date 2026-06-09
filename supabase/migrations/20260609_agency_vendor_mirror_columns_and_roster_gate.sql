-- PR A2: vendor-side mirror columns for agency applications + roster gate.
--
-- When cvp-approve-application provisions a vendor from an agency application,
-- it copies these fields off cvp_applications.agency_* so staff can see the
-- agency profile on the vendor record without joining back through the
-- application table.
--
-- roster_required gates job acceptance: an agency vendor cannot be assigned
-- a job until they have at least one roster linguist eligible for the
-- language pair + service. Enforcement lands in PR A5; the column is set
-- to TRUE for agency vendors so future enforcement is safe.

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS roster_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agency_services_offered text[],
  ADD COLUMN IF NOT EXISTS agency_registration_country text,
  ADD COLUMN IF NOT EXISTS agency_company_profile_path text,
  ADD COLUMN IF NOT EXISTS agency_linguist_count integer,
  ADD COLUMN IF NOT EXISTS agency_years_operating integer,
  ADD COLUMN IF NOT EXISTS agency_primary_contact_name text,
  ADD COLUMN IF NOT EXISTS agency_primary_contact_role text;

COMMENT ON COLUMN public.vendors.roster_required IS
  'When true, this vendor (typically an agency) cannot be assigned a job until the per-job roster-linguist picker (PR A5) resolves a qualified linguist. Default false; set to true at agency-approval time and during the 2026-06-09 backfill of historical agency-shaped vendors.';
COMMENT ON COLUMN public.vendors.agency_services_offered IS
  'Mirror of cvp_applications.agency_services_offered captured at approval time. Subset of {translation, interpretation, transcription, cognitive_debriefing}.';
COMMENT ON COLUMN public.vendors.agency_registration_country IS
  'Country of business registration declared at application time.';
COMMENT ON COLUMN public.vendors.agency_company_profile_path IS
  'Storage path (cvp-applicant-cvs bucket) of the agency company-profile PDF.';
COMMENT ON COLUMN public.vendors.agency_linguist_count IS
  'Approximate count of linguists the agency declared at application time (bracket lower-bound).';
COMMENT ON COLUMN public.vendors.agency_years_operating IS
  'Years the agency declared they have been operating at application time (bracket lower-bound).';
COMMENT ON COLUMN public.vendors.agency_primary_contact_name IS
  'Primary contact at the agency.';
COMMENT ON COLUMN public.vendors.agency_primary_contact_role IS
  'Role / job title of the primary contact at the agency.';

-- Bulk backfill: flag every existing agency-shaped vendor as roster-required.
-- 2 rows expected as of 2026-06-09. Safe to re-run.
UPDATE public.vendors
SET roster_required = true
WHERE (vendor_type = 'agency' OR contractor_type = 'business')
  AND roster_required = false;
