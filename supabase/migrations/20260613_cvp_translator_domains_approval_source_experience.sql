-- Allow 'experience' as a domain approval source — used when a translator is
-- onboarded on an ISO 17100 §3.1.4 degree/experience basis without a test.
ALTER TABLE public.cvp_translator_domains
  DROP CONSTRAINT IF EXISTS cvp_translator_domains_approval_source_check;
ALTER TABLE public.cvp_translator_domains
  ADD CONSTRAINT cvp_translator_domains_approval_source_check
  CHECK (approval_source = ANY (ARRAY['application','self_request','staff_manual','experience']));
