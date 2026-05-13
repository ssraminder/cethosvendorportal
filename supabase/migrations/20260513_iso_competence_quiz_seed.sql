-- ============================================================================
-- Phase 5b Slice 1 — seed bank: 40 MCQ questions across 5 competences
--
-- 8 questions per competence. Admin authoring UI (Slice 3) will let
-- Cethos staff grow the bank, edit questions, mark some as deprecated.
-- ============================================================================

INSERT INTO public.iso_competence_quizzes (competence_slug, question, options, correct_option, explanation, difficulty) VALUES

-- ── linguistic_textual_competence ────────────────────────────────────────
('linguistic_textual_competence',
 'Which sentence punctuates the dialogue tag correctly in US/UK English?',
 '[
   {"value":"a","label":"\"I''ll be there\". she said."},
   {"value":"b","label":"\"I''ll be there,\" she said."},
   {"value":"c","label":"\"I''ll be there.\" she said."},
   {"value":"d","label":"\"I''ll be there,\" She said."}
  ]'::jsonb,
 'b',
 'The dialogue ends with a comma (because the sentence continues with the tag), inside the closing quote; the tag uses lowercase ''she''.',
 'easy'),

('linguistic_textual_competence',
 'In a corporate annual report (English), which sentence is most register-appropriate?',
 '[
   {"value":"a","label":"We totally crushed it this quarter!"},
   {"value":"b","label":"Our performance this quarter exceeded expectations."},
   {"value":"c","label":"Things went pretty well this quarter, I guess."},
   {"value":"d","label":"This quarter has been like, super profitable for us."}
  ]'::jsonb,
 'b',
 'Annual reports require formal, neutral register. (a) and (d) are colloquial; (c) hedges inappropriately.',
 'easy'),

('linguistic_textual_competence',
 'Which is the standard French quotation-mark convention?',
 '[
   {"value":"a","label":"« with non-breaking spaces inside »"},
   {"value":"b","label":"\"Like English\""},
   {"value":"c","label":"„German-style double-low-9"},
   {"value":"d","label":"Both « » and \" \" are equally acceptable in published French"}
  ]'::jsonb,
 'a',
 'Standard French typography uses guillemets « » with non-breaking spaces between the mark and the text. Published French houses are strict about this.',
 'medium'),

('linguistic_textual_competence',
 'In Spanish, when should you use the formal ''usted'' vs the informal ''tú''?',
 '[
   {"value":"a","label":"Always use ''usted'' to be safe"},
   {"value":"b","label":"It depends on the country, audience, and relationship — Spain favours ''tú'' more readily than Latin America for marketing copy"},
   {"value":"c","label":"Always use ''tú'' — modern Spanish has abandoned ''usted''"},
   {"value":"d","label":"Use ''usted'' only when addressing royalty or clergy"}
  ]'::jsonb,
 'b',
 'Register choice is locale-dependent. Spain''s ''tú'' threshold is lower than most Latin American markets, where ''usted'' is still common in corporate communication.',
 'medium'),

