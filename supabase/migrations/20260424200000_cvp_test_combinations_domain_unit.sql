-- ============================================================================
-- cvp_test_combinations — domain-based unit of work
-- ============================================================================
--
-- Context: the previous model generated one row per (lang_pair × service_type)
-- and stamped them all with `domainsOffered[0]`. This was wrong both for
-- approval (service_type is not what LSPs approve on) and accuracy (only the
-- first domain ever mattered). We now standardise on one row per
-- (application × lang_pair × domain), with service_type fully deprecated.
--
-- Changes:
--   1. Backfill-collapse existing (pair × service × domain) rows into one per
--      (pair × domain) per application. Winner picked by status rank so
--      already-approved or mid-flight rows survive.
--   2. NULL out service_type on survivors (column stays for backward-compat
--      reads; new inserts MUST write NULL).
--   3. Flip `domain='certified_official'` combos to status='skip_manual_review'
--      so admin UI excludes them from the test-send preview.
--   4. Drop the old 5-col UNIQUE; add a 4-col UNIQUE (no service_type).
--   5. Make service_type nullable; add deprecation comment.
--   6. Add status values: 'skip_manual_review'.
--   7. Add column `is_baseline_general boolean` so the mandatory General-test
--      row per applicant is distinguishable in reports + UI.
-- ============================================================================

BEGIN;

-- ---- 1) Extend status CHECK to accept the new skip-manual-review value ----
ALTER TABLE cvp_test_combinations
  DROP CONSTRAINT IF EXISTS cvp_test_combinations_status_check;

ALTER TABLE cvp_test_combinations
  ADD CONSTRAINT cvp_test_combinations_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending', 'no_test_available', 'test_assigned', 'test_sent',
    'test_submitted', 'assessed', 'approved', 'rejected', 'skipped',
    'skip_manual_review'
  ]::text[]));

-- ---- 2) Add is_baseline_general column (default false) ----
ALTER TABLE cvp_test_combinations
  ADD COLUMN IF NOT EXISTS is_baseline_general boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN cvp_test_combinations.is_baseline_general IS
  'True when this is the mandatory General-domain baseline test row added to every translator application. Used for reporting, not send logic.';

-- ---- 2b) Make service_type nullable FIRST — subsequent UPDATE NULLs it ----
ALTER TABLE cvp_test_combinations
  ALTER COLUMN service_type DROP NOT NULL;

COMMENT ON COLUMN cvp_test_combinations.service_type IS
  'DEPRECATED. Approval is now per-domain; service_types come from cvp_applications.services_offered / rate_card. New inserts MUST write NULL. Column kept for backward-compat reads; will be dropped once all readers are off it.';

-- ---- 3) Backfill-collapse duplicates to one row per (app × pair × domain)
-- Winner rank: approved > in_review > test_sent/sent > pending > everything
-- else. Keep the winner, delete the rest. Preserve approved_rate from the
-- winner (losers' rates are already captured in cvp_applications.rate_card).
WITH ranked AS (
  SELECT
    id,
    application_id,
    source_language_id,
    target_language_id,
    domain,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY application_id, source_language_id, target_language_id, domain
      ORDER BY
        CASE status
          WHEN 'approved'      THEN 1
          WHEN 'assessed'      THEN 2
          WHEN 'test_submitted' THEN 3
          WHEN 'test_sent'     THEN 4
          WHEN 'test_assigned' THEN 5
          WHEN 'pending'       THEN 6
          WHEN 'no_test_available' THEN 7
          WHEN 'skipped'       THEN 8
          WHEN 'rejected'      THEN 9
          ELSE 10
        END,
        created_at ASC
    ) AS rn
  FROM cvp_test_combinations
)
DELETE FROM cvp_test_combinations c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- ---- 4) NULL out service_type on all surviving rows (deprecated column) ----
UPDATE cvp_test_combinations
  SET service_type = NULL
  WHERE service_type IS NOT NULL;

-- ---- 5) Flip certified rows to skip_manual_review so preview excludes them
UPDATE cvp_test_combinations
  SET status = 'skip_manual_review',
      updated_at = now()
  WHERE domain = 'certified_official'
    AND status IN ('pending', 'test_assigned', 'test_sent', 'no_test_available');

-- ---- 6) Swap the UNIQUE constraint (drop 5-col, add 4-col) ----
ALTER TABLE cvp_test_combinations
  DROP CONSTRAINT IF EXISTS cvp_test_combinations_application_id_source_language_id_tar_key;

ALTER TABLE cvp_test_combinations
  ADD CONSTRAINT cvp_test_combinations_app_pair_domain_key
  UNIQUE (application_id, source_language_id, target_language_id, domain);

-- (service_type was already made nullable in step 2b above.)

COMMIT;

-- ============================================================================
-- Post-migration verification (no-op queries, safe to include)
-- ============================================================================

-- Expected: zero rows
SELECT application_id, source_language_id, target_language_id, domain, COUNT(*) AS dup_count
FROM cvp_test_combinations
GROUP BY 1, 2, 3, 4
HAVING COUNT(*) > 1;

-- Expected: all certified rows are now skip_manual_review
SELECT status, COUNT(*) AS n
FROM cvp_test_combinations
WHERE domain = 'certified_official'
GROUP BY status;
