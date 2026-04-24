-- ============================================================================
-- T4: AI-generated library seeds for the remaining 15 testable domains
-- ============================================================================
--
-- T0 + T2 covered life_sciences, general, medical, legal, immigration. T4
-- adds the remaining domains so every selectable domain in
-- apps/recruitment/src/lib/domains.ts has at least intermediate-difficulty
-- coverage on the two forward language pairs (EN→FR, EN→FA).
--
-- Scope: 15 domains × 1 difficulty (intermediate) × 2 pairs = 30 rows.
-- source_text is INTENTIONALLY NULL — the cvp-seed-library-refs edge
-- function (extended in this session) generates source + reference. Rows
-- land is_active=false; the function flips them to true on success.
--
-- Skipped domains: certified_official (never tested — staff manual flow),
-- other (not a real domain).
--
-- Beginner + advanced for these domains are deferred to T5+ — staff can
-- add them via the same pipeline when applicants need them.
-- ============================================================================

BEGIN;

WITH pairs(src_id, tgt_id, label) AS (
  VALUES
    ('fde091d2-db5f-4e41-a490-7e15efc419e1'::uuid,
     'd972e8cc-519c-4446-9483-30da1346850c'::uuid,
     'EN→FA'),
    ('fde091d2-db5f-4e41-a490-7e15efc419e1'::uuid,
     '3f020964-31f9-4310-b632-a46fb629231a'::uuid,
     'EN→FR')
),
domains AS (
  -- (domain key, friendly title stem, instructions, MQM rubric)
  SELECT * FROM (VALUES
    ('pharmaceutical',
     'Pharmaceutical — Drug development brief',
     'Translate this pharmaceutical communication. Preserve all drug names (INN), dosages, units, and regulatory references exactly. Use the target country''s standard pharmacopoeia terminology. Adverse-event language should match the local regulatory body''s preferred phrasing.',
     '{"accuracy":0.35,"terminology":0.30,"fluency":0.15,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('financial',
     'Financial — Investor-facing report excerpt',
     'Translate this financial-services document. Preserve every numeric value, currency symbol, percentage, and fiscal-period notation exactly. Use the target locale''s standard accounting + investment vocabulary. Maintain the formal, regulator-aware register.',
     '{"accuracy":0.30,"terminology":0.30,"fluency":0.15,"style":0.15,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('insurance',
     'Insurance — Policy section / claim correspondence',
     'Translate this insurance document. Preserve policy reference numbers, coverage limits, exclusions, and dates exactly. Use the target country''s standard insurance terminology (covered peril, deductible, coinsurance, excess, etc. — match local convention). Maintain a contractually precise register.',
     '{"accuracy":0.30,"terminology":0.30,"fluency":0.15,"style":0.15,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('technical',
     'Technical — Equipment manual section',
     'Translate this technical documentation. Preserve all part numbers, model identifiers, units, and step numbering exactly. Use the target country''s standard engineering terminology. Imperative-mood instructions stay imperative; safety warnings retain the source''s emphasis (DANGER / WARNING / CAUTION) using local equivalents.',
     '{"accuracy":0.30,"terminology":0.30,"fluency":0.20,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('it_software',
     'IT & Software — Product release notes',
     'Translate this IT/software content. Preserve all version numbers, command names, file paths, and code snippets exactly — these stay in English. Translate UI strings using the target language''s established product-localisation conventions. Where a feature has a target-language name in the product''s existing localisation, use it.',
     '{"accuracy":0.25,"terminology":0.25,"fluency":0.20,"style":0.15,"locale":0.10,"design":0.00,"non_translation":0.05}'::jsonb),
    ('automotive_engineering',
     'Automotive — Service bulletin excerpt',
     'Translate this automotive/engineering document. Preserve VIN ranges, part numbers, torque specifications, units (Nm, lb-ft, mm, °C), and the original numbered procedure. Use the target country''s standard automotive vocabulary. Safety warnings retain their hazard-class wording.',
     '{"accuracy":0.30,"terminology":0.30,"fluency":0.20,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('energy',
     'Energy — Plant operations report',
     'Translate this energy-sector document. Preserve all SI units (MW, kWh, m³, bar, °C), measurement values, plant identifiers, and regulatory references exactly. Use the target country''s standard energy-sector vocabulary. Maintain a formal operational register.',
     '{"accuracy":0.30,"terminology":0.30,"fluency":0.15,"style":0.15,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('marketing_advertising',
     'Marketing — Brand campaign brief',
     'Transcreate this marketing copy — the goal is brand-on tone in the target language, not a literal rendering. Preserve numeric claims and product names; everything else may be reframed to land naturally with target-locale audiences. Respect the call-to-action structure of the source.',
     '{"accuracy":0.15,"terminology":0.10,"fluency":0.30,"style":0.30,"locale":0.10,"design":0.00,"non_translation":0.05}'::jsonb),
    ('literary_publishing',
     'Literary — Short narrative passage',
     'Translate this literary passage. Preserve narrative voice, register shifts, and rhetorical devices (alliteration, rhythm, imagery) using target-language equivalents of similar effect — not literal renderings. Idioms must be translated to idioms; figurative language stays figurative.',
     '{"accuracy":0.20,"terminology":0.05,"fluency":0.30,"style":0.35,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('academic_scientific',
     'Academic — Research paper abstract + methods',
     'Translate this academic/scientific text. Preserve all citations, reference numbers, units, statistical values (p-values, CIs, n=…), and methodology terminology exactly. Use the target language''s standard academic vocabulary for the field implied by the source text.',
     '{"accuracy":0.35,"terminology":0.30,"fluency":0.15,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('government_public',
     'Government — Public-sector notice',
     'Translate this government / public-sector communication. Preserve all official designations, statute / regulation references, dates, and reference numbers exactly. Use the target country''s formal administrative vocabulary. Maintain the impersonal, neutral register typical of public-sector writing.',
     '{"accuracy":0.30,"terminology":0.30,"fluency":0.15,"style":0.15,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('business_corporate',
     'Business — Internal corporate communication',
     'Translate this business communication. Preserve all proper nouns (company names, product names, division names), figures, and dates. Use the target language''s standard corporate register. Maintain hierarchical address conventions where the target language requires them.',
     '{"accuracy":0.25,"terminology":0.20,"fluency":0.20,"style":0.20,"locale":0.10,"design":0.00,"non_translation":0.05}'::jsonb),
    ('gaming_entertainment',
     'Gaming — In-game text / promotional copy',
     'Localise this gaming/entertainment content. UI elements, button labels, and tooltips need natural target-language equivalents. Character names + lore terms stay in source unless an established localisation exists. Marketing copy is more transcreation than translation.',
     '{"accuracy":0.20,"terminology":0.15,"fluency":0.25,"style":0.25,"locale":0.10,"design":0.00,"non_translation":0.05}'::jsonb),
    ('media_journalism',
     'Media — News article',
     'Translate this news article. Preserve direct quotes (translated, not transliterated), datelines, named entities (people, places, organisations), and the inverted-pyramid structure. Use the target outlet''s house style for date / number / name conventions. Headlines may be reframed for impact, never invented.',
     '{"accuracy":0.25,"terminology":0.15,"fluency":0.25,"style":0.25,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb),
    ('tourism_hospitality',
     'Tourism — Destination guide entry',
     'Translate this tourism / hospitality content. Place names, landmark names, and proper nouns stay in source on first mention with target-language explanation. Capture the source''s evocative tone — descriptive language should sing in the target language, not just convey facts.',
     '{"accuracy":0.20,"terminology":0.15,"fluency":0.30,"style":0.25,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb)
  ) AS d(domain, title_stem, instructions, rubric)
)
INSERT INTO cvp_test_library (
  id, title,
  source_language_id, target_language_id,
  domain, service_type, difficulty,
  source_text, instructions,
  reference_translation, ai_assessment_rubric,
  is_active, times_used
)
SELECT
  gen_random_uuid(),
  '[AI-DRAFT] ' || d.title_stem || ' (' || p.label || ')',
  p.src_id,
  p.tgt_id,
  d.domain,
  'domain_test',
  'intermediate',
  NULL,                  -- generated by cvp-seed-library-refs
  d.instructions,
  NULL,                  -- generated by cvp-seed-library-refs
  d.rubric,
  false,
  0
FROM domains d, pairs p
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification
SELECT domain, COUNT(*) AS rows_added
FROM cvp_test_library
WHERE title LIKE '[AI-DRAFT]%'
  AND domain NOT IN ('life_sciences','general','medical','legal','immigration')
GROUP BY domain
ORDER BY domain;
