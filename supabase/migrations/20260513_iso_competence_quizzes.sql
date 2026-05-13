-- ============================================================================
-- Phase 5b Slice 1 — ISO 17100 competence MCQ quizzes
--
-- Vendor takes a short MCQ quiz to prove a §6.1.2 competence the
-- assessment can't infer from documents alone. Auto-graded. Pass
-- threshold defaults to 80%; passed score feeds the next ISO
-- assessment as primary evidence for that competence.
--
-- Five competences covered by MCQ in this slice:
--   linguistic_textual_competence   — grammar / register / typography / punctuation
--   research_competence             — source reliability / terminology research
--   cultural_competence             — localisation scenarios / register-by-locale
--   technical_competence            — CAT tools / file formats / tag handling
--   domain_competence               — terminology + conventions (domain-agnostic
--                                     starter pool; per-domain pools added later
--                                     via the admin authoring UI)
--
-- translation_competence is covered by Slice 2 (real translation sample,
-- not MCQ).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.iso_competence_quizzes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competence_slug   text NOT NULL CHECK (competence_slug IN (
    'linguistic_textual_competence',
    'research_competence',
    'cultural_competence',
    'technical_competence',
    'domain_competence'
  )),
  domain            text,                -- nullable; set for per-domain domain_competence quizzes
  question          text NOT NULL,
  options           jsonb NOT NULL,      -- [{ value: 'a', label: '...' }, ...]
  correct_option    text NOT NULL,       -- the option's `value`
  explanation       text,                -- shown after submission for learning
  difficulty        text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_quizzes_competence_active
  ON public.iso_competence_quizzes (competence_slug, active)
  WHERE active = true;

COMMENT ON TABLE public.iso_competence_quizzes IS
  'Phase 5b Slice 1 — MCQ question bank for ISO 17100 §6.1.2 competence proof. Auto-graded.';

CREATE TABLE IF NOT EXISTS public.iso_competence_quiz_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  request_id          uuid REFERENCES public.vendor_document_requests(id) ON DELETE SET NULL,
  request_slug        text,                          -- the slug on requested_items[] this submission resolves
  competence_slug     text NOT NULL,
  domain              text,
  questions_asked     jsonb NOT NULL,                -- ordered list of quiz ids served
  answers             jsonb NOT NULL,                -- { [quiz_id]: 'a' | 'b' | ... }
  correct_count       int NOT NULL,
  total_count         int NOT NULL,
  score_pct           numeric(5,2) NOT NULL,
  threshold_pct       numeric(5,2) NOT NULL DEFAULT 80.00,
  passed              boolean NOT NULL,
  attempt_number      int NOT NULL DEFAULT 1,
  submitted_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_submissions_vendor_competence
  ON public.iso_competence_quiz_submissions (vendor_id, competence_slug, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_iso_submissions_request
  ON public.iso_competence_quiz_submissions (request_id)
  WHERE request_id IS NOT NULL;

COMMENT ON TABLE public.iso_competence_quiz_submissions IS
  'Phase 5b Slice 1 — vendor MCQ quiz attempts with auto-graded scores. Feeds ISO assessment as primary evidence per competence when passed.';

-- updated_at trigger reuses set_updated_at() if it exists from earlier migrations.
DROP TRIGGER IF EXISTS trg_iso_competence_quizzes_updated_at ON public.iso_competence_quizzes;
CREATE TRIGGER trg_iso_competence_quizzes_updated_at
  BEFORE UPDATE ON public.iso_competence_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