('linguistic_textual_competence',
 'Translating "the company''s leadership" into Spanish for a corporate context — what reads most natural?',
 '[
   {"value":"a","label":"el liderazgo de la empresa"},
   {"value":"b","label":"los líderes de la compañía"},
   {"value":"c","label":"la dirección de la empresa"},
   {"value":"d","label":"los jefes de la empresa"}
  ]'::jsonb,
 'c',
 '''La dirección'' is the standard corporate term for an organisation''s leadership. ''Liderazgo'' is an abstract noun (the quality of leading); ''jefes'' is too informal.',
 'medium'),

('linguistic_textual_competence',
 'Which sentence uses correct subject-verb agreement?',
 '[
   {"value":"a","label":"The data shows a clear trend."},
   {"value":"b","label":"The data show a clear trend."},
   {"value":"c","label":"Both (a) and (b) are accepted in modern English; the singular treatment is now standard in most style guides."},
   {"value":"d","label":"Neither — ''data'' should always take a plural verb."}
  ]'::jsonb,
 'c',
 'Strictly, ''data'' is plural (datum/data), but contemporary usage (AP, Microsoft, most newspapers) accepts the singular. Knowing the convention of your style guide matters more than the grammar-purist rule.',
 'hard'),

('linguistic_textual_competence',
 'A German technical manual uses "Sie" forms throughout. Translating to English, which is the right register?',
 '[
   {"value":"a","label":"Use ''you'' throughout (English has no formal/informal distinction)"},
   {"value":"b","label":"Use ''thou'' for the formal equivalent"},
   {"value":"c","label":"Avoid ''you'' entirely — use passive voice and imperatives"},
   {"value":"d","label":"Vary between ''you'' and ''one'' depending on tone"}
  ]'::jsonb,
 'a',
 'English has only one second-person pronoun. The German formal register signals respect; in English that''s achieved through complete sentences, courteous phrasing, and avoiding contractions in formal text — not pronoun choice.',
 'medium'),

('linguistic_textual_competence',
 'In English, which is the correct typographic dash for parenthetical asides?',
 '[
   {"value":"a","label":"hyphen — like this"},
   {"value":"b","label":"en dash – like this (with spaces, UK style)"},
   {"value":"c","label":"em dash — like this (often unspaced, US style)"},
   {"value":"d","label":"Both (b) and (c) — UK style uses en dashes with spaces; US style uses em dashes unspaced"}
  ]'::jsonb,
 'd',
 'Both UK and US conventions are correct; the hyphen (a) is wrong for parentheticals. Knowing the target locale''s convention is the linguistic-competence point.',
 'hard'),

-- ── research_competence ─────────────────────────────────────────────────
('research_competence',
 'You encounter the term "PEEP" in a respiratory medical document with no context. What is the most reliable first move?',
 '[
   {"value":"a","label":"Translate it phonetically — medical terms are usually borrowed"},
   {"value":"b","label":"Search the broader sentence and document context to disambiguate (it could be ''Positive End-Expiratory Pressure'' in pulmonology), then verify against a domain glossary (e.g. PubMed MeSH, TermsCanada)"},
   {"value":"c","label":"Pick the first translation in Google Translate"},
   {"value":"d","label":"Skip it and add a translator''s note"}
  ]'::jsonb,
 'b',
 'Medical acronyms are heavily context-dependent. PEEP in pulmonology means ''Positive End-Expiratory Pressure''; in EU policy contexts it means ''Pan-European Personal Pension''. Disambiguation by context + authoritative glossary is the standard research move.',
 'medium'),

('research_competence',
 'Which is the most authoritative source for a legal-translation term in EU context?',
 '[
   {"value":"a","label":"Wikipedia article on the topic"},
   {"value":"b","label":"IATE (Interactive Terminology for Europe)"},
   {"value":"c","label":"DeepL or Google Translate"},
   {"value":"d","label":"A forum thread on ProZ.com"}
  ]'::jsonb,
 'b',
 'IATE is the EU''s official terminology database, vetted by EU institutional translators. ProZ forums and Wikipedia can be useful for hints but aren''t authoritative for legal/EU work.',
 'easy'),

('research_competence',
 'A source text uses "billion". The target market is European Spanish. How do you handle the numerical ambiguity?',
 '[
   {"value":"a","label":"Always use ''billón'' — it''s the cognate"},
   {"value":"b","label":"Use ''mil millones'' (10^9) and confirm with the client — ''billón'' in Spanish historically meant 10^12 (the long scale)"},
   {"value":"c","label":"Convert to thousands"},
   {"value":"d","label":"Use the numeric figure with no word — let the reader interpret"}
  ]'::jsonb,
 'b',
 'Spanish ''billón'' uses the long scale (10^12), unlike English ''billion'' (10^9). This is a classic false friend. Use ''mil millones'' and verify with the client to avoid 1000× errors.',
 'hard'),

('research_competence',
 'You see "BIA" in an immigration document for the US. Best research approach?',
 '[
   {"value":"a","label":"Assume Board of Immigration Appeals — most common in US immigration"},
   {"value":"b","label":"Check the document context and verify against the US Department of Justice / DOJ acronym list"},
   {"value":"c","label":"Look it up on Wikipedia and pick the first result"},
   {"value":"d","label":"Pick whatever translation feels right based on document tone"}
  ]'::jsonb,
 'b',
 'Even when an acronym ''feels'' obvious, verifying against the issuing authority is the audit-defensible move. BIA could be Board of Immigration Appeals OR Bureau of Indian Affairs depending on context.',
 'medium'),

('research_competence',
 'A source segment has a typo ("compny" instead of "company"). What''s the right move?',
 '[
   {"value":"a","label":"Translate it literally — preserve all errors"},
   {"value":"b","label":"Correct the typo silently"},
   {"value":"c","label":"Correct the typo and flag it as a translator''s comment to the project manager"},
   {"value":"d","label":"Refuse to translate the segment"}
  ]'::jsonb,
 'c',
 'Standard practice is to correct obvious typos in the target while flagging them as queries. ISO 17100 §5.3.1 ''Translation'' notes that translators should refer queries about the source to the project manager.',
 'easy'),

('research_competence',
 'Which is the BEST monolingual corpus tool for verifying that a translated phrase sounds natural in target English?',
 '[
   {"value":"a","label":"Google Translate''s reverse-translate feature"},
   {"value":"b","label":"A frequency search in a corpus like COCA or BNC"},
   {"value":"c","label":"Counting hits on a Google search of the full phrase"},
   {"value":"d","label":"Asking a colleague on Slack"}
  ]'::jsonb,
 'b',
 'Corpora like COCA (US English) and BNC (British English) show actual native-speaker usage at scale. Google hit counts are misleading (the algorithm and indexed pages vary); reverse-translation is circular.',
 'hard'),

('research_competence',
 'You''re unsure whether a client wants ''colour'' or ''color''. What''s the right move?',
 '[
   {"value":"a","label":"Use ''color'' — it''s shorter"},
   {"value":"b","label":"Pick one and be consistent within the file"},
   {"value":"c","label":"Check the client''s previous deliverables, style guide, or any TM for their preference; if none, ask the project manager"},
   {"value":"d","label":"Use ''colour'' in formal contexts and ''color'' in casual ones"}
  ]'::jsonb,
 'c',
 'Locale + style is a client preference, not a translator judgment call. The right research move is to check existing assets (TM, style guide, prior work) before asking.',
 'easy'),

('research_competence',
 'You spot a number conversion error in the source (e.g. "5 km" labelled as "3 miles" when it should be ~3.1). What do you do?',
 '[
   {"value":"a","label":"Translate the wrong number to match"},
   {"value":"b","label":"Silently correct it to ~3.1 miles"},
   {"value":"c","label":"Flag it to the project manager — the source itself is wrong and the client should know"},
   {"value":"d","label":"Round it to a clean number to avoid awkwardness"}
  ]'::jsonb,
 'c',
 'Source errors should be raised with the PM, not silently corrected. This is both a quality issue and a liability one — the translator shouldn''t carry the risk of a unilateral source correction.',
 'medium'),

-- ── cultural_competence ─────────────────────────────────────────────────
('cultural_competence',
 'A US tech company''s slogan is "Conquer your inbox." Localising to Japanese. What''s the right approach?',
 '[
   {"value":"a","label":"Translate literally — ''conquer'' is universal"},
   {"value":"b","label":"Adapt the metaphor — Japanese business communication generally avoids combative metaphors (''conquer'', ''crush'', ''dominate''). Use a more harmonious framing like ''get on top of your inbox'' or ''organise your inbox effortlessly''"},
   {"value":"c","label":"Drop the slogan and use the product name only"},
   {"value":"d","label":"Use English with katakana phonetics"}
  ]'::jsonb,
 'b',
 'Combative/conquest metaphors in marketing don''t resonate in Japan and can read as aggressive. Cultural competence means adapting the underlying message, not the literal words.',
 'medium'),

('cultural_competence',
 'A US client wants their FAQ page translated for the Saudi Arabian market. They show a photo of a smiling woman shaking hands with a male executive. What do you flag?',
 '[
   {"value":"a","label":"Nothing — it''s just a stock photo"},
   {"value":"b","label":"The image may be culturally inappropriate for KSA (mixed-gender handshakes and uncovered hair are sensitive); recommend an alternative image with the localisation"},
   {"value":"c","label":"Translate the alt text differently"},
   {"value":"d","label":"Add a disclaimer below the image"}
  ]'::jsonb,
 'b',
 'Localisation goes beyond text. Imagery, gestures, colours, gender representation all need cultural review. Flagging this to the client is what a competent localiser does.',
 'easy'),

('cultural_competence',
 'Date format "03/04/2025" appears in a US source. Target is UK English. What does it mean and how do you render it?',
 '[
   {"value":"a","label":"3 April 2025 — US uses MM/DD/YYYY; UK uses DD/MM/YYYY, so it must be reformatted as 03/04/2025 → 04/03/2025"},
   {"value":"b","label":"03/04/2025 — leave as-is, UK readers will understand"},
   {"value":"c","label":"3rd April 2025 in long form"},
   {"value":"d","label":"Both (a) and (c) are correct; (a) for numeric, (c) when long form is clearer"}
  ]'::jsonb,
 'd',
 'US source is March 4 (MM/DD); UK target wants 4 March (DD/MM). For maximum clarity, long form (4 March 2025) is often better when the date is critical. Both numeric reformatting and long form are correct localisations.',
 'medium'),

('cultural_competence',
 'Marketing copy says "back-to-school season starts in August!" Target market is Australia. What''s the issue?',
 '[
   {"value":"a","label":"No issue — translate literally"},
   {"value":"b","label":"Australia''s school year starts in late January / early February; ''back-to-school in August'' is wrong for the locale"},
   {"value":"c","label":"Australia doesn''t have a school year"},
   {"value":"d","label":"August is back-to-school globally"}
  ]'::jsonb,
 'b',
 'Seasonal references are anchored to local calendars. ''Back-to-school in August'' is Northern-Hemisphere reasoning; Australia''s school year starts in summer (their summer = our winter). Cultural competence = catching these.',
 'easy'),

('cultural_competence',
 'A French source uses "Madame, Monsieur," as a generic letter opener. Best English equivalent for a formal corporate letter?',
 '[
   {"value":"a","label":"Madam, Sir,"},
   {"value":"b","label":"Dear Sir/Madam,"},
   {"value":"c","label":"To Whom It May Concern,"},
   {"value":"d","label":"Hi there,"}
  ]'::jsonb,
 'b',
 '''Dear Sir/Madam'' is the closest functional equivalent in formal English business correspondence. (c) is acceptable for less formal generic letters; (a) is a calque; (d) is far too casual.',
 'easy'),

