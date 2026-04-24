-- ============================================================================
-- Life Sciences test library seeds (T0)
-- ============================================================================
--
-- Context: T0 of the test-per-domain rework ships real, usable Life Sciences
-- content in cvp_test_library. Reference translations are Opus-drafted after
-- this migration by the cvp-seed-library-refs edge function (idempotent; safe
-- to re-run). Rows land as is_active=false and flip to true once the function
-- completes; failures leave them inactive with a captured error message.
--
-- Scope: 6 rows = 3 difficulties × 2 forward pairs (EN→FR, EN→FA). Reverse
-- directions (FR→EN, FA→EN) are deferred to T2 when cvp-seed-library-refs
-- is extended to also synthesise source_text in the source language.
--
-- Content: three fully synthesised English source texts (no copyright
-- concerns). Difficulty labels must match cvp_test_library CHECK:
-- 'beginner' | 'intermediate' | 'advanced'.
--   beginner     = Patient Information Leaflet excerpt (~500w, consumer-facing)
--   intermediate = Informed Consent Form excerpt (~650w, regulatory + patient)
--   advanced     = Study Protocol inclusion/exclusion criteria (~700w)
--
-- Language IDs are pinned to known UUIDs. Values below must match the
-- languages table — if they drift, the migration will fail cleanly on FK.
-- ============================================================================

BEGIN;

-- ---- Prep: add an error column that cvp-seed-library-refs writes to ----
ALTER TABLE cvp_test_library
  ADD COLUMN IF NOT EXISTS ai_generation_error text;

COMMENT ON COLUMN cvp_test_library.ai_generation_error IS
  'Populated by cvp-seed-library-refs when Opus fails to generate the reference_translation or source_text for this row. Keeps row is_active=false so admin UI knows to fix manually. NULL on success.';


