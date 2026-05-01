-- ============================================================================
-- V22 auto-send cron
-- ============================================================================
--
-- Calls cvp-process-feedback-auto-send every 5 minutes. The function
-- claims due rows from cvp_test_feedback_rounds (status='pending',
-- staff_skip=false, auto_send_at <= now()) and fires V22 by calling
-- cvp-send-test-feedback-request for each.
--
-- Cap of 25 rows per tick + max 3 retries per row keeps the job bounded.
-- A no-op tick (no due rows) is ~50 ms.
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('cvp-process-feedback-auto-send');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cvp-process-feedback-auto-send',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1/cvp-process-feedback-auto-send',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object()
  );
  $$
);