('cultural_competence',
 'In Chinese culture, which colour is traditionally associated with mourning rather than celebration?',
 '[
   {"value":"a","label":"Red"},
   {"value":"b","label":"White"},
   {"value":"c","label":"Yellow"},
   {"value":"d","label":"Gold"}
  ]'::jsonb,
 'b',
 'White is traditionally associated with mourning in Chinese culture; red is celebratory (used in weddings, festivals). Important for localising marketing imagery, wedding/funeral content, etc.',
 'medium'),

('cultural_competence',
 'An English source says "the Smith family." German target. What''s the most natural rendering for a formal context?',
 '[
   {"value":"a","label":"die Familie Smith"},
   {"value":"b","label":"die Smith-Familie"},
   {"value":"c","label":"Familie Smith"},
   {"value":"d","label":"das Haus Smith"}
  ]'::jsonb,
 'c',
 '''Familie Smith'' (without ''die'') is the standard German address form and the natural choice in most contexts. ''die Familie Smith'' is grammatically fine but more formal/distancing.',
 'medium'),

('cultural_competence',
 'A US source uses "John Smith, Jr." Target market is Spain. How do you handle the suffix?',
 '[
   {"value":"a","label":"Translate as ''John Smith, Hijo''"},
   {"value":"b","label":"Drop the ''Jr.''; Spanish naming conventions don''t use generational suffixes the same way"},
   {"value":"c","label":"Keep ''Jr.'' as-is if it''s part of a legal name; localise to ''hijo'' or drop only if context allows"},
   {"value":"d","label":"Always replace with the paternal surname"}
  ]'::jsonb,
 'c',
 'Names are legal identifiers. If ''Jr.'' is the legal name (passport, contract), keep it. In marketing or informal contexts, dropping or adapting may be appropriate. Context decides.',
 'hard'),

-- ── technical_competence ────────────────────────────────────────────────
('technical_competence',
 'In CAT-tool segments, what does an ''ICE match'' (100% in-context exact) mean?',
 '[
   {"value":"a","label":"A 100% match from translation memory that is also confirmed by the surrounding context (previous + next segment match too) — typically used as-is without review"},
   {"value":"b","label":"A match scored at 95-99% similarity"},
   {"value":"c","label":"A fuzzy match flagged for review"},
   {"value":"d","label":"A glossary term match"}
  ]'::jsonb,
 'a',
 'ICE = In-Context Exact. The segment itself is a 100% TM match AND the surrounding segments also match the source-document context. Usually billed at the lowest rate and reviewed minimally.',
 'medium'),

('technical_competence',
 'You receive an XLIFF file with locked segments. What does ''locked'' mean and how do you handle it?',
 '[
   {"value":"a","label":"Locked segments are missing — request them from the PM"},
   {"value":"b","label":"Locked segments are not to be edited (already finalised or are non-translatable); the CAT tool will skip them — don''t override the lock"},
   {"value":"c","label":"Locked segments need a password to view"},
   {"value":"d","label":"Locked segments are confidential and must be translated outside the tool"}
  ]'::jsonb,
 'b',
 'Locked segments are typically already-finalised content or non-translatable strings (code, product names). The PM locks them deliberately; overriding without permission is a workflow violation.',
 'easy'),

('technical_competence',
 'A source segment in InDesign IDML contains <ph id="1"/>Hello <ph id="2"/>world<ph id="3"/>. What are the &lt;ph&gt; elements?',
 '[
   {"value":"a","label":"Phonetic markers — drop them in the translation"},
   {"value":"b","label":"Placeholders for inline formatting (bold, italic, links) that the CAT tool must preserve in the same positions in the target"},
   {"value":"c","label":"Page-header markers — only translate the text outside them"},
   {"value":"d","label":"Paragraph dividers — replace with newlines"}
  ]'::jsonb,
 'b',
 '<ph> tags in XLIFF are placeholders for formatting/inline elements. They must be carried into the target segment in the right order; dropping them breaks the document''s formatting on round-trip.',
 'medium'),

('technical_competence',
 'You receive a 10,000-word job with a 50% TM-match analysis. What''s your professional move BEFORE accepting?',
 '[
   {"value":"a","label":"Accept immediately — TM analysis is the client''s problem"},
   {"value":"b","label":"Spot-check the TM matches for quality and confirm the rate scheme (whether 50% matches are billed at full rate, half rate, or no rate)"},
   {"value":"c","label":"Decline — TM-heavy jobs aren''t worth it"},
   {"value":"d","label":"Inflate your hourly to compensate for the TM dependence"}
  ]'::jsonb,
 'b',
 'Reviewing TM-match quality before commitment is part of technical competence. Some TMs are excellent; some are toxic. Rate brackets vary by client — confirming both is standard professional practice.',
 'easy'),

('technical_competence',
 'A client sends you a PDF for translation. What''s the correct first step?',
 '[
   {"value":"a","label":"Type the translation into Word — translating PDFs directly isn''t possible"},
   {"value":"b","label":"OCR the PDF (if scanned) or extract text (if native), convert to an editable format (Word, XLIFF, etc.), confirm the format with the client, then translate"},
   {"value":"c","label":"Refuse the job"},
   {"value":"d","label":"Translate over a PDF annotation layer"}
  ]'::jsonb,
 'b',
 'PDFs are a delivery format, not a translation format. Converting to a CAT-tool-friendly format (Word, XLIFF, MemoQ-supported) is the right move. Confirm format expectations with the client (some clients want back to PDF; some accept Word).',
 'medium'),

('technical_competence',
 'In a TMX file, what is the "tuv" element?',
 '[
   {"value":"a","label":"Translation Unit Version — a single language variant inside a Translation Unit"},
   {"value":"b","label":"Term Used Variable"},
   {"value":"c","label":"Total User Variation"},
   {"value":"d","label":"Translation Underlying Vector"}
  ]'::jsonb,
 'a',
 'TMX (Translation Memory eXchange) uses <tu> for a translation unit and <tuv> for each language variant within it (one per language). Knowing the TMX schema matters for fixing broken TMs or migrating between tools.',
 'hard'),

('technical_competence',
 'A client sends you a 2GB folder of files for one job. What''s the right move?',
 '[
   {"value":"a","label":"Decline — too much work"},
   {"value":"b","label":"Email yourself the files"},
   {"value":"c","label":"Use the client''s preferred transfer (SFTP, the agency portal, WeTransfer, etc.) — check first; large transfers via email or unsecured channels can fail or breach NDAs"},
   {"value":"d","label":"Upload to your personal Google Drive and share publicly"}
  ]'::jsonb,
 'c',
 'Large file transfers and confidentiality have to be respected. Most agencies have a preferred secure channel (portal, SFTP, transfer service). NDAs often prohibit personal cloud uploads.',
 'easy'),

('technical_competence',
 'Your CAT tool flags a segment with a QA warning: ''number mismatch''. What does that typically mean?',
 '[
   {"value":"a","label":"The segment number doesn''t match the source order"},
   {"value":"b","label":"A numeral appearing in the source segment is missing or different in your target segment (e.g. ''3 years'' translated as ''four years'')"},
   {"value":"c","label":"You used the wrong segment numbering style"},
   {"value":"d","label":"The TM match number is too low"}
  ]'::jsonb,
 'b',
 'Number-mismatch QA checks compare numerals in source vs target. Always worth verifying — a typo on ''3 years'' → ''four years'' can be a costly error in legal/medical/financial content.',
 'easy'),

-- ── domain_competence (generic / cross-domain pool) ─────────────────────
('domain_competence',
 'A legal contract has the phrase "time is of the essence." Best translation strategy for Spanish (legal context)?',
 '[
   {"value":"a","label":"Translate literally — ''el tiempo es de la esencia''"},
   {"value":"b","label":"Use the established legal-equivalent phrase, e.g. ''el plazo es esencial'' or ''el cumplimiento dentro del plazo es esencial'' — the literal calque doesn''t carry the legal force"},
   {"value":"c","label":"Drop the phrase as untranslatable"},
   {"value":"d","label":"Use a footnote explaining the English convention"}
  ]'::jsonb,
 'b',
 '''Time is of the essence'' is a legal term of art meaning failure to meet deadlines is a material breach. Spanish legal language has functional equivalents; the literal calque has no legal weight. Domain competence = knowing the term of art, not just the words.',
 'medium'),

