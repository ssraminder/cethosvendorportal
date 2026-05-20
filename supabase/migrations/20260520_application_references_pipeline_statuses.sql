-- cvp_applications: add references_* pipeline statuses
--
-- Until now, an application stayed at `test_*` (or `staff_review`) even
-- after the admin requested references and the references came in. The
-- recruitment list had no way to surface "all references in, ready to
-- approve." This migration:
--
-- 1. Extends the cvp_applications_status_check CHECK constraint to
--    include three new statuses:
--      - references_requested  : V18 sent, applicant hasn't filed contacts
--      - references_in_progress: applicant submitted contacts, awaiting refs
--      - references_received   : every reference has replied or declined
--
-- 2. Backfills applications already in the pipeline:
--    - request row exists but no contacts submitted → references_requested
--    - contacts submitted, at least one ref still 'requested' → references_in_progress
--    - all refs in {received, declined} → references_received
--
-- Only flips applications currently in a non-terminal, pre-reference state.
-- Approved / rejected / waitlisted / archived rows are untouched.

ALTER TABLE cvp_applications
  DROP CONSTRAINT IF EXISTS cvp_applications_status_check;

ALTER TABLE cvp_applications
  ADD CONSTRAINT cvp_applications_status_check CHECK (
    status::text = ANY (
      ARRAY[
        'submitted',
        'prescreening',
        'prescreened',
        'test_pending',
        'test_sent',
        'test_in_progress',
        'test_submitted',
        'test_assessed',
        'references_requested',
        'references_in_progress',
        'references_received',
        'negotiation',
        'staff_review',
        'approved',
        'rejected',
        'waitlisted',
        'archived',
        'info_requested'
      ]::text[]
    )
  );

WITH advanceable AS (
  SELECT id FROM cvp_applications
  WHERE status IN (
    'submitted','prescreening','prescreened','staff_review','info_requested',
    'test_pending','test_sent','test_in_progress','test_submitted',
    'test_assessed','negotiation'
  )
),
req AS (
  SELECT application_id,
         BOOL_OR(contacts_submitted_at IS NOT NULL) AS contacts_in
  FROM cvp_application_reference_requests
  GROUP BY application_id
),
refs AS (
  SELECT application_id,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status IN ('received','declined')) AS done
  FROM cvp_application_references
  GROUP BY application_id
),
target AS (
  SELECT a.id,
         CASE
           WHEN refs.total > 0 AND refs.done = refs.total THEN 'references_received'
           WHEN req.contacts_in IS TRUE                   THEN 'references_in_progress'
           WHEN req.application_id IS NOT NULL            THEN 'references_requested'
         END AS new_status
  FROM advanceable a
  JOIN req ON req.application_id = a.id
  LEFT JOIN refs ON refs.application_id = a.id
)
UPDATE cvp_applications a
SET status = target.new_status, updated_at = NOW()
FROM target
WHERE a.id = target.id AND target.new_status IS NOT NULL;
