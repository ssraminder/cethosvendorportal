-- cvp_test_feedback_rounds: scheduled auto-send fields
--
-- Promotes the V22 feedback flow from manual smoke-test to automatic
-- delivery. After AI grading completes we INSERT a row in
-- 'pending' state with auto_send_at = now() + 24h. A cron job
-- (cvp-process-feedback-auto-send) processes due rows and flips status
-- to 'sent'. Admins can short-circuit via "Send V22 now" which sets
-- manual_send_requested_at and pulls auto_send_at to now().

ALTER TABLE cvp_test_feedback_rounds
  ADD COLUMN IF NOT EXISTS auto_send_at              timestamptz,
  ADD COLUMN IF NOT EXISTS auto_sent_at              timestamptz,
  ADD COLUMN IF NOT EXISTS manual_send_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS auto_send_attempts        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_send_last_error      text;

-- Allow the new 'pending' state for rows created at grading time but not
-- yet sent. The existing CHECK constraint must be relaxed.
ALTER TABLE cvp_test_feedback_rounds
  DROP CONSTRAINT IF EXISTS cvp_test_feedback_rounds_status_check;

ALTER TABLE cvp_test_feedback_rounds
  ADD CONSTRAINT cvp_test_feedback_rounds_status_check
  CHECK (status IN ('pending', 'sent', 'opened', 'submitted', 'expired', 'skipped'));

-- Cron lookup: due rows that haven't been sent yet and aren't skipped.
CREATE INDEX IF NOT EXISTS idx_cvp_test_feedback_rounds_auto_send_due
  ON cvp_test_feedback_rounds (auto_send_at)
  WHERE auto_sent_at IS NULL AND staff_skip = false AND status = 'pending';

COMMENT ON COLUMN cvp_test_feedback_rounds.auto_send_at IS
  'When the cron should fire V22 to the applicant. Set to now() + 24h on grading completion. NULL for legacy/manual rows.';
COMMENT ON COLUMN cvp_test_feedback_rounds.auto_sent_at IS
  'When the cron actually sent V22. NULL until the cron picks it up.';
COMMENT ON COLUMN cvp_test_feedback_rounds.manual_send_requested_at IS
  'Set by admin clicking "Send V22 now" — pulls auto_send_at forward to now().';
