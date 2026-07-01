-- 20260630_qms_vendor_escalation_reminder_cron.sql
-- Daily reminder cron for the vendor CAPA/NC escalation loop.
--
-- Sibling of the admin-side `qms-capa-reminder-daily` (which chases STAFF about
-- open CAPA actions via notify-staff-capa). This one chases the VENDOR about an
-- escalation response that is overdue or due soon, by invoking the vendor-repo
-- edge function `notify-vendor-capa-reminder`, which reads
-- public.qms_vendor_escalation_reminders(days) and emails each vendor via Brevo.
--
-- OFF BY DEFAULT — the edge function is gated on the app setting
-- `vendor_escalation_reminders_enabled` (public.app_settings, staff-editable in
-- the admin Settings UI). This migration seeds that setting to 'false'. The cron
-- job below is scheduled ACTIVE and fires daily, but the function no-ops (sends
-- nothing) until the setting is flipped to 'true'. Flipping the setting is the
-- single on/off control — no cron change is needed to turn reminders on or off.
--
-- The read RPC public.qms_vendor_escalation_reminders(int) already exists
-- (admin migration 20260630_qms_vendor_capa_escalations.sql). Auth: the shared
-- cron secret from vault (name cron_shared_secret), sent as x-cron-secret and
-- verified inside the function. Fires at 14:30 UTC daily — 30 min after the
-- staff CAPA digest so the two don't contend. Idempotent: safe to re-apply.

-- ── Feature flag: off by default ────────────────────────────────────────────
insert into public.app_settings (setting_key, setting_value, setting_type, description)
values (
  'vendor_escalation_reminders_enabled',
  'false',
  'boolean',
  'When true, the daily cron emails vendors (via Brevo) about overdue/due-soon CAPA/NC escalation responses. Off by default.'
)
on conflict (setting_key) do nothing;

-- ── Daily cron (active; gated by the setting above) ─────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('qms-vendor-escalation-reminder-daily');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet
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
