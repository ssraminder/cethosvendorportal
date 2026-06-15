-- Live auto-approval wiring for the recruitment §3.1.4 scorer.
ALTER TABLE public.cvp_iso_autoapprove_results
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_vendor_id uuid,
  ADD COLUMN IF NOT EXISTS apply_error text;

INSERT INTO public.cvp_system_config (key, value, description)
VALUES ('auto_approve',
        '{"enabled": false, "acting_staff_id": null}'::jsonb,
        'Recruitment §3.1.4 auto-approval. When enabled, applications the scorer marks decision=auto (documented translation degree, or experience confirmed by references) are onboarded without a human click. Experience without documented evidence never auto-approves (enforced again in cvp-approve-application).')
ON CONFLICT (key) DO NOTHING;
