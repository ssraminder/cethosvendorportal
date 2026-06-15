-- Add 'pending' decision: a §3.1.4 route is plausible but the documented
-- experience evidence (references/proof) isn't on file yet → request it, wait.
ALTER TABLE public.cvp_iso_autoapprove_results
  DROP CONSTRAINT IF EXISTS cvp_iso_autoapprove_results_decision_check;
ALTER TABLE public.cvp_iso_autoapprove_results
  ADD CONSTRAINT cvp_iso_autoapprove_results_decision_check
  CHECK (decision IN ('auto','pending','hitl','not_met'));
