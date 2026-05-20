-- cvp_application_ai_reassessments
--
-- Records each AI reassessment of an application after references are in.
-- Multiple runs are allowed (staff can re-run if context changes); the
-- latest row by created_at is the active suggestion shown in the admin UI.
--
-- The output_json shape (validated client-side, not by the DB) is:
--   {
--     verdict: 'approve' | 'reject' | 'waitlist',
--     verdict_confidence: 'high' | 'medium' | 'low',
--     suggested_combination_ids: [<uuid>, ...],         -- subset of cvp_test_combinations on this app
--     domain_evidence: { [combination_id]: '...one-line rationale...' },
--     rationale: '...short paragraph for the staff summary card...',
--     concerns: ['...', '...'],                          -- optional flags
--     follow_ups: ['...', '...']                         -- optional next-step suggestions
--   }
--
-- input_json captures the snapshot fed to Claude so we can audit
-- reproducibility (re-run the same prompt later if needed).

CREATE TABLE IF NOT EXISTS cvp_application_ai_reassessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES cvp_applications(id) ON DELETE CASCADE,
  model           text NOT NULL,
  input_json      jsonb NOT NULL,
  output_json     jsonb,
  raw_output      text,
  ai_error        text,
  triggered_by    uuid REFERENCES staff_users(id),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cvp_application_ai_reassessments_application_idx
  ON cvp_application_ai_reassessments (application_id, created_at DESC);

ALTER TABLE cvp_application_ai_reassessments ENABLE ROW LEVEL SECURITY;

-- Staff-only read; writes happen via the service-role edge function, so no
-- INSERT/UPDATE policy is needed for end users.
CREATE POLICY "Staff can read reassessments"
  ON cvp_application_ai_reassessments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users s
      WHERE s.auth_user_id = auth.uid() AND s.is_active = TRUE
    )
  );
