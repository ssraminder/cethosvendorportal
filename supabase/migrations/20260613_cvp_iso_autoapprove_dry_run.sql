-- Recruitment §3.1.4 auto-approve scorer (dry-run). Mirrors the
-- qms_auto_qualification_* audit tables: every run + per-application decision
-- recorded with inputs, the AI extraction (verbatim quotes), and the
-- deterministic outcome. Dry-run only — nothing is approved.

CREATE TABLE public.cvp_iso_autoapprove_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run','live')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','aborted')),
  prompt_version text NOT NULL,
  model text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  application_count int,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid,
  created_by_label text NOT NULL DEFAULT 'system'
);

CREATE TABLE public.cvp_iso_autoapprove_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.cvp_iso_autoapprove_runs(id) ON DELETE CASCADE,
  application_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','error')),
  -- auto: ISO §3.1.4 met with documented evidence → eligible for auto-approve
  -- hitl: a route is plausible but evidence is self-declared/uncorroborated/flagged
  -- not_met: no §3.1.4 route even with evidence
  decision text CHECK (decision IN ('auto','hitl','not_met')),
  basis_code text,                  -- degree_translation | degree_other_plus_2y | experience_5y
  evidenced boolean,                -- true only when the basis rests on documented evidence
  confidence numeric,
  reasons text[],
  flags text[],
  inputs jsonb,
  extraction jsonb,
  error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, application_id)
);

CREATE INDEX idx_cvp_isoaa_run_status ON public.cvp_iso_autoapprove_results(run_id, status);
ALTER TABLE public.cvp_iso_autoapprove_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvp_iso_autoapprove_results ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.cvp_iso_autoapprove_runs TO service_role;
GRANT ALL ON public.cvp_iso_autoapprove_results TO service_role;
