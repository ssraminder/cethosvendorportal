-- ============================================================================
-- cvp_translator_domains — durable per-vendor × domain × lang-pair approval
-- ============================================================================
--
-- Context: cvp_translators.approved_combinations is a jsonb snapshot written
-- by cvp-approve-application. That's fine for lightweight reads but not
-- queryable. Testing now happens per (pair × domain); approval state needs
-- structured storage so we can:
--   - Query "who's approved for life_sciences EN→FR?" efficiently
--   - Track cooldowns on rejected domains for self-service re-request
--   - Distinguish application-approved from self-requested from staff-manual
--     approvals (e.g. certified_official is always staff_manual)
--
-- The jsonb column on cvp_translators stays in place — it's still written by
-- cvp-approve-application for the vendor-portal `vendor-get-profile` reader
-- (deprecation tracked in CVP-PROGRESS-LOG for T3+).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cvp_translator_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who the approval belongs to.
  translator_id uuid NOT NULL REFERENCES cvp_translators(id) ON DELETE CASCADE,
  source_language_id uuid NOT NULL REFERENCES languages(id),
  target_language_id uuid NOT NULL REFERENCES languages(id),

  -- Aligned with cvp_test_combinations.domain CHECK (22 values). Keep in
  -- lockstep if that list ever changes.
  domain text NOT NULL CHECK (domain = ANY (ARRAY[
    'legal', 'certified_official', 'immigration', 'medical', 'life_sciences',
    'pharmaceutical', 'financial', 'insurance', 'technical', 'it_software',
    'automotive_engineering', 'energy', 'marketing_advertising',
    'literary_publishing', 'academic_scientific', 'government_public',
    'business_corporate', 'gaming_entertainment', 'media_journalism',
    'tourism_hospitality', 'general', 'other'
  ])),

  -- Lifecycle. `skip_manual_review` is the sentinel for certified-only.
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY[
    'pending', 'in_review', 'approved', 'rejected',
    'skip_manual_review', 'revoked'
  ])),

  -- How this row got here. Matters for audit + the future self-request flow.
  approval_source text NOT NULL DEFAULT 'application' CHECK (approval_source = ANY (ARRAY[
    'application',   -- came in via the Apply form at initial approval
    'self_request',  -- post-approval: vendor requested via Request-Test flow
    'staff_manual'   -- staff added w/o a test (certified, exceptional cases)
  ])),

  approved_at timestamptz,
  approved_by uuid,  -- staff_users.id; FK elided to avoid coupling
  rejected_at timestamptz,

  -- Set when status flips to 'rejected'. Typically now() + 30 days. A
  -- translator cannot self-request this same (pair × domain) until after.
  cooldown_until timestamptz,

  -- Audit trail back to the submission that produced this verdict, if any.
  last_submission_id uuid REFERENCES cvp_test_submissions(id),
  test_combination_id uuid REFERENCES cvp_test_combinations(id),

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (translator_id, source_language_id, target_language_id, domain)
);

CREATE INDEX IF NOT EXISTS cvp_translator_domains_translator_idx
  ON cvp_translator_domains(translator_id);

CREATE INDEX IF NOT EXISTS cvp_translator_domains_open_idx
  ON cvp_translator_domains(translator_id, status)
  WHERE status IN ('pending', 'in_review');

CREATE INDEX IF NOT EXISTS cvp_translator_domains_cooldown_idx
  ON cvp_translator_domains(cooldown_until)
  WHERE status = 'rejected' AND cooldown_until IS NOT NULL;

COMMENT ON TABLE cvp_translator_domains IS
  'Per (translator × lang_pair × domain) approval state. Source of truth for "is this vendor approved to take jobs in domain X on pair Y?". Replaces the jsonb snapshot on cvp_translators.approved_combinations once vendor-get-profile migrates to read from here.';

-- ---- updated_at trigger ----
CREATE OR REPLACE FUNCTION cvp_translator_domains_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cvp_translator_domains_updated_at ON cvp_translator_domains;
CREATE TRIGGER cvp_translator_domains_updated_at
  BEFORE UPDATE ON cvp_translator_domains
  FOR EACH ROW EXECUTE FUNCTION cvp_translator_domains_touch_updated_at();

-- ---- RLS: service_role only. Vendor-facing reads go through edge functions. ----
ALTER TABLE cvp_translator_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cvp_translator_domains_service_role_all ON cvp_translator_domains;
CREATE POLICY cvp_translator_domains_service_role_all
  ON cvp_translator_domains
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
