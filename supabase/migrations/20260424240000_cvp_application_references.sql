-- ============================================================================
-- Phase E — references system
-- ============================================================================
--
-- Two-step model:
--   1. Staff opens Recruitment → "Request references" → V18 sent to applicant
--      with a `request_token` link.
--   2. Applicant visits /references/:request_token → enters 1-3 reference
--      contacts → V19 sent per reference with a `feedback_token` link.
--   3. Reference visits /reference-feedback/:feedback_token → fills short
--      form → V20 thank-you ack to reference, V21 summary to staff.
--   4. Opus analyses each reference response and writes ai_analysis.
--
-- Schema:
--   cvp_application_reference_requests — one row per (application × staff
--     request), holds the applicant-facing request_token.
--   cvp_application_references — one row per individual reference, holds
--     the referee-facing feedback_token + their submission + ai_analysis.
--
-- RLS: service_role only. All public access goes through edge functions
-- that validate the appropriate token.
-- ============================================================================

BEGIN;

-- Top-level request — created by staff via cvp-request-references.
CREATE TABLE IF NOT EXISTS cvp_application_reference_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES cvp_applications(id) ON DELETE CASCADE,
  request_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  request_token_expires_at timestamptz NOT NULL,  -- typically now() + 14 days
  staff_id uuid,                                  -- who initiated
  staff_message text,                             -- optional message to applicant
  ai_drafted_message text,                        -- Opus draft used in V18
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'contacts_received', 'expired', 'cancelled')),
  contacts_submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cvp_aref_requests_app_idx
  ON cvp_application_reference_requests(application_id);
CREATE INDEX IF NOT EXISTS cvp_aref_requests_token_idx
  ON cvp_application_reference_requests(request_token);

-- Individual reference — one row per person the applicant lists. Created
-- when applicant submits the contacts form.
CREATE TABLE IF NOT EXISTS cvp_application_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES cvp_application_reference_requests(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES cvp_applications(id) ON DELETE CASCADE,

  -- Who this reference is.
  reference_name text NOT NULL,
  reference_email text NOT NULL,
  reference_company text,
  reference_relationship text,        -- "former PM", "client of 5y", etc.

  -- Reference-facing token + submission.
  feedback_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  feedback_token_expires_at timestamptz NOT NULL,
  feedback_text text,                 -- free-text answer to "describe applicant's translation work"
  feedback_rating int                 -- 1-5 overall recommend
    CHECK (feedback_rating IS NULL OR feedback_rating BETWEEN 1 AND 5),
  feedback_received_at timestamptz,
  declined_at timestamptz,            -- reference clicked "I don't recall this person"
  decline_reason text,

  -- AI analysis of the reference's response.
  ai_analysis jsonb,                  -- {sentiment, themes[], red_flags[], strength_score, summary}
  ai_analysis_at timestamptz,
  ai_analysis_error text,

  -- Audit / lifecycle.
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'received', 'declined', 'expired', 'invalid')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cvp_arefs_application_idx
  ON cvp_application_references(application_id);
CREATE INDEX IF NOT EXISTS cvp_arefs_request_idx
  ON cvp_application_references(request_id);
CREATE INDEX IF NOT EXISTS cvp_arefs_token_idx
  ON cvp_application_references(feedback_token);
CREATE INDEX IF NOT EXISTS cvp_arefs_status_idx
  ON cvp_application_references(status)
  WHERE status IN ('requested', 'received');

COMMENT ON TABLE cvp_application_reference_requests IS
  'Top-level reference request. Staff invokes via cvp-request-references; applicant fills via /references/:request_token. One per (application × time staff hits Request).';
COMMENT ON TABLE cvp_application_references IS
  'One row per individual reference. Created when applicant submits the contacts form. The reference fills feedback via /reference-feedback/:feedback_token. Opus analyses + ai_analysis is stored here.';

-- ---- updated_at triggers ----
CREATE OR REPLACE FUNCTION cvp_arefs_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cvp_aref_requests_touch ON cvp_application_reference_requests;
CREATE TRIGGER cvp_aref_requests_touch
  BEFORE UPDATE ON cvp_application_reference_requests
  FOR EACH ROW EXECUTE FUNCTION cvp_arefs_touch_updated_at();

DROP TRIGGER IF EXISTS cvp_arefs_touch ON cvp_application_references;
CREATE TRIGGER cvp_arefs_touch
  BEFORE UPDATE ON cvp_application_references
  FOR EACH ROW EXECUTE FUNCTION cvp_arefs_touch_updated_at();

-- ---- RLS: service_role only ----
ALTER TABLE cvp_application_reference_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_application_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aref_req_service_role ON cvp_application_reference_requests;
CREATE POLICY aref_req_service_role
  ON cvp_application_reference_requests FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS aref_service_role ON cvp_application_references;
CREATE POLICY aref_service_role
  ON cvp_application_references FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Admin staff (authenticated) can read both tables to render the
-- References section in RecruitmentDetail. Writes go through edge
-- functions for token-validated access.
DROP POLICY IF EXISTS aref_req_staff_read ON cvp_application_reference_requests;
CREATE POLICY aref_req_staff_read
  ON cvp_application_reference_requests FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS aref_staff_read ON cvp_application_references;
CREATE POLICY aref_staff_read
  ON cvp_application_references FOR SELECT
  TO authenticated USING (true);

COMMIT;
