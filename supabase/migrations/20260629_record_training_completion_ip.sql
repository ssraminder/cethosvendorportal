-- Phase 3: capture IP + user-agent on vendor training completions.
-- The completion_ip / completion_user_agent columns on cvp_training_completions
-- are added by the admin repo migration 20260629_training_completion_ip_audit_vendor_cols.
-- Here the RPC gains trailing p_ip / p_user_agent params so vendor-mark-training-complete
-- (which reads x-forwarded-for / user-agent at the edge) can persist them.
CREATE OR REPLACE FUNCTION public.cvp_record_training_completion(
  p_vendor_id uuid,
  p_training_id uuid,
  p_method text DEFAULT 'online'::text,
  p_quiz_score numeric DEFAULT NULL::numeric,
  p_recorded_by uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_ip text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.cvp_training_completions
    (vendor_id, training_id, status, method, quiz_score, recorded_by, notes, completion_ip, completion_user_agent)
  VALUES (p_vendor_id, p_training_id, 'completed', COALESCE(p_method,'online'), p_quiz_score, p_recorded_by, p_notes, p_ip, p_user_agent)
  ON CONFLICT (vendor_id, training_id) DO UPDATE
    SET status='completed', method=EXCLUDED.method,
        quiz_score=COALESCE(EXCLUDED.quiz_score, public.cvp_training_completions.quiz_score),
        recorded_by=COALESCE(EXCLUDED.recorded_by, public.cvp_training_completions.recorded_by),
        notes=COALESCE(EXCLUDED.notes, public.cvp_training_completions.notes),
        -- keep a prior IP/UA if a later (e.g. offline admin) record carries none.
        completion_ip=COALESCE(EXCLUDED.completion_ip, public.cvp_training_completions.completion_ip),
        completion_user_agent=COALESCE(EXCLUDED.completion_user_agent, public.cvp_training_completions.completion_user_agent),
        completed_at=now(), updated_at=now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- Drop the pre-IP signature so a 3-/6-arg call doesn't resolve ambiguously.
DROP FUNCTION IF EXISTS public.cvp_record_training_completion(uuid, uuid, text, numeric, uuid, text);
