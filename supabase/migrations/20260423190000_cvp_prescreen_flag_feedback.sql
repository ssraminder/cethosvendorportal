-- CVP prescreen flag feedback
-- Purpose: capture staff verdict + notes per AI-generated red/green flag.
-- Drives a future learning loop where common "invalid" patterns are fed back
-- into the cvp-prescreen-application system prompt as guidance.
-- Date: 2026-04-23

CREATE TABLE IF NOT EXISTS cvp_prescreen_flag_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES cvp_applications(id) ON DELETE CASCADE,
  flag_kind text NOT NULL CHECK (flag_kind IN ('red_flag', 'green_flag')),
  flag_text text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('valid', 'invalid', 'low_weight', 'context_dependent')),
  staff_notes text,
  prescreen_at timestamptz,
  prompt_version text,
  staff_user_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, flag_kind, flag_text)
);

CREATE INDEX IF NOT EXISTS idx_cvp_flag_feedback_application
  ON cvp_prescreen_flag_feedback (application_id);
CREATE INDEX IF NOT EXISTS idx_cvp_flag_feedback_verdict
  ON cvp_prescreen_flag_feedback (verdict);
CREATE INDEX IF NOT EXISTS idx_cvp_flag_feedback_kind_verdict
  ON cvp_prescreen_flag_feedback (flag_kind, verdict);

COMMENT ON TABLE cvp_prescreen_flag_feedback IS
  'Staff verdict + rationale on each AI-generated red/green flag. Source data for the prescreen learning loop.';
COMMENT ON COLUMN cvp_prescreen_flag_feedback.flag_kind IS
  'red_flag = AI-emitted red_flags[]; green_flag = AI-emitted cv_unique_signals[]';
COMMENT ON COLUMN cvp_prescreen_flag_feedback.verdict IS
  'valid = real concern; invalid = should not have been flagged; low_weight = real but minor; context_dependent = depends on situation';

-- updated_at trigger (reuse existing fn from 011 migration)
DROP TRIGGER IF EXISTS trg_cvp_flag_feedback_updated_at ON cvp_prescreen_flag_feedback;
CREATE TRIGGER trg_cvp_flag_feedback_updated_at
  BEFORE UPDATE ON cvp_prescreen_flag_feedback
  FOR EACH ROW EXECUTE FUNCTION cvp_training_set_updated_at();

-- RLS: staff can read all + insert/update their own
ALTER TABLE cvp_prescreen_flag_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read all flag feedback"
  ON cvp_prescreen_flag_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "Staff can insert flag feedback"
  ON cvp_prescreen_flag_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "Staff can update flag feedback"
  ON cvp_prescreen_flag_feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "Staff can delete flag feedback"
  ON cvp_prescreen_flag_feedback FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );
