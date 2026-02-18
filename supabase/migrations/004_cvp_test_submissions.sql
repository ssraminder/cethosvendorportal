-- CVP Test Submissions
-- Purpose: One row per test token issued, tracks lifecycle from sending to assessment
-- Dependencies: cvp_test_combinations, cvp_test_library, cvp_applications
-- Date: 2026-02-18

CREATE TABLE IF NOT EXISTS cvp_test_submissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combination_id          UUID NOT NULL REFERENCES cvp_test_combinations(id) ON DELETE CASCADE,
  test_id                 UUID NOT NULL REFERENCES cvp_test_library(id),
  application_id          UUID NOT NULL REFERENCES cvp_applications(id),

  -- Access token
  token                   UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_expires_at        TIMESTAMPTZ NOT NULL,

  -- Lifecycle status
  status                  VARCHAR(30) NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent',
    'viewed',
    'draft_saved',
    'submitted',
    'assessed',
    'expired'
  )),

  -- Submission
  submitted_file_path     TEXT,
  submitted_notes         TEXT,
  submitted_at            TIMESTAMPTZ,

  -- Draft auto-save
  draft_content           TEXT,
  draft_last_saved_at     TIMESTAMPTZ,

  -- AI assessment
  ai_assessment_score     INTEGER CHECK (ai_assessment_score BETWEEN 0 AND 100),
  ai_assessment_result    JSONB,
  ai_assessed_at          TIMESTAMPTZ,

  -- Follow-up email tracking
  reminder_day2_sent_at   TIMESTAMPTZ,
  reminder_day3_sent_at   TIMESTAMPTZ,
  reminder_day7_sent_at   TIMESTAMPTZ,

  -- Token first viewed
  first_viewed_at         TIMESTAMPTZ,
  view_count              INTEGER NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvp_test_submissions_token ON cvp_test_submissions(token);
CREATE INDEX IF NOT EXISTS idx_cvp_test_submissions_application ON cvp_test_submissions(application_id);
CREATE INDEX IF NOT EXISTS idx_cvp_test_submissions_status ON cvp_test_submissions(status);
CREATE INDEX IF NOT EXISTS idx_cvp_test_submissions_expires ON cvp_test_submissions(token_expires_at)
  WHERE status NOT IN ('submitted', 'assessed', 'expired');
