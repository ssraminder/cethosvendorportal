-- CVP Translators
-- Purpose: Created when an application is approved. The primary vendor record.
-- Dependencies: cvp_applications, staff_users (shared)
-- Date: 2026-02-18

CREATE TABLE IF NOT EXISTS cvp_translators (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Auth link
  auth_user_id                UUID UNIQUE,

  -- Source
  application_id              UUID REFERENCES cvp_applications(id),

  -- Identity
  email                       VARCHAR(255) NOT NULL UNIQUE,
  full_name                   VARCHAR(255) NOT NULL,
  phone                       VARCHAR(50),
  country                     VARCHAR(100),
  linkedin_url                TEXT,

  -- Role
  role_type                   VARCHAR(30) NOT NULL CHECK (role_type IN (
    'translator',
    'cognitive_debriefing'
  )),
  tier                        VARCHAR(20) CHECK (tier IN ('standard', 'senior', 'expert')),

  -- Approved work scope
  approved_combinations       JSONB DEFAULT '[]',

  -- Profile
  profile_photo_url           TEXT,
  bio                         TEXT,
  certifications              JSONB DEFAULT '[]',
  cat_tools                   TEXT[] DEFAULT '{}',

  -- Cognitive debriefing specific
  cog_instrument_types        TEXT[] DEFAULT '{}',
  cog_therapy_areas           TEXT[] DEFAULT '{}',
  cog_ispor_familiarity       VARCHAR(20),
  cog_fda_familiarity         VARCHAR(20),

  -- Rates
  default_rate                DECIMAL(10,2),

  -- Payout
  payout_method               VARCHAR(30) CHECK (payout_method IN (
    'bank_transfer', 'paypal', 'cheque', 'e_transfer'
  )),
  payout_details              JSONB,

  -- Account status
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at              TIMESTAMPTZ,
  deactivated_by              UUID REFERENCES staff_users(id),
  deactivation_reason         TEXT,

  -- Profile completeness (0-100)
  profile_completeness        INTEGER NOT NULL DEFAULT 0,

  -- Performance stats
  total_jobs_completed        INTEGER NOT NULL DEFAULT 0,
  average_performance_score   DECIMAL(4,2),
  last_active_at              TIMESTAMPTZ,

  -- Language pairs last reviewed
  language_pairs_reviewed_at  TIMESTAMPTZ,

  -- Invite status
  invite_sent_at              TIMESTAMPTZ,
  invite_accepted_at          TIMESTAMPTZ,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvp_translators_email ON cvp_translators(email);
CREATE INDEX IF NOT EXISTS idx_cvp_translators_active ON cvp_translators(is_active);
CREATE INDEX IF NOT EXISTS idx_cvp_translators_role_type ON cvp_translators(role_type);
CREATE INDEX IF NOT EXISTS idx_cvp_translators_tier ON cvp_translators(tier);
CREATE INDEX IF NOT EXISTS idx_cvp_translators_completeness ON cvp_translators(profile_completeness);
CREATE INDEX IF NOT EXISTS idx_cvp_translators_last_active ON cvp_translators(last_active_at);
