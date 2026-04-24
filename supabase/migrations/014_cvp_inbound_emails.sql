-- CVP inbound emails + do_not_contact columns
-- Purpose: persist every inbound applicant email + gate outbound sends.
-- Phase 1 handles only "unsubscribe/remove" intents; other inbound gets an AI auto-reply.
-- Dependencies: cvp_applications.
-- Date: 2026-04-23

CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- do_not_contact on applications
-- ============================================================
ALTER TABLE cvp_applications
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cvp_applications_dnc_source_check'
  ) THEN
    ALTER TABLE cvp_applications
      ADD CONSTRAINT cvp_applications_dnc_source_check
      CHECK (
        do_not_contact_source IS NULL
        OR do_not_contact_source IN ('inbound_email', 'staff', 'admin_ui')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cvp_applications_dnc
  ON cvp_applications (email)
  WHERE do_not_contact = TRUE;

COMMENT ON COLUMN cvp_applications.do_not_contact IS
  'When TRUE, Mailgun transport (sendMailgunEmail) suppresses outbound delivery. Set via inbound unsubscribe or staff action.';

-- ============================================================
-- cvp_inbound_emails
-- ============================================================
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
    OR classified_intent IN ('unsubscribe', 'other', 'unmatched', 'error')
  ),
  ai_classification jsonb,
  action_taken text CHECK (
    action_taken IS NULL
    OR action_taken IN (
      'do_not_contact_set',
      'auto_reply_sent',
      'auto_reply_failed',
      'noop'
    )
  ),
  auto_reply_sent_at timestamptz,
  raw_payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_cvp_inbound_emails_received
  ON cvp_inbound_emails (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_cvp_inbound_emails_from
  ON cvp_inbound_emails (from_email);
CREATE INDEX IF NOT EXISTS idx_cvp_inbound_emails_application
  ON cvp_inbound_emails (matched_application_id)
  WHERE matched_application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cvp_inbound_emails_message_id
  ON cvp_inbound_emails (message_id)
  WHERE message_id IS NOT NULL;

COMMENT ON TABLE cvp_inbound_emails IS
  'Every inbound email received via Mailgun Route → cvp-inbound-email edge function.';

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE cvp_inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read inbound emails"
  ON cvp_inbound_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

-- INSERT happens via service role (edge function) which bypasses RLS.
-- No INSERT policy for authenticated — staff should not hand-craft inbound rows.
