-- ============================================================================
-- Vendor email opt-outs
-- ============================================================================
-- Records every vendor who has clicked an unsubscribe link (or whom staff
-- have marked as do-not-contact). Checked by broadcast senders like
-- cvp-tms-migration-send before each outbound email.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS cvp_vendor_email_opt_outs (
  vendor_id     uuid PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
  email         citext NOT NULL,
  opted_out_at  timestamptz NOT NULL DEFAULT now(),
  source        text NOT NULL DEFAULT 'unsubscribe_link'
                CHECK (source IN ('unsubscribe_link','list_unsubscribe_post','staff','reply_keyword')),
  broadcast_tag text,
  user_agent    text,
  ip_address    inet
);

CREATE INDEX IF NOT EXISTS idx_cvp_vendor_email_opt_outs_email
  ON cvp_vendor_email_opt_outs (email);

COMMENT ON TABLE cvp_vendor_email_opt_outs IS
  'Vendors who have opted out of broadcast email. Broadcast senders MUST check this table before sending.';

ALTER TABLE cvp_vendor_email_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read vendor opt-outs"
  ON cvp_vendor_email_opt_outs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );
-- INSERT is service-role only (the cvp-unsubscribe edge function).
