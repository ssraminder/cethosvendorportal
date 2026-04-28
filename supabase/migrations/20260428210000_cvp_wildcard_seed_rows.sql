-- ============================================================================
-- Wildcard test library seeds — EN→Target (any target)
-- ============================================================================
--
-- Inserts 240 empty rows: 20 testable domains × 3 difficulties × 4 versions.
-- Each row has source_language_id=English, target_language_id=NULL (wildcard),
-- source_text=NULL, reference_translation=NULL, is_active=false.
--
-- cvp-seed-library-refs picks them up, drafts a ≤250-word English source via
-- Sonnet (MODEL_BASELINE), flips is_active=true on success. No reference is
-- generated for wildcard rows — cvp-assess-test handles NULL references.
--
-- 4 versions per (domain × difficulty) get distinct title-stem hints so the
-- model produces variety; cvp-send-tests rotates by times_used ASC, so each
-- new applicant gets the least-used variant.
--
-- Skipped domains: certified_official (staff manual flow), other (not real).
-- ============================================================================

BEGIN;

WITH domains AS (
  -- (domain key, beginner instructions, intermediate instructions, advanced instructions)
  SELECT * FROM (VALUES
    ('general',
     'Translate this short English passage into the target language. Keep the warm, conversational tone. Render idioms naturally, not literally.',
     'Translate this English passage into the target language. Maintain the original register and any subtle tone shifts. Use the target language''s standard terminology for any institutional or programme names.',
     'Translate this English passage into the target language. Preserve the author''s argumentative voice — irony, hedged claims, rhetorical asks must come through in idiomatic target-language form.'),
    ('legal',
     'Translate this short legal passage. Preserve numbering, dates, and any defined terms (capitalised) exactly. Use the target jurisdiction''s standard legal vocabulary.',
     'Translate this legal passage. Preserve all numeric values, dates, and defined terms exactly. Use the target jurisdiction''s equivalent legal-doctrine phrasing rather than literal renderings.',
     'Translate this legal passage. Latin terms stay in Latin unless the target jurisdiction''s convention is otherwise. All citations, party names, and clause numbering remain unchanged.'),
    ('medical',
     'Translate this short medical passage. Preserve numeric values, units, and drug names (use INN form). Use the target country''s standard clinical terminology.',
     'Translate this medical passage. Preserve all dosages, units, and abbreviations exactly. Drug names stay in their international non-proprietary (INN) form. Match the target country''s pharmacopoeia.',
     'Translate this medical passage. Clinical terms must use the target country''s standard medical vocabulary. Preserve every numeric value, unit, lab abbreviation, and acronym exactly.'),
    ('immigration',
     'Translate this immigration document into the target language. Names, dates, and addresses stay unchanged. Use the target country''s standard formal-letter conventions.',
     'Translate this immigration document. All exhibit references, dates, and party names stay exactly as written. Use the target country''s equivalent of formal affidavit language.',
     'Translate this immigration legal document. Case numbers, regulatory citations, exhibit numbers, and party names stay exact. Standard immigration-law terminology uses the target language''s established translation if one exists.'),
    ('life_sciences',
     'Translate this short life-sciences passage. Preserve any drug names, dosages, units, and section headings exactly. Maintain a regulatory-compliant register.',
     'Translate this life-sciences passage. Regulatory phrases must use the target country''s officially accepted terms. Protocol identifiers, sponsor names, and dates stay unchanged.',
     'Translate this clinical passage. Preserve every numeric value, unit, lab abbreviation (g/dL, ULN, IGRA, etc.) exactly. Clinical terms use the target country''s national pharmacopoeia.'),
    ('pharmaceutical',
     'Translate this short pharmaceutical text. Drug names stay in INN form; dosages and units stay exact. Use the target country''s pharmacopoeia terminology.',
     'Translate this pharmaceutical document. Preserve drug names (INN), dosages, units, and regulatory references exactly. Adverse-event language matches the local regulatory body''s preferred phrasing.',
     'Translate this pharmaceutical document. All drug names, dosages, units, and regulatory acronyms preserved verbatim. Use the target country''s standard pharmacovigilance terminology.'),
    ('financial',
     'Translate this short financial text. Preserve every numeric value, currency symbol, percentage, and fiscal-period notation exactly.',
     'Translate this financial document. Preserve every numeric value, currency symbol, percentage, and fiscal-period notation. Use the target locale''s standard accounting and investment vocabulary.',
     'Translate this financial document. Maintain a regulator-aware register. All numbers, currencies, fiscal-period notations, and disclosure phrasing stay exact.'),
    ('insurance',
     'Translate this short insurance text. Preserve policy reference numbers, coverage limits, and dates exactly. Use the target country''s standard insurance terminology.',
     'Translate this insurance document. Preserve policy reference numbers, coverage limits, exclusions, and dates. Use the target country''s standard insurance terminology (deductible, excess, etc.).',
     'Translate this insurance document. Maintain a contractually precise register. All numeric values, exclusions, and contract references stay exact. Use the target country''s standard insurance vocabulary.'),
    ('technical',
     'Translate this short technical passage. Preserve all part numbers, model identifiers, units, and step numbering exactly. Imperative-mood instructions stay imperative.',
     'Translate this technical documentation. Preserve all part numbers, model identifiers, units, and step numbering. Use the target country''s standard engineering terminology.',
     'Translate this technical document. Safety warnings retain the source''s emphasis (DANGER / WARNING / CAUTION) using local equivalents. All identifiers, units, and step numbering stay exact.'),
    ('it_software',
     'Translate this short IT/software text. Preserve version numbers, command names, file paths, and code snippets exactly — these stay in English.',
     'Translate this IT/software content. Preserve all version numbers, command names, file paths, and code snippets exactly. Translate UI strings using the target language''s established product-localisation conventions.',
     'Translate this technical software documentation. All code, version numbers, paths, and command names stay in English. UI strings use the target language''s established product-localisation conventions.'),
    ('automotive_engineering',
     'Translate this short automotive text. Preserve VIN ranges, part numbers, torque specifications, and units (Nm, mm, °C) exactly.',
     'Translate this automotive/engineering document. Preserve VIN ranges, part numbers, torque specifications, units, and the original numbered procedure. Use the target country''s standard automotive vocabulary.',
     'Translate this automotive engineering document. Safety warnings retain their hazard-class wording. All part numbers, units, and procedural steps stay exact. Use OEM-standard target-language terminology.'),
    ('energy',
     'Translate this short energy-sector text. Preserve units (MW, kWh, bbl), regulatory references, and project names exactly.',
     'Translate this energy-sector document. Preserve units (MW, kWh, bbl), regulatory references, and project names. Use the target country''s standard energy-industry vocabulary.',
     'Translate this energy-sector document. Regulatory and environmental terminology uses the target country''s official terms. All units, technical specifications, and project identifiers stay exact.'),
    ('marketing_advertising',
     'Translate this short marketing copy. Preserve brand names. Render idioms and hooks idiomatically in the target language — local resonance matters more than literal accuracy.',
     'Translate this marketing copy. Brand names stay unchanged. Render the persuasive hook with target-language idiomatic punch — transcreation over literal translation where appropriate.',
     'Translate this marketing copy. Brand voice and rhetorical devices (alliteration, rhythm, callbacks) must come through. Transcreate idioms and slogans rather than translate literally.'),
    ('literary_publishing',
     'Translate this short literary passage. Preserve narrative voice and rhythm. Idioms render naturally in the target language; do not over-explain.',
     'Translate this literary passage. Preserve narrative voice, rhythm, and any deliberate ambiguity. Cultural references render with the closest target-language analogue, not a literal translation.',
     'Translate this literary passage. Authorial voice, register shifts, and any deliberate ambiguity must come through. Idioms and cultural references render with the closest target-language analogue.'),
    ('academic_scientific',
     'Translate this short academic passage. Preserve citation formatting, numeric values, and discipline-specific terms exactly.',
     'Translate this academic passage. Preserve citation formatting, statistical notation, and discipline-specific vocabulary. Match the target language''s academic register.',
     'Translate this academic passage. Discipline-specific terminology uses the target language''s standard academic vocabulary. All citations, equations, and statistical notation stay exact.'),
    ('government_public',
     'Translate this short government/public-sector text. Preserve programme names, statute references, and dates exactly. Use plain-language register where the source does.',
     'Translate this public-sector document. Preserve programme names, statute references, and dates. Use the target country''s equivalent administrative-language conventions.',
     'Translate this government document. Statute citations, programme names, and official titles use the target jurisdiction''s standard equivalent. Maintain a formal administrative register throughout.'),
    ('business_corporate',
     'Translate this short business communication. Preserve company names, monetary figures, and dates exactly. Use the target language''s business-formal register.',
     'Translate this business document. Preserve company names, monetary figures, dates, and any defined terms. Use the target language''s standard corporate vocabulary.',
     'Translate this business document. Corporate-governance terminology uses the target language''s standard equivalent. All financial figures, dates, and stakeholder references stay exact.'),
    ('gaming_entertainment',
     'Translate this short gaming/entertainment text. Preserve character names, item names, and game-specific terms (where established target-language localisations exist, use them).',
     'Translate this gaming/entertainment text. Character and item names use the target language''s established game localisation if one exists; otherwise transliterate. Match the in-game register (casual, dramatic, etc.).',
     'Translate this gaming/entertainment text. Lore terms, in-universe vocabulary, and game-specific jargon use the target language''s established localisation. Voice and register match the in-game speaker.'),
    ('media_journalism',
     'Translate this short news/journalism passage. Preserve named places, named individuals, and direct quotations exactly. Match the target language''s news-style conventions.',
     'Translate this journalism passage. Direct quotations stay attributed and translated in full — no summarising. Named places use established target-language exonyms.',
     'Translate this journalism feature. Direct quotations translate in full with attribution. Named places use established target-language exonyms. Authorial voice and editorial framing must come through.'),
    ('tourism_hospitality',
     'Translate this short tourism/hospitality text. Preserve venue names, addresses, and prices exactly. Match the target language''s travel-marketing register.',
     'Translate this tourism/hospitality document. Venue names, addresses, prices, and dates stay exact. Use the target language''s travel-marketing register and culturally appropriate descriptors.',
     'Translate this tourism/hospitality document. Cultural references use established target-language equivalents. All venue names, addresses, prices, and dates stay exact. Match local travel-marketing conventions.')
  ) AS d(domain, instr_beg, instr_int, instr_adv)
),
content_types AS (
  -- 4 distinct content-type hints per domain, used as title-stems so Sonnet
  -- produces visibly different content across versions. Difficulty doesn't
  -- change the content type — same hint at all 3 difficulties.
  SELECT * FROM (VALUES
    ('general',                'Personal letter',                'Workplace memo',                  'Op-ed column',                       'Customer service email'),
    ('legal',                  'Lease clause',                   'Terms-of-service section',        'Motion brief excerpt',               'NDA mutual provision'),
    ('medical',                'Patient information leaflet',    'Cardiology consultation report',  'Discharge summary',                  'Lab results narrative'),
    ('immigration',            'Personal statement letter',      'Affidavit of support',            'Response to Request for Evidence',   'Appeal letter to tribunal'),
    ('life_sciences',          'Patient information leaflet',    'Informed consent form',           'Study protocol criteria',            'Adverse event narrative'),
    ('pharmaceutical',         'Drug brochure for prescribers',  'Regulatory submission excerpt',   'Safety data sheet section',          'Patient package insert'),
    ('financial',              'Quarterly earnings highlight',   'Audit memorandum',                'Prospectus risk factors',            'Investor letter'),
    ('insurance',              'Policy coverage section',        'Claim correspondence',            'Denial appeal letter',               'Underwriting memo'),
    ('technical',              'Equipment manual section',       'Safety bulletin',                 'Maintenance procedure',              'Installation guide step'),
    ('it_software',            'Product release notes',          'API documentation snippet',       'EULA section',                       'Error message catalogue'),
    ('automotive_engineering', 'Service bulletin excerpt',       'Repair procedure',                'Recall notice',                      'Specification sheet'),
    ('energy',                 'Regulatory filing excerpt',      'Safety procedure',                'Environmental impact summary',       'Project status brief'),
    ('marketing_advertising',  'Landing page copy',              'Email campaign copy',             'Brochure body copy',                 'Social ad headline set'),
    ('literary_publishing',    'Novel excerpt',                  'Short story opening',             'Personal essay',                     'Book review'),
    ('academic_scientific',    'Paper abstract',                 'Methods section',                 'Literature review paragraph',        'Conference presentation summary'),
    ('government_public',      'Public notice',                  'Policy memo',                     'Regulatory guidance excerpt',        'Citizen advisory letter'),
    ('business_corporate',     'Press release',                  'Internal staff memo',             'Vendor proposal section',            'Investor update'),
    ('gaming_entertainment',   'In-game dialogue scene',         'Achievement description set',     'Tutorial walkthrough text',          'Lore codex entry'),
    ('media_journalism',       'News lead paragraph',            'Editorial opinion',               'Feature pitch summary',              'Fact-check note'),
    ('tourism_hospitality',    'Hotel description',              'Tour itinerary brochure',         'Restaurant menu blurb',              'Travel guide section')
  ) AS c(domain, v1, v2, v3, v4)
),
expanded AS (
  SELECT
    d.domain,
    diff.difficulty,
    CASE diff.difficulty
      WHEN 'beginner' THEN d.instr_beg
      WHEN 'intermediate' THEN d.instr_int
      WHEN 'advanced' THEN d.instr_adv
    END AS instructions,
    ver.version,
    CASE ver.version
      WHEN 1 THEN c.v1
      WHEN 2 THEN c.v2
      WHEN 3 THEN c.v3
      WHEN 4 THEN c.v4
    END AS content_type,
    CASE diff.difficulty
      WHEN 'beginner'     THEN '{"accuracy":0.25,"terminology":0.20,"fluency":0.25,"style":0.15,"locale":0.10,"design":0.00,"non_translation":0.05}'::jsonb
      WHEN 'intermediate' THEN '{"accuracy":0.30,"terminology":0.25,"fluency":0.20,"style":0.15,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb
      WHEN 'advanced'     THEN '{"accuracy":0.35,"terminology":0.30,"fluency":0.15,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb
    END AS rubric
  FROM domains d
  JOIN content_types c ON c.domain = d.domain
  CROSS JOIN (VALUES ('beginner'), ('intermediate'), ('advanced')) AS diff(difficulty)
  CROSS JOIN (VALUES (1),(2),(3),(4)) AS ver(version)
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
  '[AI-DRAFT] ' || e.domain || ' v' || e.version || ' — ' || e.content_type || ' (' || e.difficulty || ')',
  'fde091d2-db5f-4e41-a490-7e15efc419e1'::uuid,  -- English
  NULL,                                            -- wildcard target
  e.domain,
  'domain_test',
  e.difficulty,
  NULL,                                            -- generated by cvp-seed-library-refs
  e.instructions,
  NULL,                                            -- not generated for wildcard rows
  e.rubric,
  false,                                           -- flipped to true after AI generation
  0
FROM expanded e
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification: should return 240 rows total (20 domains × 3 difficulties × 4 versions)
SELECT COUNT(*) AS total_rows,
       COUNT(DISTINCT domain) AS domains,
       COUNT(DISTINCT difficulty) AS difficulties
FROM cvp_test_library
WHERE target_language_id IS NULL
  AND title LIKE '[AI-DRAFT]%';
