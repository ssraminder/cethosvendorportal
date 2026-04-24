-- Smoke-test seed: one active library test + one dummy application + one
-- combination. Idempotent: re-running this script WILL NOT duplicate — it
-- upserts on deterministic keys.
--
-- Values used (look these up with `SELECT id, code FROM languages`):
--   English           = fde091d2-db5f-4e41-a490-7e15efc419e1
--   Persian (Farsi)   = d972e8cc-519c-4446-9483-30da1346850c
--
-- Application number chosen outside the auto-sequence (APP-26-9900) so
-- rerunning the seed always hits the same row.

BEGIN;

-- ---- 1) Seed an active EN→FA Immigration standard_translation test ----
INSERT INTO cvp_test_library (
  id,
  title,
  source_language_id,
  target_language_id,
  domain,
  service_type,
  difficulty,
  source_text,
  instructions,
  is_active
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'English → Persian (Farsi) — Immigration (birth certificate extract)',
  'fde091d2-db5f-4e41-a490-7e15efc419e1',
  'd972e8cc-519c-4446-9483-30da1346850c',
  'immigration',
  'standard_translation',
  'intermediate',
  $TEST$CERTIFICATE OF LIVE BIRTH

This is to certify that the following information has been duly registered with the Office of the Registrar General of Births, Deaths and Marriages.

Name of Child: Leila Hosseini
Date of Birth: March 14, 1992
Place of Birth: Toronto, Ontario, Canada
Sex: Female

Father: Reza Hosseini, born July 22, 1958 in Tehran, Iran, Canadian citizen by grant dated November 3, 1985.
Mother: Maryam Ahmadi, born September 10, 1962 in Isfahan, Iran, Canadian citizen by grant dated November 3, 1985.

This certificate is issued in accordance with the Vital Statistics Act and is a true extract of the entry in the Register of Births maintained by the Registrar General.

Issued at: Toronto, Ontario
Date of Issue: April 12, 2024
Registrar General's Signature: [signed]
Official Seal: [affixed]$TEST$,
  'Translate the above Canadian birth certificate extract into Persian (Farsi) suitable for submission to an Iranian government authority. Preserve all formal formatting (headings, colons, signature lines). Do not transliterate the Persian names back to Latin script — use the correct Persian spellings. Include a brief translator''s note flagging any element you cannot render without additional context.',
  true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  source_text = EXCLUDED.source_text,
  instructions = EXCLUDED.instructions,
  is_active = true,
  updated_at = now();


-- ---- 2) Dummy application (status='prescreened' so SendTestsControls renders) ----
INSERT INTO cvp_applications (
  id,
  application_number,
  role_type,
  email,
  full_name,
  country,
  status,
  ai_prescreening_score,
  ai_prescreening_result,
  ai_prescreening_at,
  created_at
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'APP-26-9900',
  'translator',
  'ss.raminder@gmail.com',
  'SMOKE TEST — Dummy Applicant',
  'Canada',
  'prescreened',
  78,
  jsonb_build_object(
    'suggested_test_difficulty', 'intermediate',
    'summary', 'Synthetic smoke-test application; pre-screen values are stubbed.',
    'red_flags', jsonb_build_array(),
    'green_flags', jsonb_build_array('Seeded by smoke-seed-dummy-application.sql')
  ),
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  status = 'prescreened',
  application_number = EXCLUDED.application_number,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  ai_prescreening_result = EXCLUDED.ai_prescreening_result,
  ai_prescreening_score = EXCLUDED.ai_prescreening_score,
  updated_at = now();


-- ---- 3) Pending combination matching the seeded library test ----
INSERT INTO cvp_test_combinations (
  id,
  application_id,
  source_language_id,
  target_language_id,
  domain,
  service_type,
  status
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'fde091d2-db5f-4e41-a490-7e15efc419e1',
  'd972e8cc-519c-4446-9483-30da1346850c',
  'immigration',
  'standard_translation',
  'pending'
)
ON CONFLICT (id) DO UPDATE SET
  status = 'pending',
  test_id = NULL,
  test_submission_id = NULL,
  updated_at = now();

COMMIT;

-- Verification
SELECT
  'library' AS kind,
  id::text AS id,
  title AS detail,
  is_active::text AS flag
FROM cvp_test_library WHERE id = '11111111-1111-4111-8111-111111111111'
UNION ALL
SELECT
  'application',
  id::text,
  application_number || ' — ' || full_name,
  status
FROM cvp_applications WHERE id = '22222222-2222-4222-8222-222222222222'
UNION ALL
SELECT
  'combination',
  id::text,
  domain || ' / ' || service_type,
  status
FROM cvp_test_combinations WHERE id = '33333333-3333-4333-8333-333333333333';
