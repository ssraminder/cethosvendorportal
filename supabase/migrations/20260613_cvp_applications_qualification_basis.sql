-- Skip-test onboarding (ISO 17100 §3.1.4): when staff onboard an applicant
-- without a test, they must record the qualification basis (degree or
-- experience) so the §3.1.1 evidence record is never empty. References are an
-- accepted documented form of experience evidence (§3.1.4 b/c).
ALTER TABLE public.cvp_applications
  ADD COLUMN qualification_basis text
    CHECK (qualification_basis IN ('degree_translation','degree_other_plus_2y','experience_5y')),
  ADD COLUMN qualification_basis_notes text,
  ADD COLUMN qualification_basis_recorded_at timestamptz,
  ADD COLUMN qualification_basis_recorded_by uuid;
