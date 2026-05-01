-- Daily grading-reminder cron. Mirrors cvp-check-test-followups for the
-- staff-review side: reminds graders at +3 / +6 / +9 days when a
-- cvp_test_combinations row is stuck in status='assessed' without
-- progress.

DO $$
BEGIN
  PERFORM cron.unschedule('cvp-check-grading-followups');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cvp-check-grading-followups',
  '0 14 * * *',  -- 14:00 UTC daily (~9am Eastern, before staff start)
  $$
  SELECT net.http_post(
    url := 'https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1/cvp-check-grading-followups',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object()
  );
  $$
);
