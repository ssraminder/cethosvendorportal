-- Additional roles for the agency roster (COA/LV + transcription work Cethos does).
-- role_types feeds the roster role picker (via roster_reference_data) and the QMS
-- qualification registry. Additive; safe. Applied to prod via MCP 2026-06-19.
insert into qms.role_types (code, name, iso_clause_reference, description) values
  ('transcriber', 'Transcriber', 'Transcription (Cethos service)',
   'Produces verbatim/clean transcripts of audio/video source for downstream translation or analysis.'),
  ('cd_interviewer', 'Cognitive Debriefing Interviewer', 'COA/LV cognitive debriefing (ISPOR good practices)',
   'Conducts cognitive debriefing / patient interviews for clinical outcome assessment (COA) linguistic validation.'),
  ('clinical_reviewer', 'Clinician Reviewer', 'COA/LV clinician review (ISPOR good practices)',
   'Licensed clinician who reviews COA/LV translations and debriefing outputs for clinical accuracy and concept equivalence.')
on conflict (code) do nothing;
