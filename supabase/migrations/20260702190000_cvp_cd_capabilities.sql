-- CD enrichment capture
--
-- Structured storage of cognitive-debriefing capability data extracted from
-- applicant / agency replies to the vendor-info-request outreach
-- (cvp-request-vendor-info). Rows are populated by cvp-extract-cd-capabilities,
-- which runs a schema-constrained Opus pass over each threaded reply.
--
-- One row per application, MERGED across multiple replies (vendors often answer
-- in 2-3 emails). AI-extracted values are PROPOSALS: a staff-verified row
-- (needs_review=false) is never overwritten by re-extraction.

CREATE TABLE IF NOT EXISTS cvp_cd_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES cvp_applications(id) ON DELETE CASCADE,
  -- Populated post-approval. No FK: keep this cvp_ table decoupled from the
  -- CETHOS-core vendors table per project boundary rules.
  vendor_id uuid,

  -- ── Rate structure ──
  rate_model text[] NOT NULL DEFAULT '{}',   -- per_hour | per_interview | per_project | flat
  rate_details jsonb,                        -- [{ amount, currency, unit, varies_by }]

  -- ── Recruitment capability (dimensions the application form never captured) ──
  recruits_participants boolean,
  recruits_patients boolean,
  recruits_general_population boolean,
  recruit_countries text[] NOT NULL DEFAULT '{}',
  recruit_languages text[] NOT NULL DEFAULT '{}',

  -- ── Formats & capacity ──
  focus_group_experience boolean,
  interview_languages text[] NOT NULL DEFAULT '{}',
  capacity_per_week integer,
  report_turnaround_days integer,
  interviewer_bench_count integer,           -- agencies only

  -- ── Extraction provenance ──
  field_confidence jsonb,                    -- { field: 0..1 }
  overall_confidence numeric,
  unanswered text[] NOT NULL DEFAULT '{}',
  raw_answers jsonb,                         -- full extraction payload, for audit
  notes_for_staff text,
  source_inbound_email_ids uuid[] NOT NULL DEFAULT '{}',
  last_extracted_at timestamptz,
  extracted_by_model text,

  -- ── Recommendation (deterministic rules over the extracted fields) ──
  recommended_next_action text,              -- advance_to_cd_pool | prioritize_patient_recruiter
                                             -- | request_clarification | staff_review
  capability_tags text[] NOT NULL DEFAULT '{}', -- patient_recruiter | focus_group | interview_only ...

  -- ── Human verification ──
  needs_review boolean NOT NULL DEFAULT true,
  verified_by_staff_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  verified_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_cvp_cd_capabilities_application UNIQUE (application_id)
);

CREATE INDEX IF NOT EXISTS idx_cvp_cd_capabilities_patients
  ON cvp_cd_capabilities (recruits_patients) WHERE recruits_patients = true;
CREATE INDEX IF NOT EXISTS idx_cvp_cd_capabilities_focus_group
  ON cvp_cd_capabilities (focus_group_experience) WHERE focus_group_experience = true;
CREATE INDEX IF NOT EXISTS idx_cvp_cd_capabilities_needs_review
  ON cvp_cd_capabilities (needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_cvp_cd_capabilities_vendor
  ON cvp_cd_capabilities (vendor_id) WHERE vendor_id IS NOT NULL;

ALTER TABLE cvp_cd_capabilities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cvp_cd_capabilities'
      AND policyname='Staff can read cd capabilities'
  ) THEN
    CREATE POLICY "Staff can read cd capabilities"
      ON cvp_cd_capabilities FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cvp_cd_capabilities'
      AND policyname='Staff can update cd capabilities'
  ) THEN
    CREATE POLICY "Staff can update cd capabilities"
      ON cvp_cd_capabilities FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = true));
  END IF;
END $$;
-- INSERT is service-role only (via cvp-extract-cd-capabilities). No authenticated INSERT policy.

COMMENT ON TABLE cvp_cd_capabilities IS
  'Structured cognitive-debriefing capability data extracted from vendor-info-request email replies. One row per application, merged across replies. AI-extracted fields are proposals until staff verify (needs_review=false), after which re-extraction leaves verified rows untouched.';

-- Idempotency marker: the extractor sweep stamps each inbound reply once it has
-- folded it into cvp_cd_capabilities, so re-runs skip already-processed replies.
ALTER TABLE cvp_inbound_emails
  ADD COLUMN IF NOT EXISTS cd_enrichment_processed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cvp_inbound_cd_unprocessed
  ON cvp_inbound_emails (received_at)
  WHERE cd_enrichment_processed_at IS NULL;
