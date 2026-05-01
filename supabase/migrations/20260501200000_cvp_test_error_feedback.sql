-- cvp_test_error_feedback
--
-- Per-error feedback loop. After a test is graded, the applicant gets a
-- magic-link page where they can Accept or Reject each individual finding
-- the AI flagged, and (if rejecting) explain why in English.
--
-- Structure mirrors a 4-tier lifecycle:
--   Tier 0 — collection (applicant submits)
--   Tier 1 — LLM auto-triage of disagreements (deferred to PR 2)
--   Tier 2 — paid human review when auto-triage confidence is low (PR 3)
--   Tier 3 — staff folds confirmed corrections into next grader prompt (PR 4)
--
-- This migration creates the table with all 4 tiers' columns up front so
-- each tier ships as code only, no further migrations.

CREATE TABLE IF NOT EXISTS cvp_test_error_feedback (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id            uuid NOT NULL REFERENCES cvp_test_submissions(id) ON DELETE CASCADE,
  combination_id           uuid NOT NULL REFERENCES cvp_test_combinations(id) ON DELETE CASCADE,

  -- Frozen error snapshot — survives re-grades that may renumber findings.
  error_index              integer NOT NULL,
  error_snapshot           jsonb NOT NULL,

  -- Tier 0: applicant response
  applicant_response       text NOT NULL CHECK (applicant_response IN ('accept', 'reject')),
  applicant_reason         text,
  applicant_submitted_at   timestamptz NOT NULL DEFAULT now(),

  -- Round tracking — automated clarification loop kicks in when reason is
  -- vague. Up to 3 automated email rounds before HITL escalation.
  clarification_rounds     integer NOT NULL DEFAULT 0,
  clarification_history    jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Tier 1: LLM auto-triage (filled by cvp-triage-test-feedback in PR 2)
  auto_triage_verdict      text CHECK (auto_triage_verdict IN ('clear', 'needs_clarification', 'applicant_correct', 'grader_correct', 'partial', 'unclear')),
  auto_triage_confidence   numeric(5,2),
  auto_triage_reasoning    text,
  auto_triage_model        text,
  auto_triage_at           timestamptz,

  -- Tier 2: human-in-the-loop review (filled when auto-triage escalates)
  hitl_status              text NOT NULL DEFAULT 'not_needed'
                            CHECK (hitl_status IN ('not_needed', 'queued', 'in_progress', 'resolved', 'dismissed')),
  hitl_job_id              uuid, -- link to TM-Cethos test review job
  hitl_verdict             text CHECK (hitl_verdict IN ('applicant_correct', 'grader_correct', 'partial')),
  hitl_notes               text,
  hitl_reviewed_by         uuid,
  hitl_reviewed_at         timestamptz,

  -- Tier 3: prompt-tuning intake
  feeds_next_prompt        boolean NOT NULL DEFAULT false,
  prompt_version_consumed  text,

  -- Lifecycle
  expires_at               timestamptz NOT NULL DEFAULT (now() + interval '4 days'),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (submission_id, error_index)
);

CREATE INDEX IF NOT EXISTS idx_cvp_test_error_feedback_submission
  ON cvp_test_error_feedback (submission_id);
CREATE INDEX IF NOT EXISTS idx_cvp_test_error_feedback_combination
  ON cvp_test_error_feedback (combination_id);
CREATE INDEX IF NOT EXISTS idx_cvp_test_error_feedback_hitl_queue
  ON cvp_test_error_feedback (hitl_status, applicant_submitted_at)
  WHERE hitl_status IN ('queued', 'in_progress');

-- Tracks the per-submission-level state of the feedback round (separate
-- from the per-error rows above). Stamped when V12 goes out, expires 4
-- days later, advances when applicant submits at least one response.
CREATE TABLE IF NOT EXISTS cvp_test_feedback_rounds (
  submission_id            uuid PRIMARY KEY REFERENCES cvp_test_submissions(id) ON DELETE CASCADE,
  combination_id           uuid NOT NULL REFERENCES cvp_test_combinations(id) ON DELETE CASCADE,
  token                    text NOT NULL UNIQUE,

  v12_sent_at              timestamptz NOT NULL DEFAULT now(),
  reminder_sent_at         timestamptz,
  applicant_first_view_at  timestamptz,
  applicant_submitted_at   timestamptz,

  expires_at               timestamptz NOT NULL DEFAULT (now() + interval '4 days'),
  staff_skip               boolean NOT NULL DEFAULT false, -- "don't send" override
  status                   text NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('sent', 'opened', 'submitted', 'expired', 'skipped')),

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cvp_test_feedback_rounds_token
  ON cvp_test_feedback_rounds (token);

-- updated_at triggers
CREATE OR REPLACE FUNCTION cvp_test_error_feedback_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cvp_test_error_feedback_touch ON cvp_test_error_feedback;
CREATE TRIGGER trg_cvp_test_error_feedback_touch
  BEFORE UPDATE ON cvp_test_error_feedback
  FOR EACH ROW EXECUTE FUNCTION cvp_test_error_feedback_touch();

DROP TRIGGER IF EXISTS trg_cvp_test_feedback_rounds_touch ON cvp_test_feedback_rounds;
CREATE TRIGGER trg_cvp_test_feedback_rounds_touch
  BEFORE UPDATE ON cvp_test_feedback_rounds
  FOR EACH ROW EXECUTE FUNCTION cvp_test_error_feedback_touch();

COMMENT ON TABLE cvp_test_error_feedback IS
  'Applicant-facing per-error accept/reject feedback on AI grading. Drives a 4-tier lifecycle: collection → LLM auto-triage → HITL review → prompt-tuning intake.';
COMMENT ON TABLE cvp_test_feedback_rounds IS
  'Per-submission feedback round state — tracks V12 send, expiry, applicant engagement.';
