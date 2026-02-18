-- CVP Test Library
-- Purpose: Staff-managed library of test documents for translator assessments
-- Dependencies: languages (shared CETHOS table)
-- Date: 2026-02-18

CREATE TABLE IF NOT EXISTS cvp_test_library (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                       VARCHAR(255) NOT NULL,

  -- Test categorisation
  source_language_id          UUID NOT NULL REFERENCES languages(id),
  target_language_id          UUID NOT NULL REFERENCES languages(id),
  domain                      VARCHAR(50) NOT NULL CHECK (domain IN (
    'legal', 'medical', 'immigration', 'financial', 'technical', 'general'
  )),
  service_type                VARCHAR(30) NOT NULL CHECK (service_type IN (
    'translation',
    'translation_review',
    'lqa_review'
  )),
  difficulty                  VARCHAR(20) NOT NULL CHECK (difficulty IN (
    'beginner', 'intermediate', 'advanced'
  )),

  -- Test content
  source_text                 TEXT,
  source_file_path            TEXT,
  instructions                TEXT,

  -- For translation and translation_review tests
  reference_translation       TEXT,

  -- For lqa_review tests
  lqa_source_translation      TEXT,
  lqa_answer_key              JSONB,

  -- MQM configuration
  mqm_dimensions_enabled      TEXT[] DEFAULT ARRAY[
    'accuracy', 'fluency', 'terminology',
    'style', 'locale_conventions', 'design', 'non_translation'
  ],

  -- AI assessment rubric
  ai_assessment_rubric        TEXT,

  -- Usage tracking
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  times_used                  INTEGER NOT NULL DEFAULT 0,
  last_used_at                TIMESTAMPTZ,
  total_pass_count            INTEGER NOT NULL DEFAULT 0,
  total_fail_count            INTEGER NOT NULL DEFAULT 0,

  -- Ownership
  created_by                  UUID REFERENCES staff_users(id),
  updated_by                  UUID REFERENCES staff_users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvp_test_library_language_domain ON cvp_test_library(
  source_language_id, target_language_id, domain, service_type
);
CREATE INDEX IF NOT EXISTS idx_cvp_test_library_active ON cvp_test_library(is_active);
