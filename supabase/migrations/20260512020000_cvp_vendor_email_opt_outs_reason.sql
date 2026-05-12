-- Capture why a vendor unsubscribed. Reason is a fixed enum so we can
-- aggregate cleanly; reason_text is freeform for "Other" or extra context.

ALTER TABLE cvp_vendor_email_opt_outs
  ADD COLUMN IF NOT EXISTS reason text
    CHECK (reason IS NULL OR reason IN (
      'too_many_emails',
      'not_relevant',
      'no_longer_translator',
      'never_signed_up',
      'other'
    )),
  ADD COLUMN IF NOT EXISTS reason_text text;
