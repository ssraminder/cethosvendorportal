-- CVP Profile Nudges
-- Purpose: Tracks profile health nudges sent to translators, 30-day suppression window
-- Dependencies: cvp_translators
-- Date: 2026-02-18

CREATE TABLE IF NOT EXISTS cvp_profile_nudges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translator_id     UUID NOT NULL REFERENCES cvp_translators(id) ON DELETE CASCADE,

  nudge_type        VARCHAR(50) NOT NULL CHECK (nudge_type IN (
    'payout_missing',
    'profile_incomplete',
    'certification_expiry',
    'language_pairs_stale',
    'inactive_internal'
  )),

  -- Email tracking (null for internal-only nudges)
  email_sent_at     TIMESTAMPTZ,
  email_template    VARCHAR(10),

  -- Suppression
  suppressed_until  TIMESTAMPTZ,

  -- Resolution
  resolved_at       TIMESTAMPTZ,
  resolved_notes    TEXT,

  -- Escalation tracking (for payout_missing)
  escalation_level  INTEGER DEFAULT 1,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvp_profile_nudges_translator ON cvp_profile_nudges(translator_id);
CREATE INDEX IF NOT EXISTS idx_cvp_profile_nudges_type ON cvp_profile_nudges(nudge_type);
CREATE INDEX IF NOT EXISTS idx_cvp_profile_nudges_unresolved ON cvp_profile_nudges(translator_id, nudge_type)
  WHERE resolved_at IS NULL;