('domain_competence',
 'In a medical study, "double-blind randomised controlled trial" is the gold standard. Which translation is most accurate to French scientific register?',
 '[
   {"value":"a","label":"essai en double aveugle, randomisé et contrôlé"},
   {"value":"b","label":"essai randomisé contrôlé en double aveugle"},
   {"value":"c","label":"étude à l''aveugle avec contrôle aléatoire"},
   {"value":"d","label":"recherche en double cécité avec hasard"}
  ]'::jsonb,
 'b',
 'The standard French scientific phrasing places the elements in this order. (a) is acceptable but less natural; (c) and (d) are off-register or back-translations from English.',
 'hard'),

('domain_competence',
 'A US tax document mentions "Form 1040." When translating into Spanish for a US-based Spanish-speaking audience, what''s the right move?',
 '[
   {"value":"a","label":"Translate the form number to a Spanish numeric format"},
   {"value":"b","label":"Keep ''Formulario 1040'' — it''s a specific IRS document reference and must remain identifiable"},
   {"value":"c","label":"Drop the form reference"},
   {"value":"d","label":"Use ''formulario de impuesto'' generically"}
  ]'::jsonb,
 'b',
 'Document references (form numbers, statute numbers, court case names) must remain referenceable. The Spanish-speaking US-resident user needs to find Form 1040 on the IRS website — and the IRS uses ''Formulario 1040'' itself.',
 'easy'),

