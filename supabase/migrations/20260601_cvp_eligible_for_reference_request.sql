-- 20260601_cvp_eligible_for_reference_request
-- RPC used by cvp-bulk-request-references to fetch applicants who are
-- ready for a reference request: at least one passed test combo, no
-- existing reference request, and not in a terminal status.

CREATE OR REPLACE FUNCTION public.cvp_eligible_for_reference_request()
RETURNS TABLE (application_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.id
  FROM public.cvp_applications a
  WHERE a.status NOT IN ('approved','rejected','archived','waitlisted')
    AND EXISTS (
      SELECT 1 FROM public.cvp_test_combinations c
      WHERE c.application_id = a.id
        AND c.status IN ('approved','manually_passed','skip_manual_review')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.cvp_application_reference_requests rr
      WHERE rr.application_id = a.id
    );
$$;

REVOKE ALL ON FUNCTION public.cvp_eligible_for_reference_request() FROM public;
GRANT EXECUTE ON FUNCTION public.cvp_eligible_for_reference_request() TO service_role;
