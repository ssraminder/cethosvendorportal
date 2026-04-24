-- Register daily recruitment-status cron.
-- Fires the cvp-daily-recruitment-status edge function every day at 13:00 UTC
-- (≈ 08:00 Calgary / 06:00 PT — adjust schedule if you move timezones).
-- Idempotent: unschedule first, then reschedule.

DO $$
BEGIN
  PERFORM cron.unschedule('cvp-daily-recruitment-status');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist yet — ignore.
  NULL;
END $$;

SELECT cron.schedule(
  'cvp-daily-recruitment-status',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1/cvp-daily-recruitment-status',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object()
  );
  $$
);
