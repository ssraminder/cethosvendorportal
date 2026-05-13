-- ============================================================================
-- 20260513_payment_terms_and_change_history.sql
--
-- 1. Add payment_terms_days (default 45) — NET45 for every vendor.
-- 2. Add change_acknowledged_at — timestamp the vendor last accepted the
--    "changes apply from the next payment cycle; payments processed in the
--    last 15 days are unaffected" warning.
-- 3. Create vendor_payment_info_history — snapshot of every prior version
--    of a vendor's payment_info. AR side can look up the row effective at
--    an invoice's processed timestamp to route payouts to the OLD info for
--    anything processed before the change.
-- 4. Trigger: on UPDATE of vendor_payment_info, write the OLD row to
--    history with valid_until = now() before letting the update through.
-- ============================================================================

ALTER TABLE vendor_payment_info
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 45
    CHECK (payment_terms_days BETWEEN 0 AND 180),
  ADD COLUMN IF NOT EXISTS change_acknowledged_at TIMESTAMPTZ;

COMMENT ON COLUMN vendor_payment_info.payment_terms_days IS
  'Default NET payment terms in days from invoice. Cethos-wide default is 45.';
COMMENT ON COLUMN vendor_payment_info.change_acknowledged_at IS
  'Set whenever the vendor accepts the cooling-off acknowledgement on a payment-info change.';

-- Backfill any existing rows that predate the column to the new default.
-- The DEFAULT 45 above already covers new rows; this is belt-and-suspenders
-- in case an upgrade path leaves NULLs around.
UPDATE vendor_payment_info SET payment_terms_days = 45 WHERE payment_terms_days IS NULL;

-- ---------------------------------------------------------------------------
-- History table — one row per prior version of a vendor's payment_info.
-- AR routes payouts based on which row's [valid_from, valid_until) bracket
-- the invoice's processed_at.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_payment_info_history (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id               UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  payment_currency        TEXT NOT NULL,
  payment_method          TEXT,
  payment_details         JSONB,
  invoice_notes           TEXT,
  payment_terms_days      INTEGER NOT NULL,
  valid_from              TIMESTAMPTZ NOT NULL,
  valid_until             TIMESTAMPTZ NOT NULL,
  superseded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by_vendor    BOOLEAN NOT NULL DEFAULT true,
  change_acknowledged_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vpi_history_vendor
  ON vendor_payment_info_history (vendor_id, valid_until DESC);

COMMENT ON TABLE vendor_payment_info_history IS
  'Prior versions of vendor_payment_info. AR looks up the row whose [valid_from, valid_until) contains the invoice processed_at to route payouts. Lets the "last 15 days unaffected" rule work without timing the change.';

-- Trigger: copy the OLD row into history on every UPDATE.
CREATE OR REPLACE FUNCTION snapshot_vendor_payment_info_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only snapshot when the payout-routing fields actually changed.
  -- Currency/method/details/terms — invoice_notes alone is cosmetic so
  -- we skip those to avoid history bloat.
  IF (NEW.payment_method IS DISTINCT FROM OLD.payment_method
   OR NEW.payment_details IS DISTINCT FROM OLD.payment_details
   OR NEW.payment_currency IS DISTINCT FROM OLD.payment_currency
   OR NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days)
  THEN
    INSERT INTO vendor_payment_info_history (
      vendor_id, payment_currency, payment_method, payment_details,
      invoice_notes, payment_terms_days, valid_from, valid_until,
      superseded_at, change_acknowledged_at
    ) VALUES (
      OLD.vendor_id, OLD.payment_currency, OLD.payment_method, OLD.payment_details,
      OLD.invoice_notes, OLD.payment_terms_days,
      OLD.updated_at, now(),
      now(), NEW.change_acknowledged_at
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vpi_snapshot_on_update ON vendor_payment_info;
CREATE TRIGGER trg_vpi_snapshot_on_update
  BEFORE UPDATE ON vendor_payment_info
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_vendor_payment_info_change();