-- ---- Seed rows ----
WITH pairs(src_id, tgt_id, label) AS (
  -- Only forward pairs shipped in T0. Reverse directions land in T2.
  VALUES
    ('fde091d2-db5f-4e41-a490-7e15efc419e1'::uuid,  -- English
     'd972e8cc-519c-4446-9483-30da1346850c'::uuid,  -- Persian (Farsi)
     'EN→FA'),
    ('fde091d2-db5f-4e41-a490-7e15efc419e1'::uuid,  -- English
     '3f020964-31f9-4310-b632-a46fb629231a'::uuid,  -- French
     'EN→FR')
),
sources AS (
  SELECT
    'beginner'::text AS difficulty,
    'Patient Information Leaflet — Cetrimide Oral Rinse 0.1% w/v'::text AS title_stem,
    $PIL$PATIENT INFORMATION LEAFLET

Cetrimide Oral Rinse 0.1% w/v
Please read this leaflet carefully before you start using this medicine. Keep this leaflet, you may need to read it again. If you have any further questions, ask your pharmacist or doctor.

1. WHAT CETRIMIDE ORAL RINSE IS AND WHAT IT IS USED FOR

Cetrimide Oral Rinse is an antiseptic mouthwash. It is used to help prevent and treat minor gum inflammation (gingivitis), mouth ulcers, and minor infections inside the mouth. It may also be recommended by your dentist after certain dental procedures to help keep the area clean while it heals.

2. BEFORE YOU USE CETRIMIDE ORAL RINSE

Do not use Cetrimide Oral Rinse if you are allergic (hypersensitive) to cetrimide or any of the other ingredients listed in section 6.

Take special care and speak to your pharmacist or doctor before use if you:
- have been told by a dentist or doctor that you have open sores in the mouth that bleed easily;
- have a sore throat that lasts more than three days, or is accompanied by fever or a rash;
- are under 12 years of age — this product is not recommended for children under 12 without medical advice;
- are pregnant or breastfeeding.

Tell your dentist or doctor if you are taking any other medicines, including those bought without a prescription.

3. HOW TO USE CETRIMIDE ORAL RINSE

Adults and children over 12: rinse the mouth thoroughly with 10 ml of the solution for about 30 seconds, then spit out. Do not swallow. Use up to three times a day, after meals and before bedtime. Do not eat or drink for 30 minutes after rinsing.

Do not use for more than 14 consecutive days without speaking to a pharmacist or doctor.

If you accidentally swallow a large amount, contact your local poison information centre or seek medical advice.

4. POSSIBLE SIDE EFFECTS

Like all medicines, Cetrimide Oral Rinse can cause side effects, although not everyone gets them. Stop using the rinse and tell your doctor immediately if you notice: swelling of the face, lips, tongue or throat; difficulty breathing; or a severe skin rash.

Less serious side effects may include temporary staining of the teeth and tongue, altered taste, or a mild burning sensation in the mouth. These usually go away when you stop using the product.

5. HOW TO STORE CETRIMIDE ORAL RINSE

Keep out of the reach and sight of children. Do not use after the expiry date printed on the bottle. Store below 25°C. Do not refrigerate. Do not use if the solution becomes cloudy or changes colour.

6. FURTHER INFORMATION

Active ingredient: cetrimide 0.1% w/v. Other ingredients: purified water, glycerol, sodium saccharin, peppermint flavour, colour E133.

If you have any questions, speak to your pharmacist.$PIL$::text AS source_text,
    $INST$Translate this consumer-facing patient information leaflet into the target language. Requirements:
- Maintain grade-8 readability — patients read this without medical training.
- Preserve every section heading (1–6) and every bullet.
- Do NOT translate measurement units (ml, °C), the brand name "Cetrimide Oral Rinse", or the colour code "E133".
- Regulatory phrases ("pharmacist or doctor", "expiry date", "keep out of reach") must use the target country's accepted equivalents.
- Flag any source ambiguity in a brief translator's note at the end (under "Translator Notes:").
- Do NOT add, remove, or summarise content.$INST$::text AS instructions,
    '{"accuracy":0.35,"terminology":0.25,"fluency":0.20,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb AS rubric

  UNION ALL

  SELECT
    'intermediate',
    'Informed Consent Form — Phase 2 study of investigational anti-inflammatory therapy',
    $ICF$INFORMED CONSENT FORM

Protocol: XRV-204
Title: A Phase 2, Randomised, Double-Blind, Placebo-Controlled Study Evaluating the Safety and Preliminary Efficacy of XRV-204 in Adults with Moderate-to-Severe Chronic Inflammatory Dermatitis
Sponsor: Arvenex Therapeutics Ltd.
Version: 3.0 dated 15 March 2025

INTRODUCTION

You are being invited to take part in a clinical research study. Before you decide whether to participate, it is important that you understand why the research is being done and what it will involve. Please take time to read the following information carefully. Discuss it with your family, friends, or doctor if you wish. Ask the study team to explain anything that is not clear to you.

PURPOSE OF THE STUDY

The purpose of this study is to find out whether an investigational medicine called XRV-204 is safe and effective at reducing the symptoms of chronic inflammatory dermatitis in adults. "Investigational" means that XRV-204 is still being studied and has not yet been approved for use by health authorities.

Approximately 240 participants at up to 30 study sites in North America, Europe, and Asia-Pacific will take part.

WHY YOU HAVE BEEN ASKED

You are being invited because you are an adult between the ages of 18 and 70 who has been diagnosed with moderate-to-severe chronic inflammatory dermatitis that has not responded adequately to at least one prior topical treatment. Your study doctor will confirm whether you meet all of the eligibility criteria.

WHAT WILL HAPPEN IF YOU TAKE PART

The study will last approximately 28 weeks. After an initial screening visit, you will be assigned by chance (like the flip of a coin) to receive either XRV-204 or a placebo. A placebo looks like the real medicine but contains no active ingredient. Neither you nor the study team will know which you are receiving — this is called "double-blind". The study medicine is given as a small injection under the skin once every two weeks for 16 weeks, followed by a 12-week safety follow-up.

Study visits will take place at the clinic every 2–4 weeks. Each visit may last 1–3 hours and may include: a physical examination, photographs of affected skin areas, blood and urine samples, questions about your symptoms and general health, and an electrocardiogram (ECG) at selected visits.

POSSIBLE RISKS AND DISCOMFORTS

Because XRV-204 is still being studied, not all risks may be known. The most common side effects seen in earlier studies included: redness or mild swelling at the injection site, headache, nausea, and upper respiratory tract infections. Rare but serious risks may include severe allergic reactions and temporary changes in liver function tests. Taking part in research may also cause inconvenience, loss of privacy, or emotional distress.

POSSIBLE BENEFITS

You may or may not benefit directly from taking part in this study. Your condition may improve, stay the same, or worsen. Information gained from this study may help others with similar conditions in the future.

VOLUNTARY PARTICIPATION

Taking part is entirely voluntary. You are free to decline, or to withdraw at any time, without giving a reason and without any effect on your regular medical care.

CONFIDENTIALITY

Your personal information will be kept confidential to the extent permitted by law. Study records will be identified by a code, not by your name. Authorised representatives of the sponsor, ethics committee, and regulatory authorities may inspect your records to verify the study's accuracy.

CONTACTS

If you have questions about the study at any time, contact the Principal Investigator at the number provided on page 1. For questions about your rights as a research participant, contact the Ethics Committee independently.

I have read and understood the information above. I agree to take part in this study.

Participant signature: __________________________   Date: ____________
Person obtaining consent: _______________________   Date: ____________$ICF$::text,
    $INST$Translate this Informed Consent Form for regulatory submission. This is high-stakes: the translated text is part of the participant's legally binding consent.
- Regulatory phrases ("investigational", "placebo", "double-blind", "randomised", "adverse event", "principal investigator", "ethics committee") must use the target country's officially accepted terms.
- Protocol identifiers (XRV-204), sponsor names (Arvenex Therapeutics Ltd.), version numbers, dates, and numeric values MUST remain unchanged.
- Readability target: participants with 10–12 years of schooling. Avoid medical jargon where plain language exists in the target language.
- Preserve document structure, all section headings, and the signature block exactly.
- Add a Translator Notes section at the end only if the source text has ambiguities — otherwise omit.$INST$,
    '{"accuracy":0.35,"terminology":0.30,"fluency":0.15,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  SELECT
    'advanced',
    'Clinical Study Protocol XRV-204 — Inclusion & Exclusion Criteria',
    $PROTOCOL$CLINICAL STUDY PROTOCOL XRV-204

Section 5: SUBJECT ELIGIBILITY CRITERIA

5.1 Inclusion Criteria

Subjects are eligible for enrolment only if ALL of the following criteria are met at the time of screening:

5.1.1 Adults aged ≥18 and ≤70 years at signature of the Informed Consent Form.

5.1.2 Diagnosis of chronic inflammatory dermatitis by a dermatologist, confirmed by biopsy at least 12 weeks before screening.

5.1.3 Physician's Global Assessment (PGA) score ≥3 (moderate) and ≤4 (severe) at screening and at Baseline (Day 1).

5.1.4 Body Surface Area (BSA) involvement ≥10% at screening and at Baseline.

5.1.5 Inadequate response, intolerance, or contraindication to at least one prior topical therapy (including, but not limited to, topical corticosteroids of potency class II–IV or topical calcineurin inhibitors) administered for ≥8 continuous weeks within the past 24 months.

5.1.6 Willingness and ability to comply with all protocol requirements, including study visits, self-administered assessments, and avoidance of disallowed treatments.

5.1.7 For women of childbearing potential: a negative serum pregnancy test at screening and willingness to use a highly effective method of contraception (as defined by CTFG guidance) from Day 1 through 20 weeks after the last dose of study medication. For men with partners of childbearing potential: willingness to use a condom from Day 1 through 16 weeks after the last dose.

5.1.8 Adequate organ function at screening, defined as:
a) Haemoglobin ≥10.0 g/dL
b) Absolute neutrophil count ≥1.5 × 10⁹/L
c) Platelets ≥100 × 10⁹/L
d) Serum creatinine ≤1.5 × ULN OR estimated glomerular filtration rate ≥60 mL/min/1.73 m²
e) ALT and AST ≤2.0 × ULN
f) Total bilirubin ≤1.5 × ULN (subjects with known Gilbert's syndrome may have total bilirubin ≤3.0 × ULN)

5.2 Exclusion Criteria

Subjects are NOT eligible for enrolment if ANY of the following criteria are met at screening:

5.2.1 Active or latent tuberculosis, as determined by interferon-gamma release assay (IGRA) and/or chest X-ray taken within 12 weeks of screening. Subjects with adequately treated latent TB are eligible per investigator judgement.

5.2.2 Known hypersensitivity to XRV-204 or to any of its excipients.

5.2.3 Previous exposure to any investigational biologic therapy within 12 weeks or within five half-lives (whichever is longer) before Day 1.

5.2.4 Prior treatment with any anti-interleukin-23 or anti-interleukin-17 targeted therapy, regardless of washout.

5.2.5 Concomitant use of systemic corticosteroids (>10 mg/day prednisone equivalent), non-biologic disease-modifying anti-rheumatic drugs, phototherapy, or other immunomodulators that cannot be washed out for the required period before Day 1.

5.2.6 History of malignancy within 5 years, except for adequately treated non-melanoma skin cancer or cervical carcinoma in situ.

5.2.7 Positive serology for HIV, hepatitis B surface antigen, or hepatitis C antibody (with confirmed positive HCV RNA) at screening.

5.2.8 Clinically significant uncontrolled cardiovascular, pulmonary, renal, hepatic, neurological, endocrine, psychiatric, or other medical condition that, in the investigator's judgement, would put the subject at risk, confound the study results, or interfere with participation.

5.2.9 Pregnant or breastfeeding women, or women planning to become pregnant during the study.

5.2.10 Participation in another interventional clinical study within 30 days of Day 1.$PROTOCOL$::text,
    $INST$Translate these eligibility criteria for a clinical trial protocol. Accuracy and terminology carry the highest weight here — a mistranslation can disqualify eligible participants or enrol ineligible ones.
- Preserve every numerical value, unit, and lab abbreviation EXACTLY (g/dL, ULN, PGA, BSA, IGRA, HCV RNA, ×10⁹/L, etc.). Do NOT translate unit symbols.
- Preserve the section numbering scheme (5.1.1, 5.2.7a, etc.) exactly.
- Clinical terms (interleukin-23, corticosteroids, tuberculosis, Gilbert's syndrome, etc.) must use the target language's standard medical terminology — confirm with the current national pharmacopoeia rather than word-for-word.
- Regulatory acronyms (CTFG, ULN) stay untranslated on first occurrence with an expansion in a translator's note only if the target-language readership won't recognise them.
- Preserve the ≥, ≤, × symbols. Do not convert to words.
- This will be read by investigators — register is formal-technical.$INST$,
    '{"accuracy":0.40,"terminology":0.35,"fluency":0.10,"style":0.05,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb
)
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
  reference_translation,
  ai_assessment_rubric,
  is_active,
  times_used
)
SELECT
  gen_random_uuid(),
  '[AI-DRAFT] ' || s.title_stem || ' (' || p.label || ')',
  p.src_id,
  p.tgt_id,
  'life_sciences',
  'domain_test',          -- Legacy column; library rows carry a placeholder.
                          -- cvp-send-tests no longer filters by service_type
                          -- for domain-unit combinations (service_type IS NULL).
  s.difficulty,
  s.source_text,
  s.instructions,
  NULL,                   -- reference_translation — filled by cvp-seed-library-refs
  s.rubric,
  false,                  -- is_active = true only after Opus drafts the reference
  0
FROM sources s, pairs p
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ---- Verification ----
SELECT
  title,
  difficulty,
  is_active,
  (source_text IS NOT NULL) AS has_source,
  (reference_translation IS NOT NULL) AS has_ref
FROM cvp_test_library
WHERE domain = 'life_sciences'
ORDER BY difficulty, title;
