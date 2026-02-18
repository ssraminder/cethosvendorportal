-- CVP Test Combinations
-- Purpose: One row per language pair + domain + service type per application
-- Dependencies: cvp_applications, languages (shared), staff_users (shared)
-- Date: 2026-02-18

CREATE TABLE IF NOT EXISTS cvp_test_combinations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID NOT NULL REFERENCES cvp_applications(id) ON DELETE CASCADE,

  -- Language pair and domain
  source_language_id    UUID NOT NULL REFERENCES languages(id),
  target_language_id    UUID NOT NULL REFERENCES languages(id),
  domain                VARCHAR(50) NOT NULL CHECK (domain IN (
    'legal', 'medical', 'immigration', 'financial', 'technical', 'general'
  )),
  service_type          VARCHAR(30) NOT NULL CHECK (service_type IN (
    'translation',
    'translation_review',
    'lqa_review'
  )),

  -- Test assignment
  test_id               UUID,
  test_submission_id    UUID,

  -- Status
  status                VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'no_test_available',
    'test_assigned',
    'test_sent',
    'test_submitted',
    'assessed',
    'approved',
    'rejected',
    'skipped'
  )),

  -- Assessment result
  ai_score              INTEGER CHECK (ai_score BETWEEN 0 AND 100),
  ai_assessment_result  JSONB,

  -- Approval
  approved_at           TIMESTAMPTZ,
  approved_by           UUID REFERENCES staff_users(id),
  approved_rate         DECIMAL(10,2),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate combinations per application
  UNIQUE(application_id, source_language_id, target_language_id, domain, service_type)
);

CREATE INDEX IF NOT EXISTS idx_cvp_test_combinations_application ON cvp_test_combinations(application_id);
CREATE INDEX IF NOT EXISTS idx_cvp_test_combinations_status ON cvp_test_combinations(status);