('domain_competence',
 'In a financial annual report, "EBITDA" appears repeatedly. Translation strategy?',
 '[
   {"value":"a","label":"Spell out as ''ganancias antes de intereses, impuestos, depreciación y amortización'' on first use, then keep ''EBITDA'' for subsequent uses (or per the client''s style guide)"},
   {"value":"b","label":"Always spell it out in full"},
   {"value":"c","label":"Always keep as ''EBITDA''"},
   {"value":"d","label":"Translate as ''ganancias operativas''"}
  ]'::jsonb,
 'a',
 'EBITDA is a financial term of art that''s used as an English acronym across most languages in professional contexts. Spelling out on first use is helpful for non-financial readers; subsequent uses can stay as the acronym. Style guides may override.',
 'medium'),

('domain_competence',
 'A pharmaceutical IFU (Instructions for Use) has dosage instructions. What''s the highest-risk error category to QA carefully?',
 '[
   {"value":"a","label":"Capitalisation inconsistencies"},
   {"value":"b","label":"Numeric values, units, frequencies, and routes of administration — these are patient-safety critical"},
   {"value":"c","label":"Brand-name placement"},
   {"value":"d","label":"Footer page numbering"}
  ]'::jsonb,
 'b',
 'Dosage, unit, frequency, and route errors are the highest-risk category in pharma — a misplaced decimal can be fatal. Multiple QA passes (sometimes back-translation) are standard for IFUs.',
 'easy'),

