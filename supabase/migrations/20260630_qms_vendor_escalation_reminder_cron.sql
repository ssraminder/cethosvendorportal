-- 20260630_qms_vendor_escalation_reminder_cron.sql
-- Daily reminder cron for the vendor CAPA/NC escalation loop.
--
-- Sibling of the admin-side `qms-capa-reminder-daily` (which chases STAFF about
-- open CAPA actions via notify-staff-capa). This one chases the VENDOR about an
-- escalation response that is overdue or due soon, by invoking the vendor-repo
-- edge function `notify-vendor-capa-reminder`, which reads
-- public.qms_vendor_escalation_reminders(days) and emails each vendor via Brevo.
--
-- The read RPC public.qms_vendor_escalation_reminders(int) already exists
-- (admin migration 20260630_qms_vendor_capa_escalations.sql); this migration
-- only schedules the cron. Auth: the shared cron secret from vault (name
-- cron_shared_secret), sent as x-cron-secret and verified inside the function
-- via requireCronSecret() (audit finding H-5).
--
-- Fires at 14:30 UTC daily — 30 min after the staff CAPA digest so the two
-- don't contend. Idempotent: unschedule first, then reschedule.

DO $$
BEGIN
  PERFORM cron.unschedule('qms-vendor-escalation-reminder-daily');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist yet — ignore.
  NULL;
END $$;

SELECT cron.schedule(
  'qms-vendor-escalation-reminder-daily',
  '30 14 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1/notify-vendor-capa-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')
    ),
    body := '{"days":2}'::jsonb
  );
  $cron$
);
