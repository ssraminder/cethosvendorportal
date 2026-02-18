-- CVP Applications
-- Purpose: Primary record for all vendor applications
-- Dependencies: staff_users (shared CETHOS table)
-- Date: 2026-02-18

CREATE TABLE IF NOT EXISTS cvp_applications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number          VARCHAR(20) NOT NULL UNIQUE,

  -- Role type
  role_type                   VARCHAR(30) NOT NULL CHECK (role_type IN (
    'translator',
    'cognitive_debriefing'
  )),

  -- Personal info
  email                       VARCHAR(255) NOT NULL,
  full_name                   VARCHAR(255) NOT NULL,
  phone                       VARCHAR(50),
  city                        VARCHAR(100),
  country                     VARCHAR(100) NOT NULL,
  linkedin_url                TEXT,

  -- Professional background (translator)
  years_experience            INTEGER,
  education_level             VARCHAR(50),
  certifications              JSONB DEFAULT '[]',
  cat_tools                   TEXT[] DEFAULT '{}',
  services_offered            TEXT[] DEFAULT '{}',
  work_samples                JSONB DEFAULT '[]',
  rate_expectation            DECIMAL(10,2),
  referral_source             VARCHAR(100),
  notes                       TEXT,

  -- Professional background (cognitive debriefing specific)
  cog_years_experience        INTEGER,
  cog_degree_field            VARCHAR(200),
  cog_credentials             TEXT,
  cog_instrument_types        TEXT[] DEFAULT '{}',
  cog_therapy_areas           TEXT[] DEFAULT '{}',
  cog_pharma_clients          TEXT,
  cog_ispor_familiarity       VARCHAR(20),
  cog_fda_familiarity         VARCHAR(20),
  cog_prior_debrief_reports   BOOLEAN DEFAULT FALSE,
  cog_sample_report_path      TEXT,
  cog_availability            VARCHAR(30),
  cog_rate_expectation        DECIMAL(10,2),

  -- Application status
  status                      VARCHAR(40) NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'prescreening',
    'prescreened',
    'test_pending',
    'test_sent',
    'test_in_progress',
    'test_submitted',
    'test_assessed',
    'negotiation',
    'staff_review',
    'approved',
    'rejected',
    'waitlisted',
    'archived',
    'info_requested'
  )),

  -- AI pre-screening results
  ai_prescreening_score       INTEGER CHECK (ai_prescreening_score BETWEEN 0 AND 100),
  ai_prescreening_result      JSONB,
  ai_prescreening_at          TIMESTAMPTZ,

  -- Tier assignment
  assigned_tier               VARCHAR(20) CHECK (assigned_tier IN ('standard', 'senior', 'expert')),
  tier_override_by            UUID REFERENCES staff_users(id),
  tier_override_at            TIMESTAMPTZ,

  -- Rate negotiation
  negotiation_status          VARCHAR(30) CHECK (negotiation_status IN (
    'not_needed',
    'pending',
    'offer_sent',
    'accepted',
    'countered',
    'counter_accepted',
    'staff_review',
    'agreed',
    'no_response'
  )),
  negotiation_log             JSONB DEFAULT '[]',
  final_agreed_rate           DECIMAL(10,2),
  negotiate_token             UUID UNIQUE,
  negotiate_token_expires_at  TIMESTAMPTZ,

  -- Staff review
  staff_review_notes          TEXT,
  staff_reviewed_by           UUID REFERENCES staff_users(id),
  staff_reviewed_at           TIMESTAMPTZ,

  -- Rejection
  rejection_reason            TEXT,
  rejection_email_draft       TEXT,
  rejection_email_status      VARCHAR(20) DEFAULT 'not_needed' CHECK (rejection_email_status IN (
    'not_needed',
    'queued',
    'sent',
    'intercepted'
  )),
  rejection_email_queued_at   TIMESTAMPTZ,

  -- Reapplication control
  can_reapply_after           DATE,

  -- Account link (FK added later in migration 008)
  translator_id               UUID,

  -- Waitlist
  waitlist_language_pair      VARCHAR(100),
  waitlist_notes              TEXT,

  -- Meta
  ip_address                  VARCHAR(45),
  user_agent                  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvp_applications_email ON cvp_applications(email);
CREATE INDEX IF NOT EXISTS idx_cvp_applications_status ON cvp_applications(status);
CREATE INDEX IF NOT EXISTS idx_cvp_applications_role_type ON cvp_applications(role_type);
CREATE INDEX IF NOT EXISTS idx_cvp_applications_created_at ON cvp_applications(created_at DESC);
