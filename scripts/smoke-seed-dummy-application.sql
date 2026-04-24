-- Smoke-test seed: one dummy application (APP-26-9900) with combinations
-- covering the domain-unit model:
--   - immigration      → uses existing Persian immigration library test
--   - life_sciences    → uses new Life Sciences EN→FA seed
--   - general          → baseline (no test yet; shows up as no_test_available)
--   - certified_official → skip_manual_review (never tested)
--
-- Also seeds one active EN→FA Immigration library test so the preview has
-- content to show. Idempotent on fixed UUIDs.

BEGIN;

-- ---- 1) Seed the EN→FA Immigration library test ----
INSERT INTO cvp_test_library (
  id, title,
  source_language_id, target_language_id,
  domain, service_type, difficulty,
  source_text, instructions, is_active
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'English → Persian (Farsi) — Immigration (birth certificate extract)',
  'fde091d2-db5f-4e41-a490-7e15efc419e1',
  'd972e8cc-519c-4446-9483-30da1346850c',
  'immigration',
  'domain_test',
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
  source_text = EXCLUDED.source_text,
  instructions = EXCLUDED.instructions,
  is_active = true,
  updated_at = now();

-- ---- 2) Dummy application (translator, status='prescreened') ----
INSERT INTO cvp_applications (
  id, application_number, role_type, email, full_name, country,
  status, ai_prescreening_score, ai_prescreening_result, ai_prescreening_at,
  domains_offered,
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
  ARRAY['immigration','life_sciences','certified_official']::text[],
  now()
)
ON CONFLICT (id) DO UPDATE SET
  status = 'prescreened',
  application_number = EXCLUDED.application_number,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  domains_offered = EXCLUDED.domains_offered,
  ai_prescreening_result = EXCLUDED.ai_prescreening_result,
  ai_prescreening_score = EXCLUDED.ai_prescreening_score,
  updated_at = now();

-- ---- 3) Combinations per (pair × domain) — new domain-unit shape ----
-- Cleanup any legacy rows from pre-rework seed runs so UNIQUE doesn't fight us.
DELETE FROM cvp_test_combinations
  WHERE application_id = '22222222-2222-4222-8222-222222222222';

INSERT INTO cvp_test_combinations (
  id, application_id, source_language_id, target_language_id,
  domain, service_type, status, is_baseline_general
)
VALUES
  ('33333333-3333-4333-8333-333333333333',
   '22222222-2222-4222-8222-222222222222',
   'fde091d2-db5f-4e41-a490-7e15efc419e1',
   'd972e8cc-519c-4446-9483-30da1346850c',
   'immigration', NULL, 'pending', false),
  ('33333333-3333-4333-8333-333333333334',
   '22222222-2222-4222-8222-222222222222',
   'fde091d2-db5f-4e41-a490-7e15efc419e1',
   'd972e8cc-519c-4446-9483-30da1346850c',
   'life_sciences', NULL, 'pending', false),
  ('33333333-3333-4333-8333-333333333335',
   '22222222-2222-4222-8222-222222222222',
   'fde091d2-db5f-4e41-a490-7e15efc419e1',
   'd972e8cc-519c-4446-9483-30da1346850c',
   'general', NULL, 'pending', true),
  ('33333333-3333-4333-8333-333333333336',
   '22222222-2222-4222-8222-222222222222',
   'fde091d2-db5f-4e41-a490-7e15efc419e1',
   'd972e8cc-519c-4446-9483-30da1346850c',
   'certified_official', NULL, 'skip_manual_review', false);

COMMIT;

-- Verification
SELECT domain, status, is_baseline_general
FROM cvp_test_combinations
WHERE application_id = '22222222-2222-4222-8222-222222222222'
ORDER BY is_baseline_general DESC, domain;
