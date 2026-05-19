-- Reference domain-verification: applicant declares which of 8 standard
-- domains they worked with each reference in. Reference confirms by ticking
-- the ones that actually match, optionally adding a free-text "Other" entry.
-- Server-computed verification bucket surfaces disjoint domain claims as a
-- red flag in the Claude analysis prompt.
--
-- Codes (snake_case, lowercase, mirrored in apps/recruitment/src/data/referenceMcqs.ts):
--   legal | medical_pharma | marketing_transcreation | technical_it
--   financial_banking | literary_publishing | government_ngo | other
--
-- Verification buckets (computed at feedback-submit time):
--   matches    : reference confirmed exactly the same set as applicant stated
--   partial    : non-empty intersection but not equal (typical — reference
--                only saw some of the work)
--   disjoint   : zero overlap → red flag
--   cant_recall: reference picked "I can't recall the domains"
--   NULL       : applicant didn't declare any domains

ALTER TABLE cvp_application_references
  ADD COLUMN IF NOT EXISTS applicant_stated_domains       text[],
  ADD COLUMN IF NOT EXISTS applicant_other_domain_text    text,
  ADD COLUMN IF NOT EXISTS applicant_domains_unknown      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference_confirmed_domains    text[],
  ADD COLUMN IF NOT EXISTS reference_other_domain_text    text,
  ADD COLUMN IF NOT EXISTS domain_verification            text;

ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_domain_verification_value;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_domain_verification_value
    CHECK (
      domain_verification IS NULL
      OR domain_verification IN ('matches', 'partial', 'disjoint', 'cant_recall')
    );

-- Lightweight sanity: applicant_other_domain_text only meaningful when
-- applicant_stated_domains contains 'other'. We don't enforce this in SQL —
-- the edge function normalises — but the CHECK on length keeps junk out.
ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_applicant_other_domain_text_len;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_applicant_other_domain_text_len
    CHECK (applicant_other_domain_text IS NULL OR char_length(applicant_other_domain_text) <= 200);

ALTER TABLE cvp_application_references
  DROP CONSTRAINT IF EXISTS chk_reference_other_domain_text_len;
ALTER TABLE cvp_application_references
  ADD CONSTRAINT chk_reference_other_domain_text_len
    CHECK (reference_other_domain_text IS NULL OR char_length(reference_other_domain_text) <= 200);

COMMENT ON COLUMN cvp_application_references.applicant_stated_domains IS
  'Domains the applicant said they worked with this reference in (codes from the 8-option enum). NULL when applicant_domains_unknown=true OR the row predates 2026-05-19.';
COMMENT ON COLUMN cvp_application_references.applicant_other_domain_text IS
  'Free-text custom domain when applicant_stated_domains contains the ''other'' code. NULL otherwise.';
COMMENT ON COLUMN cvp_application_references.applicant_domains_unknown IS
  'Applicant ticked "I don''t remember" on the domain question. When true, applicant_stated_domains is NULL and no domain verification is asked of the reference.';
COMMENT ON COLUMN cvp_application_references.reference_confirmed_domains IS
  'Subset of applicant_stated_domains the reference confirmed by ticking the matching checkboxes.';
COMMENT ON COLUMN cvp_application_references.reference_other_domain_text IS
  'Free text the reference entered when they say they worked on something else.';
COMMENT ON COLUMN cvp_application_references.domain_verification IS
  'Computed at feedback-submit. matches: reference set == applicant set; partial: non-empty intersection; disjoint: zero overlap; cant_recall: reference opted out; NULL: applicant did not declare.';

CREATE INDEX IF NOT EXISTS idx_cvp_application_references_domain_verification
  ON cvp_application_references (domain_verification)
  WHERE domain_verification IS NOT NULL;
