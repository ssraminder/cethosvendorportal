-- Persist staff-edited rejection email subjects through the 48h intercept.
-- Without this, cron cvp-send-queued-rejections-hourly re-renders V12 with
-- the default subject and loses any staff edit from the preview step.
-- Also: fix a pre-existing behaviour where cron read rejection_email_draft
-- (HTML) as the plain-text reason slot — stop doing that; always use
-- rejection_reason.

ALTER TABLE cvp_applications
  ADD COLUMN IF NOT EXISTS rejection_email_subject_override text;

COMMENT ON COLUMN cvp_applications.rejection_email_subject_override IS
  'Optional staff-edited subject line set via the admin preview-edit flow. When non-null, cvp-send-queued-rejections-hourly uses this instead of the template default.';
