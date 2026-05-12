-- ============================================================================
-- TMS migration announcement broadcast: queue + dispatch cron
-- ============================================================================
-- One-time outreach to past-working vendors announcing the move from XTRF to
-- the CETHOS Vendor Portal. Pools are enqueued in waves by staff:
--   1) Dutch -> English
--   2) Arabic (any direction)
--   3) CCJK  (Chinese / Japanese / Korean, any direction)
--
-- Sends are paced at 20 / hour via a pg_cron that fires every 3 minutes and
-- dispatches at most one queued row per tick (60 / 3 = 20).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS cvp_tms_migration_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  email         citext NOT NULL,
  full_name     text,
  wave          text NOT NULL CHECK (wave IN ('dutch_to_english','arabic','ccjk')),
  send_status   text NOT NULL DEFAULT 'pending'
                CHECK (send_status IN ('pending','claimed','sent','failed','suppressed')),
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  provider_message_id text,
  queued_at     timestamptz NOT NULL DEFAULT now(),
  claimed_at    timestamptz,
  sent_at       timestamptz,
  CONSTRAINT uq_cvp_tms_migration_queue_vendor_wave UNIQUE (vendor_id, wave)
);

-- Worker picks the oldest pending row not already claimed (or with a stale
-- claim older than 5 minutes — recovers from a crashed dispatch).
CREATE INDEX IF NOT EXISTS idx_cvp_tms_migration_queue_pending
  ON cvp_tms_migration_queue (queued_at)
  WHERE send_status IN ('pending','claimed');

CREATE INDEX IF NOT EXISTS idx_cvp_tms_migration_queue_wave_status
  ON cvp_tms_migration_queue (wave, send_status);

COMMENT ON TABLE cvp_tms_migration_queue IS
  'One row per (vendor, wave) for the XTRF->Vendor Portal announcement broadcast. Drained by cvp-tms-migration-send at 20/hour.';

ALTER TABLE cvp_tms_migration_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read tms migration queue"
  ON cvp_tms_migration_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );
-- INSERT/UPDATE are service-role only (edge functions). No authenticated write policy.

-- ============================================================================
-- Dispatch cron — every 3 minutes, send up to 1 queued row => 20 / hour
-- ============================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('cvp-tms-migration-send');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cvp-tms-migration-send',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1/cvp-tms-migration-send',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object()
  );
  $$
);
