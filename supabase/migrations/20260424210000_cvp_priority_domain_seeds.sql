-- ============================================================================
-- Priority domain library seeds (T2)
-- ============================================================================
--
-- Adds library tests for the four next-highest-priority domains: general,
-- medical, legal, immigration. Same seed-then-AI-reference pattern as T0's
-- Life Sciences migration.
--
-- Scope: 24 rows = 4 domains × 3 difficulties × 2 forward pairs (EN→FR, EN→FA).
-- Reverse direction (FR→EN, FA→EN) is deferred until cvp-seed-library-refs
-- is extended to also synthesise source_text in the source language.
--
-- General is the most urgent of the four: every translator application now
-- includes a General baseline combination (T0 submit rewrite), so without
-- seeds here the preview step would show "no matching test" for every
-- applicant.
--
-- All English source texts below are fully synthesised (no copyright
-- concerns). Realistic length (~280–450 words per difficulty). Rows land
-- with `is_active=false` and `reference_translation IS NULL`; the
-- cvp-seed-library-refs edge function promotes them once Opus produces a
-- reference in the target language (AI-fallback rule applies — on failure,
-- rows stay inactive with ai_generation_error populated).
-- ============================================================================

BEGIN;

WITH pairs(src_id, tgt_id, label) AS (
  VALUES
    ('fde091d2-db5f-4e41-a490-7e15efc419e1'::uuid,  -- English
     'd972e8cc-519c-4446-9483-30da1346850c'::uuid,  -- Persian (Farsi)
     'EN→FA'),
    ('fde091d2-db5f-4e41-a490-7e15efc419e1'::uuid,  -- English
     '3f020964-31f9-4310-b632-a46fb629231a'::uuid,  -- French
     'EN→FR')
),
sources AS (
  -- ============================ GENERAL ==============================
  SELECT
    'general'::text AS domain,
    'beginner'::text AS difficulty,
    'General — Personal letter'::text AS title_stem,
    $SRC$Dear Maya,

Thank you so much for the lovely birthday card — it arrived yesterday morning and it honestly made my whole week. I love the little hand-drawn flowers on the front; did you do those yourself? They look like the ones we used to draw in our sketchbooks back in high school.

Things have been busy here. We finally moved into the new apartment last weekend. It's much smaller than the old place, but it gets beautiful afternoon light and there's a small balcony where I've started growing tomatoes. The neighbours are friendly, and there's a little bakery around the corner that sells the best sourdough I've ever eaten. I'm not going to tell you how often I walk over there.

Work is the usual — busy, but I can't complain. I got promoted to team lead last month, which I didn't expect. It means a lot more meetings but also more interesting projects, so I'll take it. My boss is kind and fair, which makes a real difference.

When are you next coming to visit? The guest room is small but there's a comfortable sofa bed, and I'd love to show you around. There's a new café that opened down the street that I know you'd love — they have excellent coffee and the staff don't mind if you sit and read for two hours.

Please write back soon. I miss our long conversations.

With lots of love,
Elena$SRC$::text AS source_text,
    $INST$Translate this personal letter into the target language, preserving the warm and conversational tone throughout.
- Use the informal/familiar register appropriate for close friends in the target language.
- Keep all names unchanged (Maya, Elena).
- Preserve the letter's structure — greeting, body paragraphs, sign-off.
- Idioms like "it made my whole week" should be rendered naturally, not literally.
- If the target language has gendered forms, note that Elena is female and Maya is also female (both friends writing as women).$INST$::text AS instructions,
    '{"accuracy":0.20,"terminology":0.10,"fluency":0.35,"style":0.20,"locale":0.10,"design":0.00,"non_translation":0.05}'::jsonb AS rubric

  UNION ALL

  SELECT
    'general',
    'intermediate',
    'General — Internal HR announcement',
    $SRC$Subject: Updates to the Employee Wellness Benefit — effective 1 June

Dear colleagues,

We're pleased to share several enhancements to our Employee Wellness Benefit, effective 1 June 2025. These changes reflect feedback we received in the staff survey earlier this year, and we believe they meaningfully expand the support available to you and your families.

Starting 1 June, the annual wellness stipend will increase from $500 to $750 per employee. As before, this amount can be claimed against gym memberships, fitness classes, mental-health services, ergonomic office equipment, and a short list of wellness-related expenses. The updated eligible-expenses list is attached, and we've added licensed nutritionists, registered massage therapy, and selected mindfulness apps to the list.

We're also introducing a new Dependant Care credit of $300 per dependant per year, up to two dependants. This credit can be applied against after-school enrichment, summer camps, or eldercare respite services. To claim, submit the new Dependant Care form (linked below) along with your receipts; reimbursements will be processed monthly.

Mental health remains a priority. Our Employee Assistance Programme (EAP) has expanded its counsellor roster and now offers appointments in eight additional languages. First-time users receive six sessions at no cost; additional sessions are available at a subsidised rate. The EAP contact details are unchanged and remain strictly confidential.

As always, if you have questions or feedback about the benefit programme, please reach out to People Operations directly. We'll hold two drop-in sessions over Zoom in the last week of May — details to follow.

Thank you for everything you do.

Warm regards,
The People Operations Team$SRC$,
    $INST$Translate this internal HR communication into the target language. The audience is the full employee base — register is professional but approachable.
- Preserve all specific figures ($500, $750, $300, 1 June 2025, six sessions) and dates exactly.
- Programme names (Employee Wellness Benefit, Dependant Care, Employee Assistance Programme / EAP, People Operations) should use the target-language equivalent if one is standard; otherwise translate literally on first mention with the English in parentheses.
- Maintain the collaborative "we" voice throughout.
- Preserve the subject line format and the sign-off structure.$INST$,
    '{"accuracy":0.25,"terminology":0.20,"fluency":0.20,"style":0.20,"locale":0.10,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  SELECT
    'general',
    'advanced',
    'General — Op-ed on urban transit',
    $SRC$When cities fail, they don't fail dramatically. They fail slowly, in rush-hour traffic jams and missed doctor's appointments, in the quiet calculation of a parent wondering whether the school bus will be reliable enough this week. The transit debate we keep having — light rail versus bus rapid transit, tolls versus fuel taxes, greenfield versus infill — is not really a debate about steel and concrete. It is a debate about what kind of city we want to be.

The argument for more robust public transit is often framed in environmental terms, and rightly so: transport accounts for a disproportionate share of urban emissions, and cars are the single largest contributor within that share. But the emissions argument, while correct, is also incomplete. Transit is first and foremost a question of access. Who can reach a hospital in twenty minutes? Who can take a job interview across town without asking a neighbour for a ride? Who can spend Saturday afternoon at a library in a different neighbourhood, and who is effectively trapped within a fifteen-minute walk of home?

Critics will point, fairly, to the cost of expanding transit networks. The per-kilometre numbers are daunting, and the political timelines are longer than any single election cycle. But the alternative — an endless rebuilding of arterial roads, widened again and again to accommodate induced demand — is not free either. It is simply a cost that spreads across thousands of individual fuel bills and vehicle purchases and hours lost, rather than appearing as a line item in a municipal budget.

The cities that have invested patiently, over decades, are not universally admired for their transit. What is admired is the kind of daily life that transit makes possible. Good transit is not, finally, about trains. It is about time: returned to commuters, to parents, to the young and the old and the people who cannot or do not drive. We should stop pretending the question is technical. It is a question of civic priorities, and we are running out of decades to answer it poorly.$SRC$,
    $INST$Translate this opinion editorial for a major newspaper's op-ed page. Target-audience is educated general readership.
- The register is elevated but not academic. Keep the essayistic rhythm — semicolons, long concessive clauses, rhetorical questions — rather than flattening to shorter sentences.
- Preserve the argumentative structure and each of the three central moves (framing critique → access argument → cost counterargument → values conclusion).
- Idioms and figures of speech ("a line item in a municipal budget", "running out of decades") should be rendered with target-language equivalents of similar rhetorical weight, not translated literally.
- Do not soften the author's voice — the piece is deliberately pointed.$INST$,
    '{"accuracy":0.25,"terminology":0.10,"fluency":0.30,"style":0.25,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  -- ============================ MEDICAL ==============================
  SELECT
    'medical',
    'beginner',
    'Medical — Medication instructions',
    $SRC$PRESCRIPTION: Amoxicillin 500 mg capsules

Patient: [Name as on prescription]
Date: [Date of issue]

HOW TO TAKE THIS MEDICINE

Take ONE (1) capsule by mouth THREE times a day, at approximately the same times each day — for example, at 8:00 am, 2:00 pm, and 8:00 pm. Continue taking the medicine for the full 7 days, even if you start to feel better before the course is finished. Stopping early can allow the infection to return and may make it harder to treat.

Swallow each capsule whole with a full glass of water. You may take this medicine with or without food, but taking it with food can help if it upsets your stomach.

POSSIBLE SIDE EFFECTS

The most common side effects are mild stomach upset, nausea, and loose stools. These usually go away on their own. Drink plenty of water. If diarrhoea is severe or lasts more than 2 days, contact your doctor.

Call your doctor or go to the nearest emergency department right away if you develop: a skin rash, itching, or hives; swelling of the face, lips, or tongue; difficulty breathing or swallowing; or severe watery diarrhoea with blood or mucus.

STORAGE

Keep this medicine in its original container, at room temperature, away from moisture and direct sunlight. Keep out of reach of children. Do not use after the expiry date printed on the box.

If you have any questions, speak with your pharmacist or doctor.$SRC$,
    $INST$Translate this consumer-facing medication instruction sheet into the target language.
- Target readability: grade 7–8. Avoid medical jargon where everyday language serves.
- Preserve ALL numeric values, units, times, and the drug name (Amoxicillin 500 mg) exactly.
- Preserve structural formatting (ALL CAPS section headings, bullet-like lines, enumerated instructions).
- Emergency-warning phrasing ("Call your doctor", "go to the nearest emergency department") must use the target language's standard clinical-safety wording.
- Placeholders [Name as on prescription], [Date of issue] stay in their original form.$INST$,
    '{"accuracy":0.35,"terminology":0.25,"fluency":0.20,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  SELECT
    'medical',
    'intermediate',
    'Medical — Hospital discharge summary',
    $SRC$DISCHARGE SUMMARY

Patient: [Redacted]
Medical Record Number: [Redacted]
Admitting Physician: Dr. P. Okafor
Discharging Physician: Dr. M. Leclerc
Date of Admission: 14 March 2025
Date of Discharge: 17 March 2025

ADMITTING DIAGNOSIS
Acute appendicitis

DISCHARGE DIAGNOSIS
Status post laparoscopic appendectomy; acute appendicitis without perforation

HOSPITAL COURSE

The patient is a 34-year-old female who presented to the Emergency Department with a 12-hour history of progressive right lower quadrant abdominal pain, associated with nausea and low-grade fever. Physical examination demonstrated tenderness at McBurney's point with rebound and guarding. White blood cell count was elevated at 14.2 × 10⁹/L with a left shift. Abdominal ultrasound was consistent with acute appendicitis.

The patient was taken to the operating theatre the same evening for laparoscopic appendectomy under general anaesthesia. The procedure was uneventful. The appendix was inflamed but not perforated; pathology confirmed acute suppurative appendicitis without peritonitis.

Postoperatively the patient was managed on a standard appendectomy pathway. She tolerated oral intake on postoperative day one, mobilised the same day, and had adequate pain control on oral analgesia by postoperative day two. There were no signs of infection, bleeding, or wound breakdown.

DISCHARGE MEDICATIONS
Acetaminophen 500 mg by mouth every 6 hours as needed for pain. Ibuprofen 400 mg by mouth every 8 hours as needed, with food. No antibiotics on discharge.

INSTRUCTIONS TO THE PATIENT
Keep the surgical dressings clean and dry for 48 hours. You may shower after 48 hours but avoid baths, pools, and hot tubs for two weeks. Avoid lifting more than 5 kg and strenuous activity for two weeks. Resume normal diet as tolerated.

FOLLOW-UP
Please attend the surgical clinic in 10–14 days for wound assessment. Return to the Emergency Department immediately if you develop fever above 38.5 °C, increasing abdominal pain, persistent vomiting, wound redness or discharge, or shortness of breath.$SRC$,
    $INST$Translate this hospital discharge summary for regulatory + patient use.
- Accuracy is critical. Every drug name, dose, unit, value, and date must be preserved exactly.
- Clinical terms (acute appendicitis, laparoscopic appendectomy, McBurney's point, white blood cell count, suppurative, peritonitis) must use the target country's standard medical vocabulary.
- The "INSTRUCTIONS TO THE PATIENT" block switches register to patient-facing; translate accordingly — grade 8 readability here, not technical register.
- Keep the section headings in ALL CAPS matching the source structure.
- [Redacted] placeholders stay unchanged.$INST$,
    '{"accuracy":0.35,"terminology":0.30,"fluency":0.15,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  SELECT
    'medical',
    'advanced',
    'Medical — Cardiology consultation report',
    $SRC$CARDIOLOGY CONSULTATION REPORT

Patient: [Redacted]
DOB: [Redacted]
Date of Consultation: 22 March 2025
Referring Physician: Dr. A. Chen (Internal Medicine)
Consulting Cardiologist: Dr. R. Nowak

REASON FOR CONSULTATION
New-onset palpitations and intermittent exertional dyspnoea over the preceding eight weeks, in a 58-year-old male with a history of type 2 diabetes mellitus and controlled hypertension.

HISTORY OF PRESENT ILLNESS
The patient describes episodes of irregular palpitations lasting several minutes, occurring approximately two to three times per week, unrelated to meals or posture. He reports mild shortness of breath climbing two flights of stairs, which was not previously the case. He denies chest pain at rest or with exertion, syncope, or pre-syncopal symptoms. There has been no recent change in his antihypertensive or antidiabetic regimen. No family history of sudden cardiac death; his father underwent coronary artery bypass grafting at age 62.

EXAMINATION
Heart rate 78 bpm, irregularly irregular. Blood pressure 132/84 mmHg, bilateral. Jugular venous pressure not elevated. Auscultation revealed normal first and second heart sounds with no murmurs, rubs, or gallops. Lungs were clear to auscultation bilaterally. No peripheral oedema. Distal pulses were equal and intact.

INVESTIGATIONS
12-lead ECG demonstrated atrial fibrillation at an average ventricular rate of 76 bpm, with no evidence of ST-segment or T-wave changes suggestive of acute ischaemia. Chest radiograph was unremarkable. Transthoracic echocardiogram showed preserved left ventricular systolic function (ejection fraction 55–60%), left atrial enlargement (indexed volume 38 mL/m²), mild mitral regurgitation, and no significant valvular stenosis. Laboratory investigations including thyroid function, electrolytes, and renal function were within normal limits; HbA1c was 7.1%.

IMPRESSION
New-onset non-valvular paroxysmal atrial fibrillation with structurally preserved left ventricular function. CHA₂DS₂-VASc score of 3 (hypertension, diabetes, age 58), placing the patient at moderate-to-high thromboembolic risk. HAS-BLED score of 1.

RECOMMENDATIONS
Initiate rate control with bisoprolol 2.5 mg daily, titrated to resting heart rate <100 bpm. Commence oral anticoagulation with apixaban 5 mg twice daily. Arrange transthoracic echocardiogram review and 24-hour Holter monitoring in six weeks. Patient counselled on stroke-risk signs and the importance of medication adherence.$SRC$,
    $INST$Translate this cardiology consultation report. Register is formal clinical; audience is fellow clinicians.
- Accuracy and terminology are paramount. Every clinical term (paroxysmal atrial fibrillation, CHA₂DS₂-VASc, HAS-BLED, HbA1c, jugular venous pressure, ST-segment, mitral regurgitation) must use the target country's standard medical vocabulary.
- Preserve ALL numeric values, units, and ranges exactly (78 bpm, 132/84 mmHg, EF 55–60%, 38 mL/m², 7.1%, CHA₂DS₂-VASc 3, HAS-BLED 1, bisoprolol 2.5 mg, apixaban 5 mg twice daily). Do not convert units.
- Drug names (bisoprolol, apixaban) stay in their international non-proprietary (INN) form.
- Preserve section headings in ALL CAPS and the structural format of the report.
- [Redacted] placeholders stay unchanged.$INST$,
    '{"accuracy":0.40,"terminology":0.35,"fluency":0.10,"style":0.05,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  -- ============================ LEGAL ==============================
  SELECT
    'legal',
    'beginner',
    'Legal — Residential lease clause',
    $SRC$CLAUSE 5 — RENT AND PAYMENT

5.1 The Tenant agrees to pay to the Landlord a monthly rent of one thousand eight hundred Canadian dollars (CAD $1,800.00), payable in advance on the first day of each calendar month during the term of this Lease.

5.2 Payment shall be made by direct deposit or pre-authorised electronic transfer to the account designated in writing by the Landlord from time to time. The Tenant shall not be deemed to have made payment until the funds have been received by the Landlord's financial institution.

5.3 If any monthly rent payment is not received within five (5) days of the due date, the Tenant shall pay to the Landlord a late fee of fifty Canadian dollars (CAD $50.00). The imposition of a late fee shall not constitute a waiver of the Landlord's right to exercise any other remedy available under this Lease or at law.

5.4 The rent set out in Section 5.1 shall not be increased during the first twelve (12) months of the term of this Lease. Any rent increase thereafter shall be made in accordance with applicable provincial residential-tenancy legislation, and the Landlord shall provide the Tenant with at least three (3) months' written notice of any such increase.

5.5 Rent is exclusive of utilities except as otherwise provided in Schedule A. The Tenant shall be responsible for establishing, maintaining, and paying for all utility accounts designated in Schedule A as the Tenant's responsibility.$SRC$,
    $INST$Translate this residential-lease clause into the target language for a bilingual tenancy agreement.
- Preserve all numeric values, currency amounts (spelled out AND in digits), and time periods (5 days, 12 months, 3 months) exactly.
- The paragraph numbering (5.1–5.5) must be preserved exactly.
- Defined terms (Tenant, Landlord, Lease, Schedule A) stay capitalised to match the source — this is legally significant and signals they are defined elsewhere in the document.
- Use the target jurisdiction's standard residential-tenancy terminology (e.g. in Quebec French, "Locataire"/"Locateur"; in France French, "Locataire"/"Bailleur" — pick according to target locale).
- "CAD $1,800.00" stays in this format. Do NOT convert or re-format currency.$INST$,
    '{"accuracy":0.30,"terminology":0.30,"fluency":0.15,"style":0.15,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  SELECT
    'legal',
    'intermediate',
    'Legal — Terms of Service excerpt',
    $SRC$7. USER CONTENT AND LICENCE

7.1 "User Content" means any text, image, audio, video, code, or other material that you submit, upload, transmit, or otherwise make available through the Service. You retain all ownership rights in your User Content. Nothing in these Terms transfers any ownership of User Content to the Company.

7.2 By submitting User Content to the Service, you grant the Company a worldwide, non-exclusive, royalty-free, sublicensable, and transferable licence to use, reproduce, modify, adapt, publish, translate, distribute, publicly display, and publicly perform your User Content in connection with operating, providing, and improving the Service. This licence is perpetual with respect to User Content you have submitted prior to deletion, and survives termination of your account to the extent necessary for the Company to (a) comply with legal obligations, (b) resolve disputes, and (c) maintain backups in the ordinary course of business.

7.3 You represent and warrant that you have all rights necessary to grant the licence in Section 7.2 and that your User Content does not and will not infringe, misappropriate, or violate any third party's intellectual property rights, rights of publicity or privacy, or any applicable law or regulation.

7.4 The Company has no obligation to monitor User Content but reserves the right, in its sole discretion, to remove, edit, restrict access to, or refuse to display any User Content that it believes, in good faith, violates these Terms, any applicable law, or the legitimate rights of third parties. The Company will not be liable to you or any third party for any action or inaction taken under this Section 7.4.

7.5 If you believe that any User Content on the Service infringes your rights, please follow the procedure set out in our Copyright and Intellectual Property Policy, which forms part of these Terms and is available at the URL provided in your account dashboard.$SRC$,
    $INST$Translate this Terms of Service excerpt into the target language for a bilingual user agreement.
- Preserve section numbering (7.1–7.5) exactly.
- Defined terms ("User Content", "Service", "Company", "Terms") are capitalised and quoted on first definition — preserve that convention. Once defined they stay capitalised throughout.
- The licence grant language (Section 7.2) is technically and commercially significant — translate the enumeration exactly (use, reproduce, modify, adapt, publish, translate, distribute, publicly display, publicly perform) without omission or compression.
- The representation-and-warranty in 7.3 must preserve the exact scope of "infringe, misappropriate, or violate any third party's…" — in the target language, use the standard civil-law or common-law equivalents of intellectual-property rights, publicity/privacy rights, and applicable law.
- Maintain the formal register throughout. Do not use contractions.$INST$,
    '{"accuracy":0.30,"terminology":0.30,"fluency":0.15,"style":0.15,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  SELECT
    'legal',
    'advanced',
    'Legal — Motion brief excerpt',
    $SRC$IN THE MATTER OF the Arbitration between Novus Manufacturing Inc. (Claimant) and Pacific Logistics Ltd. (Respondent)

RESPONDENT'S MOTION FOR DISMISSAL OF CLAIM — EXCERPT FROM PART II, "JURISDICTIONAL OBJECTIONS"

II. THE TRIBUNAL LACKS JURISDICTION RATIONE MATERIAE

12. The Claimant purports to bring a claim in respect of consequential damages allegedly arising from a shipment delay. The Respondent respectfully submits that the Tribunal lacks jurisdiction ratione materiae over such a claim. The governing arbitration agreement, contained at Article 19 of the Master Services Agreement dated 14 February 2022 (the "MSA"), expressly restricts its scope to "disputes arising out of or in connection with the performance of shipment services," and expressly excludes "any claims for consequential, special, punitive, or indirect damages, regardless of whether the party against whom such claim is asserted had been advised of the possibility of such damages."

13. It is a settled principle, reaffirmed by this Tribunal in its award in Case No. SCT-2019-114, paragraph 43, that a tribunal constituted under a limited arbitration clause cannot expand its jurisdiction by reference to doctrines of adhesion, reasonable expectations, or commercial practice. The Tribunal is bound by the four corners of the parties' written agreement. The scope of the arbitration clause is not a matter of what the Claimant wishes had been agreed; it is a matter of what was in fact agreed.

14. Even if, arguendo, the Tribunal were to find that the exclusion of consequential damages is not effective to exclude the present claim — a position the Respondent emphatically denies — the Claimant would still be required to establish that the claimed losses fall within the ordinary meaning of "damages arising out of or in connection with the performance of shipment services." The record plainly does not support such a conclusion. The losses claimed are admitted by the Claimant, at paragraph 27 of its Statement of Claim, to be "lost profits on a subsequent contract with a third-party purchaser." Such losses are, by any reasonable construction, consequential and therefore excluded by the plain terms of Article 19.

15. For the foregoing reasons, the Respondent respectfully requests that the Tribunal:

(a) hold that it lacks jurisdiction ratione materiae over the claim in respect of consequential damages;
(b) dismiss Parts III and IV of the Statement of Claim in their entirety; and
(c) award the Respondent its reasonable costs of this jurisdictional motion.$SRC$,
    $INST$Translate this arbitration motion excerpt. The target audience is legal practitioners.
- Latin terms (ratione materiae, arguendo) are conventionally preserved in their Latin form in most target jurisdictions — do NOT translate unless the target jurisdiction's convention is otherwise.
- Preserve ALL case references (Case No. SCT-2019-114, paragraph 43), agreement references (Article 19, MSA, 14 February 2022), and paragraph numbering (12–15, (a)–(c)) exactly.
- Party names (Novus Manufacturing Inc., Pacific Logistics Ltd.) and defined terms (MSA, Claimant, Respondent, Tribunal) stay unchanged.
- Legal-doctrine phrases ("doctrines of adhesion", "reasonable expectations", "four corners of the parties' written agreement") must use the target jurisdiction's equivalent doctrines, not a literal rendering.
- Formal legal register throughout. Preserve the structure of the enumerated conclusion (a)–(c).$INST$,
    '{"accuracy":0.35,"terminology":0.35,"fluency":0.10,"style":0.10,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  -- ============================ IMMIGRATION ==============================
  SELECT
    'immigration',
    'beginner',
    'Immigration — Personal statement letter',
    $SRC$To whom it may concern,

My name is Amin Rezaei. I am writing this statement in support of my application for permanent residence in Canada. I am a citizen of Iran and currently hold a study permit. I arrived in Canada on 3 September 2021 to begin a Master's programme in Environmental Engineering at the University of Waterloo, which I completed in June 2023.

During my studies I met my spouse, Sarah Thompson, a Canadian citizen, at a volunteer event organised by a campus environmental group in October 2022. We began a relationship in early 2023 and were married on 15 July 2024 in Toronto. Since that time we have lived together at 412 Rosedale Avenue in Toronto. I have submitted documentation of our marriage, our joint lease, and our joint bank account.

Over the past two years I have worked as an Environmental Analyst with Greenfield Consulting in Toronto. My work focuses on water-quality modelling for municipalities in Ontario. My supervisor, Dr. Helen Adebayo, has provided a letter describing my role and performance, which is attached.

My parents remain in Iran, but I am in regular contact with them by telephone and video call. My younger brother is a student in Germany. I have no other dependants.

I have followed all the terms of my study and work permits and have no criminal record in Canada or in Iran. A police certificate from each country has been attached.

I respectfully request that my application be considered favourably. Canada has become my home, and I hope to continue contributing to it as a permanent resident.

Sincerely,
Amin Rezaei$SRC$,
    $INST$Translate this personal statement for an immigration application. Register is formal but first-person; written by the applicant themselves.
- Names, places, dates, institutions, and addresses (Amin Rezaei, Sarah Thompson, 3 September 2021, 15 July 2024, 412 Rosedale Avenue, Greenfield Consulting, Dr. Helen Adebayo, University of Waterloo) stay unchanged.
- "To whom it may concern" uses the target language's standard equivalent for an unaddressed formal letter.
- If the target language has register distinctions between spoken and written first-person address, use the register appropriate for a formal written statement to a government authority.
- Degrees (Master's programme in Environmental Engineering), job titles (Environmental Analyst), and programme names use the target country's official vocabulary where an established equivalent exists; otherwise translate literally.$INST$,
    '{"accuracy":0.30,"terminology":0.20,"fluency":0.20,"style":0.15,"locale":0.10,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  SELECT
    'immigration',
    'intermediate',
    'Immigration — Affidavit of support',
    $SRC$AFFIDAVIT OF SUPPORT

I, Mariam Benhamou, of 1784 Saint-Laurent Boulevard, Apartment 6, Montréal, Québec, being of sound mind and competent to make this affidavit, do solemnly declare that:

1. I am a Canadian citizen, having been naturalised on 11 April 2015. A copy of my citizenship certificate is attached as Exhibit A to this affidavit.

2. I have known Youssef Traoré, the applicant for permanent residence, for nine (9) years, since we first met in May 2016 during our undergraduate studies at Concordia University. We have maintained a close personal relationship since that time.

3. From September 2019 until his departure for Mali in March 2022, Mr. Traoré resided at my address set out above. During that period he paid a proportionate share of the monthly rent and household expenses. I have attached, as Exhibit B, the signed roommate agreement and copies of e-transfers documenting his contributions.

4. Throughout the time I have known Mr. Traoré, he has demonstrated consistently exemplary character. He has volunteered weekly at the Maison des Aînés community kitchen in Outremont. He has maintained steady employment, most recently as a logistics coordinator at Import Solutions Québec. To the best of my knowledge he has never been involved in criminal activity of any kind in Canada, in Mali, or elsewhere.

5. I undertake, should Mr. Traoré be granted permanent residence, to provide whatever support is within my means during his initial period of re-establishment in Canada, including temporary accommodation in my home if required, until such time as he is able to secure independent housing and employment.

6. I make this affidavit in good faith, knowing it to be true, and with the understanding that it is made for the purposes of Mr. Traoré's application for permanent residence and that knowingly false statements in this affidavit may constitute an offence under the Immigration and Refugee Protection Act.

DECLARED BEFORE ME at Montréal, this _____ day of ____________, 2025.

_______________________________        _______________________________
Commissioner of Oaths                   Mariam Benhamou$SRC$,
    $INST$Translate this affidavit for an immigration file. Register is legal + declarative; audience is an immigration adjudicator.
- "I, [Name]… do solemnly declare that:" is a specific legal formula — use the target jurisdiction's standard affidavit opening.
- Paragraph numbering (1–6), exhibit references (Exhibit A, Exhibit B), and names/addresses/dates MUST be preserved exactly.
- "Commissioner of Oaths" uses the target country's equivalent authority (in Quebec, "Commissaire à l'assermentation"; in France, "officier public"; in Iran, equivalent notarial formula).
- The reference to the Immigration and Refugee Protection Act stays unchanged in text, optionally with a parenthetical translation on first mention for target-audience readability.
- Blank signature lines (_____) and placeholder dates ("this _____ day of ____________") stay in their original form.$INST$,
    '{"accuracy":0.35,"terminology":0.30,"fluency":0.10,"style":0.15,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb

  UNION ALL

  SELECT
    'immigration',
    'advanced',
    'Immigration — Response to Request for Evidence',
    $SRC$RESPONSE TO REQUEST FOR EVIDENCE (RFE)

Case Number: WAC-24-201-47392
Beneficiary: Dr. Priya Ramanathan
Petitioner: Helix Biosciences, Inc.
Classification Sought: EB-1B — Outstanding Professor or Researcher
Date of RFE: 14 January 2025
Date of Response: 28 February 2025

Counsel respectfully submits this response to the Request for Evidence issued by the United States Citizenship and Immigration Services on 14 January 2025. The Service has requested additional documentation to establish that the Beneficiary has attained international recognition as outstanding in her academic field of structural biology, and that her employment offer with the Petitioner is for a tenure-track or permanent research position.

I. INTERNATIONAL RECOGNITION

The Service has correctly identified the applicable regulatory standard at 8 C.F.R. § 204.5(i)(3)(i), which requires the Petitioner to demonstrate, by preponderance of the evidence, that the Beneficiary has attained "international recognition as outstanding in a specific academic field." The Service notes that the original petition submitted evidence under three of the six regulatory criteria: (A) receipt of major prizes or awards, (B) membership in associations requiring outstanding achievement, and (E) authorship of scholarly books or articles in the field.

In response to the Service's concern that the Beneficiary's citation record was not contextualised against peer norms, Counsel submits a supplemental expert-opinion letter from Prof. Aldo Romano of the European Molecular Biology Laboratory (Exhibit 14). Prof. Romano quantifies the Beneficiary's citation impact relative to structural-biology researchers at comparable career stages, concluding that her h-index of 37, accumulated within 11 years of doctoral completion, is at approximately the 92nd percentile for the field. We submit that this supplemental evidence resolves the Service's stated concern.

II. PERMANENCE OF THE OFFERED POSITION

The Service has further requested evidence that the position of Principal Investigator, Structural Biology Division, offered to the Beneficiary is a "tenure-track or comparable permanent research position." We respectfully direct the Service to Exhibit 15, a letter from the Petitioner's Chief Scientific Officer, Dr. Jonathan Weiss, which confirms that Principal Investigator positions at Helix Biosciences are offered on a permanent basis subject to the Company's standard at-will-employment framework, are comparable in tenure and job security to tenure-track positions at U.S. research universities, and carry no fixed term of employment.

While Counsel acknowledges the Service's observation that at-will positions are not identical to academic tenure, we respectfully submit that controlling regulations and INS Matter of Price, 20 I&N Dec. 953 (Assoc. Comm'r 1994), establish that equivalent permanence at a private research institution satisfies the regulatory requirement where, as here, the offer is for an indefinite term and the employer's customary employment practice does not include fixed-term appointments for this role.

III. CONCLUSION

For the reasons set forth above, we respectfully submit that the Petitioner has now established, by preponderance of the evidence, that the Beneficiary meets both statutory requirements for EB-1B classification. We respectfully request that the Service approve the petition.$SRC$,
    $INST$Translate this U.S. immigration legal response. Register is formal legal; audience is a USCIS adjudicator — even in the translated version, the translated text is intended for the applicant's and counsel's records (the U.S. filing remains in English).
- Preserve ALL case numbers, regulatory citations (8 C.F.R. § 204.5(i)(3)(i), INS Matter of Price, 20 I&N Dec. 953), dates, exhibit numbers, and party names EXACTLY.
- Standard U.S. immigration-law terminology (RFE, EB-1B, USCIS, Beneficiary, Petitioner, preponderance of the evidence, at-will employment, tenure-track) should use the target language's established translation if one exists in specialist immigration-legal literature; otherwise provide the English term on first mention with a parenthetical translation.
- Latin-style legal phrases ("by preponderance of the evidence") use the target jurisdiction's equivalent standard-of-proof terminology.
- The three-part structure (I, II, III) and the paragraph flow must be preserved exactly.
- Academic-metric terms (h-index, 92nd percentile, doctoral completion, peer norms) use the target language's standard academic vocabulary.$INST$,
    '{"accuracy":0.40,"terminology":0.35,"fluency":0.10,"style":0.05,"locale":0.05,"design":0.00,"non_translation":0.05}'::jsonb
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
  '[AI-DRAFT] ' || s.title_stem || ' (' || p.label || ')',
  p.src_id,
  p.tgt_id,
  s.domain,
  'domain_test',
  s.difficulty,
  s.source_text,
  s.instructions,
  NULL,
  s.rubric,
  false,
  0
FROM sources s, pairs p
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification
SELECT domain, difficulty, COUNT(*) AS rows_per_slot
FROM cvp_test_library
WHERE domain IN ('general', 'medical', 'legal', 'immigration')
  AND title LIKE '[AI-DRAFT]%'
GROUP BY domain, difficulty
ORDER BY domain, difficulty;
