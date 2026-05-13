-- ============================================================================
-- Phase 5a — Reference-based competence attestation
--
-- Adds a structured `competence_responses` jsonb column to both
-- reference tables so references answer anchored MCQs per ISO 17100
-- §6.1.2 competence instead of just a free-text rating.
--
-- Shape per row:
--   {
--     "translation_competence":        "a" | "b" | "c" | "d" | "e",
--     "linguistic_textual_competence": "a" | "b" | "c" | "d" | "e",
--     "research_competence":           "a" | "b" | "c" | "d" | "e",
--     "cultural_competence":           "a" | "b" | "c" | "d" | "e",
--     "technical_competence":          "a" | "b" | "c" | "d" | "e",
--     "domain_competence":             "a" | "b" | "c" | "d" | "e",
--     "domain_specialty":              "legal" | "medical" | ... | null,
--     "would_work_again":              "yes" | "probably" | "probably_not" | "no"
--   }
--
-- (a) = best, (d) = worst, (e) = can't speak to this.
-- ============================================================================

ALTER TABLE public.cvp_application_references
  ADD COLUMN IF NOT EXISTS competence_responses jsonb;

ALTER TABLE public.vendor_references
  ADD COLUMN IF NOT EXISTS competence_responses jsonb;

COMMENT ON COLUMN public.cvp_application_references.competence_responses IS
  'Phase 5a — anchored MCQ responses per ISO 17100 §6.1.2 competence. Reference answers a/b/c/d/e per competence (e = can''t speak to this). Feeds the ISO assessment as primary evidence.';

COMMENT ON COLUMN public.vendor_references.competence_responses IS
  'Phase 5a — anchored MCQ responses per ISO 17100 §6.1.2 competence. Reference answers a/b/c/d/e per competence (e = can''t speak to this). Feeds the ISO assessment as primary evidence.';
