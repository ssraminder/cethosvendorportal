-- Tracks one-shot backfill jobs that re-grade the test corpus under a
-- new prompt version and re-issue V22 to applicants.
CREATE TABLE IF NOT EXISTS cvp_test_regrade_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version text,        -- the prompt version we're upgrading to
  total          integer NOT NULL DEFAULT 0,
  completed      integer NOT NULL DEFAULT 0,
  errored        integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'errored', 'cancelled')),
  started_at     timestamptz,
  completed_at   timestamptz,
  log            jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid -- staff_users.id
);

-- Stamp regrade_job_id on combinations as they're processed so re-runs
-- can skip already-handled rows.
ALTER TABLE cvp_test_combinations
  ADD COLUMN IF NOT EXISTS regrade_job_id uuid;

CREATE INDEX IF NOT EXISTS idx_cvp_test_combinations_regrade_job
  ON cvp_test_combinations (regrade_job_id);

COMMENT ON TABLE cvp_test_regrade_jobs IS
  'One-shot backfill jobs that re-grade existing test submissions and re-issue V22 to applicants. Used after AI grading prompt changes.';
