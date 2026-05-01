-- Test invitation reminders: 3 reminders at +3 / +6 / +9 days from
-- created_at, expiry at +10 days. Replaces the legacy day2/day3/day7
-- cadence. Old columns are kept as audit history but no longer written.

ALTER TABLE cvp_test_submissions
  ADD COLUMN IF NOT EXISTS reminder_1_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_3_sent_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_cvp_test_submissions_reminder_1_due
  ON cvp_test_submissions (created_at)
  WHERE reminder_1_sent_at IS NULL
    AND status IN ('sent', 'viewed', 'draft_saved');

CREATE INDEX IF NOT EXISTS idx_cvp_test_submissions_reminder_2_due
  ON cvp_test_submissions (created_at)
  WHERE reminder_2_sent_at IS NULL
    AND reminder_1_sent_at IS NOT NULL
    AND status IN ('sent', 'viewed', 'draft_saved');

CREATE INDEX IF NOT EXISTS idx_cvp_test_submissions_reminder_3_due
  ON cvp_test_submissions (created_at)
  WHERE reminder_3_sent_at IS NULL
    AND reminder_2_sent_at IS NOT NULL
    AND status IN ('sent', 'viewed', 'draft_saved');

COMMENT ON COLUMN cvp_test_submissions.reminder_1_sent_at IS
  'First reminder fired (typically +3 days from created_at).';
COMMENT ON COLUMN cvp_test_submissions.reminder_2_sent_at IS
  'Second reminder fired (typically +6 days from created_at).';
COMMENT ON COLUMN cvp_test_submissions.reminder_3_sent_at IS
  'Third and final reminder fired (typically +9 days from created_at).';

-- Grading reminders for admins/graders who haven't completed AI grading
-- (typically because cvp-assess-test fell back to staff_review). Cron
-- fires up to 3 reminders at +3 / +6 / +9 days from the submission's
-- assessed_at, then archives.
CREATE TABLE IF NOT EXISTS cvp_grading_reminders_sent (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combination_id  uuid NOT NULL REFERENCES cvp_test_combinations(id) ON DELETE CASCADE,
  reminder_index  integer NOT NULL CHECK (reminder_index BETWEEN 1 AND 3),
  sent_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (combination_id, reminder_index)
);

CREATE INDEX IF NOT EXISTS idx_cvp_grading_reminders_sent_combo
  ON cvp_grading_reminders_sent (combination_id);

COMMENT ON TABLE cvp_grading_reminders_sent IS
  'Audit log for V23 grading reminders sent to admin/grader staff. One row per (combination, reminder_index).';
