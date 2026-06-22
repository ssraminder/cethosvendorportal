-- Helper RPC so the evidence-screen backfill can load the screened set without
-- direct PostgREST access to the qms schema (which is not in the exposed schema list).
CREATE OR REPLACE FUNCTION public.qms_list_screened_storage_paths(p_offset int DEFAULT 0, p_limit int DEFAULT 1000)
RETURNS TABLE(storage_path text)
SECURITY DEFINER
SET search_path = public, qms
LANGUAGE sql
AS $$
  SELECT ce.storage_path
  FROM qms.competence_evidence ce
  WHERE ce.storage_path IS NOT NULL
  LIMIT p_limit OFFSET p_offset;
$$;
