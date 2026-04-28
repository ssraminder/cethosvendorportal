-- ============================================================================
-- cvp_test_library — wildcard target language support
-- ============================================================================
--
-- Until now every library row was tied to an exact (source, target) language
-- pair. With 140 target languages × 20 testable domains × 3 difficulties × 4
-- versions, that's ~33k rows of pre-translated content — economically infeasible
-- to AI-draft, and unnecessary for the EN→Target test flow where a single
-- English source serves all targets.
--
-- This migration introduces "wildcard" library rows: target_language_id IS NULL
-- means "matches any target language." The cvp-send-tests query gains a
-- fallback path: if no language-specific row matches a combination, it picks
-- a wildcard row at the same domain + difficulty.
--
-- Wildcards are only meaningful for English-source tests in this rollout —
-- a CHECK enforces that. Reference translations are not pre-generated for
-- wildcard rows; cvp-assess-test already handles reference_translation IS NULL
-- gracefully (falls back to "Not provided" in the assessment prompt).
--
-- Existing rows are unaffected.
-- ============================================================================

BEGIN;

-- 1. Allow target_language_id to be NULL (wildcard rows).
ALTER TABLE cvp_test_library
  ALTER COLUMN target_language_id DROP NOT NULL;

-- 2. Wildcard rows must have an English source. No other source-only wildcards
--    make sense in the current product — if we ever generalise, drop this.
ALTER TABLE cvp_test_library
  ADD CONSTRAINT cvp_test_library_wildcard_english_only
  CHECK (
    target_language_id IS NOT NULL
    OR source_language_id = 'fde091d2-db5f-4e41-a490-7e15efc419e1'::uuid
  );

-- 3. Partial index for the wildcard fallback path. cvp-send-tests will look
--    up by (source_language_id, domain, difficulty) when target-specific
--    rows are missing.
CREATE INDEX IF NOT EXISTS idx_cvp_test_library_wildcard
  ON cvp_test_library (source_language_id, domain, difficulty)
  WHERE target_language_id IS NULL AND is_active = true;

COMMIT;

-- Verification: schema accepts a NULL target on an English row, rejects on others.
-- (Run manually if you want — both should match expectations.)
-- INSERT INTO cvp_test_library (id, title, source_language_id, target_language_id, domain, service_type, difficulty)
-- VALUES (gen_random_uuid(), 'wildcard-test', 'fde091d2-db5f-4e41-a490-7e15efc419e1', NULL, 'general', 'domain_test', 'beginner');
-- -- Should succeed.
-- INSERT INTO cvp_test_library (id, title, source_language_id, target_language_id, domain, service_type, difficulty)
-- VALUES (gen_random_uuid(), 'bad-wildcard', 'd972e8cc-519c-4446-9483-30da1346850c', NULL, 'general', 'domain_test', 'beginner');
-- -- Should fail with cvp_test_library_wildcard_english_only.