('domain_competence',
 'You''re translating a patent claim. What''s the cardinal rule?',
 '[
   {"value":"a","label":"Paraphrase for readability"},
   {"value":"b","label":"Preserve the exact scope and structure of the claim — patent claims define legal scope; even ''comprising'' vs ''consisting of'' has specific legal meaning. Don''t paraphrase"},
   {"value":"c","label":"Use plain language for the claim and technical language for the body"},
   {"value":"d","label":"Translate the abstract instead — claims are summarised there"}
  ]'::jsonb,
 'b',
 'Patent claims are the legal definition of the invention. Words like ''comprising'' (open-ended, allows more elements), ''consisting of'' (closed list), and ''substantially'' have specific case-law meanings. Domain competence in IP requires preserving these precisely.',
 'hard'),

('domain_competence',
 'A marketing transcreation brief asks for a tagline ''that captures the brand voice.'' How do you handle the source-to-target ratio?',
 '[
   {"value":"a","label":"Match the word count of the source exactly"},
   {"value":"b","label":"Translate as literally as possible to preserve the original"},
   {"value":"c","label":"Optimise for the target audience — the tagline can be longer, shorter, or completely different in wording as long as it captures the same emotional/positioning intent. Often supply 2-3 variants for the client to pick"},
   {"value":"d","label":"Ask the client to drop the tagline if it doesn''t translate cleanly"}
  ]'::jsonb,
 'c',
 'Transcreation is not translation. The deliverable is target-audience effect, not source fidelity. Industry practice is to supply 2-3 options with back-translations and rationale so the client can pick.',
 'easy'),

('domain_competence',
 'For a literary translation of a novel, the author uses a dialect. Best approach?',
 '[
   {"value":"a","label":"Translate to standard target language — dialect doesn''t cross"},
   {"value":"b","label":"Find a target-language register or dialect that maps to the source dialect''s function (regional flavour, social class, time period) and use it consistently; agree the approach with the editor in advance"},
   {"value":"c","label":"Drop all dialect markers"},
   {"value":"d","label":"Translate phonetically, sound-by-sound"}
  ]'::jsonb,
 'b',
 'Dialect in fiction usually does narrative work (character voice, social setting). Mapping to a target equivalent and agreeing with the editor upfront is the literary-translation standard. Stripping dialect entirely (a/c) loses information; phonetic (d) is gibberish.',
 'hard');
