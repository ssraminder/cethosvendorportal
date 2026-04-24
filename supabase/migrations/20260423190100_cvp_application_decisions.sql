-- CVP application decisions
-- Purpose: append-only history of every staff action taken on an application
-- (approve / reject / waitlist / request_info). Captures the raw staff notes,
-- the AI's interpretation/output, and the message that was actually sent to
-- the applicant. Source data for the decision-quality learning loop.
-- Date: 2026-04-23

CREATE TABLE IF NOT EXISTS cvp_application_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES cvp_applications(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'waitlisted', 'info_requested')),
  staff_notes text,
  ai_processed boolean NOT NULL DEFAULT FALSE,
  ai_input_prompt text,
  ai_output text,
  ai_model text,
  ai_error text,
  message_sent_subject text,
  message_sent_body text,
  staff_user_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cvp_app_decisions_application
  ON cvp_application_decisions (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cvp_app_decisions_action
  ON cvp_application_decisions (action);

COMMENT ON TABLE cvp_application_decisions IS
  'History of every staff decision on an application, including raw staff notes, AI processing, and the actual outbound message.';

ALTER TABLE cvp_application_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read application decisions"
  ON cvp_application_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Service role only writes via edge functions; no INSERT policy for authenticated.
