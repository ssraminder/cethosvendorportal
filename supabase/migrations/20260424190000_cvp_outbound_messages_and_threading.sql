-- Phase C: conversation threading + reply processing
-- Captures every outbound vendor-facing email (with Mailgun Message-Id) so
-- inbound replies can be linked back to the specific outbound + application.
-- Inbound emails gain fields for thread linkage, AI analysis, and staff
-- acknowledgement.

-- ============================================================
-- cvp_outbound_messages — log every decision-driven outbound
-- ============================================================
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- Ensure cvp_inbound_emails + do_not_contact exist (migration 014 may have
-- been baselined-as-applied without the SQL running; idempotent catch-up).
-- ============================================================
ALTER TABLE cvp_applications
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact_source text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cvp_applications_dnc_source_check') THEN
    ALTER TABLE cvp_applications
      ADD CONSTRAINT cvp_applications_dnc_source_check
      CHECK (do_not_contact_source IS NULL OR do_not_contact_source IN ('inbound_email', 'staff', 'admin_ui'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cvp_applications_dnc
  ON cvp_applications (email) WHERE do_not_contact = TRUE;

CREATE TABLE IF NOT EXISTS cvp_inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  from_email citext,
  from_name text,
  to_email citext,
  subject text,
  body_plain text,
  body_html text,
  stripped_text text,
  message_id text,
  in_reply_to text,
  references_header text,
  matched_application_id uuid REFERENCES cvp_applications(id) ON DELETE SET NULL,
  classified_intent text CHECK (
    classified_intent IS NULL
    OR classified_intent IN ('unsubscribe', 'other', 'unmatched', 'error', 'reply_to_outbound')
  ),
  ai_classification jsonb,
  action_taken text CHECK (
    action_taken IS NULL
    OR action_taken IN (
      'do_not_contact_set',
      'auto_reply_sent',
      'auto_reply_failed',
      'noop',
      'threaded_received'
    )
  ),
  auto_reply_sent_at timestamptz,
  raw_payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_cvp_inbound_emails_received ON cvp_inbound_emails (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_cvp_inbound_emails_from ON cvp_inbound_emails (from_email);
CREATE INDEX IF NOT EXISTS idx_cvp_inbound_emails_application
  ON cvp_inbound_emails (matched_application_id) WHERE matched_application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cvp_inbound_emails_message_id
  ON cvp_inbound_emails (message_id) WHERE message_id IS NOT NULL;

ALTER TABLE cvp_inbound_emails ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cvp_inbound_emails' AND policyname = 'Staff can read inbound emails'
  ) THEN
    CREATE POLICY "Staff can read inbound emails"
      ON cvp_inbound_emails FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE));
  END IF;
END $$;

-- Relax the check constraint to accept the new intent + action values.
ALTER TABLE cvp_inbound_emails DROP CONSTRAINT IF EXISTS cvp_inbound_emails_classified_intent_check;
ALTER TABLE cvp_inbound_emails ADD CONSTRAINT cvp_inbound_emails_classified_intent_check
  CHECK (classified_intent IS NULL OR classified_intent IN ('unsubscribe','other','unmatched','error','reply_to_outbound'));
ALTER TABLE cvp_inbound_emails DROP CONSTRAINT IF EXISTS cvp_inbound_emails_action_taken_check;
ALTER TABLE cvp_inbound_emails ADD CONSTRAINT cvp_inbound_emails_action_taken_check
  CHECK (action_taken IS NULL OR action_taken IN ('do_not_contact_set','auto_reply_sent','auto_reply_failed','noop','threaded_received'));

CREATE TABLE IF NOT EXISTS cvp_outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES cvp_applications(id) ON DELETE SET NULL,
  message_id text NOT NULL,
  recipient_email citext,
  subject text,
  body_html text,
  body_text text,
  template_tag text,
  decision_id uuid REFERENCES cvp_application_decisions(id) ON DELETE SET NULL,
  sent_by_staff_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- Message-Id uniqueness: Mailgun returns a unique id per send; enforce so the
-- inbound lookup by In-Reply-To header is deterministic.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cvp_outbound_message_id
  ON cvp_outbound_messages (message_id);
CREATE INDEX IF NOT EXISTS idx_cvp_outbound_application
  ON cvp_outbound_messages (application_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_cvp_outbound_recipient
  ON cvp_outbound_messages (recipient_email);

COMMENT ON TABLE cvp_outbound_messages IS
  'Every decision-driven outbound email, keyed by Mailgun Message-Id. Powers conversation threading when applicants reply.';

ALTER TABLE cvp_outbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read outbound messages"
  ON cvp_outbound_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );
-- INSERT is service-role only (via edge function) — no policy for authenticated.

-- ============================================================
-- Extend cvp_inbound_emails for threading + analysis + ack
-- ============================================================
ALTER TABLE cvp_inbound_emails
  ADD COLUMN IF NOT EXISTS matched_outbound_id uuid REFERENCES cvp_outbound_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_reply_analysis jsonb,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cvp_inbound_matched_outbound
  ON cvp_inbound_emails (matched_outbound_id)
  WHERE matched_outbound_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cvp_inbound_unacked
  ON cvp_inbound_emails (received_at DESC)
  WHERE acknowledged_at IS NULL;

COMMENT ON COLUMN cvp_inbound_emails.matched_outbound_id IS
  'When the inbound In-Reply-To header matches a cvp_outbound_messages row, that outbound is linked here.';
COMMENT ON COLUMN cvp_inbound_emails.ai_reply_analysis IS
  'Structured Opus-generated analysis of a threaded reply (sentiment, answers, open questions, recommended next action).';
