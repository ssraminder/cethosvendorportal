-- ============================================================================
-- Drain test-library queue cron
-- ============================================================================
--
-- Calls cvp-seed-library-refs every 5 minutes with limit=4. Each row takes
-- ~10–20s on Sonnet (wildcard) or ~30–60s on Opus (language-specific), so
-- limit=4 fits comfortably under the edge-function 150s timeout.
--
-- The queue is bounded — once every is_active=false row has been processed,
-- the function returns processed=0 and the cron tick is a cheap no-op
-- (~50ms). Safe to leave running indefinitely.
--
-- Idempotent: unschedule first, then reschedule.
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('cvp-drain-test-library');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist yet — ignore.
  NULL;
END $$;

SELECT cron.schedule(
  'cvp-drain-test-library',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1/cvp-seed-library-refs',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('limit', 4)
  );
  $$
);
