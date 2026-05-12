# Fayza — Prerequisite Training
## Vendor Management & Scouting Foundations

**Document status:** v0.1 — prerequisite to QA Manager training
**Sprint window:** May 11 → June 12, 2026 (parallel to QA Manager sprint)
**Estimated study time:** 25-30 hours, front-loaded in Weeks 1-2 with continued reference throughout
**Position:** Read this first. Then the QA Manager training plan. Then the standards walkthrough pack and methodology pack.

---

## 1. Read this first — context for the transition

You're making a real career shift here: marketing outreach to vendor management to QA Manager, compressed into seven weeks before a pharma sponsor's vendor qualification audit. That's significant, and it deserves an honest framing.

**What's actually changing.** Marketing outreach builds awareness and generates inbound interest. Vendor management builds a *qualified, productive, retained network of linguists* who deliver translation work. Both involve communication, pipeline discipline, and relationship management — those skills come with you. What's new is the subject matter: the translation industry, how linguists work, how they're evaluated, how they're managed once onboarded.

**What you already have that matters.** Outreach discipline (knowing how to reach people, follow up, manage a queue). Communication craft (writing clearly, handling email at volume, building rapport). Pipeline thinking (tracking stages, conversion rates, where prospects drop off). Relationship building (the social-emotional skills of treating contacts as people, not records). All of this applies directly to scouting and managing translators.

**What you don't yet have, and need.** Translation industry literacy — terminology, role distinctions, how the work actually flows from a client requirement to a delivered translation. Linguist evaluation skills — how to read a CV, what credentials actually mean, what tests reveal, what references reveal. Industry-specific knowledge — life sciences vertical, COA work, the pharma sponsor mindset.

**The audit-relevant fact.** The auditor on June 29-30 will probe Cethos's vendor qualification function. The honest narrative — and it is the honest narrative — is: Fayza joined the vendor management function recently from a marketing role; she brings strong communication and pipeline management skills; she has been intensively trained in vendor management and quality assurance ahead of this audit, with external consultant support and a structured training program. This is defensible. It's also the truth. The audit doesn't require fabricated tenure.

**The sequencing.** Ideally vendor management mastery comes before quality management mastery. We don't have that luxury — both have to develop in parallel. This document gives you the vendor management foundations. The QA Manager training plan layers on the quality system formalism. Together they make you functional as a Quality Manager who knows the operational reality of the function she's now leading.

---

## 2. Goals by end of Week 2

By the end of sprint Week 2 (May 22), you should be able to:

- Explain the translation industry's structure, key players, and value chain in 5 minutes without notes
- Describe the difference between translator, reviser, reviewer, proofreader, post-editor, and interpreter without confusing them
- Walk through how a typical translation project flows from client inquiry to final delivery
- Read a translator's CV and identify their qualifications, working languages, specializations, and likely strengths and gaps
- Describe the Cethos Vetting Program (CVP) end to end and explain your role at each stage
- Navigate the `vendors`, `cvp_applications`, `cvp_translators`, `vendor_language_pairs`, and `languages` tables in the Cethos database with confidence
- Source candidate translators through the standard channels for life sciences / COA work
- Conduct an initial outreach conversation with a candidate translator, asking the right questions
- Identify the major translator professional bodies and what their certifications mean

This is roughly 25-30 hours of focused study over Weeks 1-2, layered with sprint work. After Week 2, vendor management knowledge continues to deepen alongside the QA Manager training, but you're functional enough to start authoring vendor management SOPs from Week 3.

---

## 3. Part I — The translation industry, in 90 minutes

The shortest possible orientation. Read this first.

### 3.1 What translation services actually are

Translation is the rendering of written content from one language (the source) into another (the target). It's distinguished from interpretation, which is oral. The translation industry produces a service, not a product — every translation is unique to the source content and the client's purpose.

Industry size: globally about USD 60 billion annually. The Canadian market is smaller but specifically active in certified translation (immigration, legal, government), life sciences (clinical trials given Canada's pharma research footprint), and bilingual (English-French) general business work.

### 3.2 Who buys translation

Five broad customer segments matter for Cethos:

**Life sciences / pharma.** Clinical trials, regulatory submissions, pharmacovigilance, marketing materials. High-stakes, methodology-driven (especially for clinical outcome assessments), well-funded, audit-heavy. The pharma sponsor whose vendor qualification audit is June 29-30 is in this segment.

**Government and immigration.** IRCC (Immigration, Refugees and Citizenship Canada) certified translation work, court translations, government documents. Regulated, often single-document, certificate-of-accuracy-driven.

**Corporate / business.** Marketing, internal communications, legal documents, financial reports. Varies widely in volume and quality expectations.

**Legal.** Contracts, litigation documents, sworn translations, certified copies. Often urgent, accuracy-critical.

**Education and academic.** Certificate translations, academic credentials, research papers. Volume-light, certification-heavy.

### 3.3 Who provides translation — the supply side

Three structural players:

**LSPs — Language Service Providers.** Companies like Cethos. They manage projects, qualify linguists, deliver to clients. Range from solo operators to global enterprises with 5,000+ staff (TransPerfect, RWS, Lionbridge). Cethos sits in the small-to-medium-enterprise range, with strong specialization in certified, life sciences, and community interpreting work.

**Freelance linguists.** Individual translators, revisers, interpreters who work directly with clients or through LSPs. Most translators are freelancers. They typically work with multiple LSPs and direct clients. Their availability, rates, and quality vary widely — vendor management is partly about navigating this.

**In-house translators.** Translators employed full-time by an organization (government, large corporation, occasionally large LSPs). Less common in Canada outside government.

The Cethos linguist network is overwhelmingly freelance, with a small in-house staff component. The 1,468 linguists in the `vendors` table are nearly all freelance.

### 3.4 The translation value chain

Simplified flow from client request to delivery:

1. **Client inquiry.** Client requests a quote or service.
2. **Feasibility and quoting.** LSP assesses whether they can deliver (language pair, specialty, timeline) and produces a quote.
3. **Agreement.** Client accepts; project is formally booked.
4. **Project specification.** Source, target, purpose, audience, timeline, format, deliverables documented.
5. **Resource assignment.** Translator assigned based on language pair and subject matter qualification.
6. **Translation production.** Translator translates using CAT tool, terminology, reference materials.
7. **Translator self-check.** Translator reviews own work before submitting.
8. **Revision.** Different qualified person bilingually reviews target against source.
9. **Final QC.** Project manager performs final verification and release.
10. **Delivery.** Client receives the final translation.
11. **Feedback and closure.** Client feedback captured; project records archived.

For ISO 17100-scoped projects, revision (step 8) is mandatory and must be performed by someone other than the translator. For COA / linguistic validation projects, additional steps (back translation, reconciliation, cognitive debriefing, harmonization) apply per the methodology pack.

### 3.5 Industry terminology you'll hear daily

| Term | Meaning |
|---|---|
| LSP | Language Service Provider |
| TSP | Translation Service Provider (ISO 17100 term, narrower than LSP) |
| Source / target | source language / target language |
| Language pair | a source-target combination, e.g., EN→FR |
| Working languages | the languages a linguist works in |
| Native language | the linguist's first language (typically also their target language for translation) |
| CAT tool | Computer-Assisted Translation tool: Trados, MemoQ, Wordfast |
| TM | Translation Memory: a database of previously translated segments |
| Terminology / terminology management | controlled vocabulary specific to a client, domain, or project |
| Style guide | written conventions for tone, voice, formatting |
| Glossary | a project-specific term list |
| Segment | a sentence-sized chunk of text in a CAT tool |
| Word count / source word count | typical pricing unit; based on source text |
| Per-word rate | rate charged per source word |
| MT | Machine Translation |
| MTPE / PEMT | (Machine Translation) Post-Editing |
| Localization (L10n) | adapting content for a specific locale, including language plus cultural/regulatory considerations |
| QA (in translation) | Quality Assurance; automated and manual checks on translation output |
| LQA | Linguistic Quality Assurance, often a sampled review by a third linguist |
| MQM | Multidimensional Quality Metrics, an industry-standard error taxonomy |
| DTP | Desktop Publishing, post-translation formatting |
| Vendor management / VM | the function you're now in |
| Linguist | catch-all for translator, reviser, interpreter, post-editor |
| Subject matter expert / SME | a domain expert (clinician, lawyer, engineer) consulted on specialized content |

You don't need to memorize this list. Read it once, then learn by context as terms come up in actual conversations and SOPs.

### 3.6 Quick-reference summary — Part I

- Translation services: written rendering source → target; distinguished from interpretation (oral)
- Customers: life sciences (highest-stakes), government, corporate, legal, academic
- Suppliers: LSPs (like Cethos), freelance linguists (most translators), in-house
- Value chain: inquiry → quote → agreement → specifications → assignment → translation → check → revision → final QC → delivery → closure
- Cethos's linguist network is overwhelmingly freelance (~1,468 vendors)

---

## 4. Part II — Linguist roles and what they actually do

The roles you'll be evaluating and managing. Conflating these is the single most common rookie mistake in vendor management.

### 4.1 Translator

The person who produces the translation. Their job: take source content and render it accurately, naturally, and faithfully into the target language, observing specifications and terminology.

A qualified ISO 17100 translator meets one of three competence paths (see standards pack Part I §4.1.2 for the full description):
- Degree in translation
- Degree in any other field + 2 years documented translation experience
- 5 years documented translation experience

Plus competence in: translating, source language fluency, target language fluency, research, cultural awareness, technical (CAT tools), and domain (subject matter).

**What you look for in a translator:**
- Native speaker of the target language (default assumption — exceptions exist but are rare)
- Documented qualification or experience per ISO 17100
- Subject matter relevance for the work they'd be assigned
- Reliability and communication track record
- CAT tool fluency for the relevant tools
- Rates within the band the work supports

### 4.2 Reviser

A more experienced linguist who reviews the translator's work bilingually — comparing target against source for accuracy, completeness, terminology, fluency. ISO 17100 requires that the reviser be **a different person from the translator on the same project**.

A qualified reviser meets translator competence + documented revision experience + relevant subject matter expertise.

**What you look for in a reviser:**
- All the translator qualifications, plus
- Documented revision experience (typically 2-3+ years of working as a reviser, not just as a translator)
- Domain expertise solid enough to catch substantive errors (especially in life sciences — a non-medical reviser will miss clinical errors)

In practice, most experienced translators can revise — the reviser pool is a subset of the translator pool with additional experience.

### 4.3 Reviewer (different from reviser)

A domain expert who reads the target language only — checks the translation for suitability for the intended audience and purpose. May not speak the source language at all.

Reviewers are used when client agreement specifies. Common for medical content where a clinician reviews readability for patients, or legal content where a lawyer reviews enforceability.

**What you look for in a reviewer:**
- Domain expertise (clinical, legal, regulatory)
- Native or near-native target language proficiency
- Doesn't need to be a translator

### 4.4 Proofreader

Final correction pass on revised translation. Catches typos, formatting issues, consistency problems. Doesn't need full translator competence.

In practice often performed by the project manager or a junior linguist.

### 4.5 Post-editor

A specialized translator who edits raw machine translation output to bring it to publishable quality. Per ISO 18587, must meet translator competence plus MT post-editing training or experience.

Cethos position on COA: MT post-editing is **not used** for clinical outcome assessment work. It may be used for other content types where appropriate.

### 4.6 Interpreter

A linguist who interprets spoken language in real time. Distinct skill set from translation — interpreters work under different cognitive and emotional pressures.

ISO 18841 + NSGCIS govern interpreter qualifications. Modes:
- **Consecutive**: interpreter speaks after the source speaker pauses (most common in community interpreting)
- **Simultaneous**: interpreter speaks at the same time as the source speaker (conference, often with equipment)
- **Sight translation**: oral rendering of a written document
- **OPI**: Over-the-Phone Interpreting
- **VRI**: Video Remote Interpreting

Cethos provides all modes. The qualified interpreter pool is separate from the translator pool, with some overlap.

### 4.7 Project manager

The Cethos internal staff role that coordinates projects. PMs assign linguists, manage timelines, communicate with clients, oversee QA, handle closure. Different role from linguist roles; covered in your QA Manager training territory rather than scouting.

### 4.8 Common confusions you'll see and need to correct

- **"Translator" used as a catch-all** — sometimes people say "translator" meaning any linguist. In ISO 17100 context, translator has a specific meaning. Use "linguist" for the catch-all.
- **"Revision" vs "review"** — bilingual against source vs monolingual for fitness. These are different ISO 17100 steps. Don't confuse them.
- **"Translator" vs "interpreter"** — written vs oral. Some people mix these up. They're very different skills.
- **"Editor" vs "reviser" vs "proofreader"** — editor is not an ISO 17100 term. Reviser is bilingual review; proofreader is final correction.

### 4.9 Quick-reference summary — Part II

- Translator produces; reviser bilingually reviews against source; reviewer monolingually reviews for fitness; proofreader corrects final
- Reviser ≠ translator on the same project (ISO 17100 mandate)
- Post-editor edits MT output; not used at Cethos for COA work
- Interpreter is a different skill set; modes matter (consecutive, simultaneous, OPI, VRI)
- "Linguist" is the catch-all term

---

## 5. Part III — Translator sourcing and scouting

How to find good translators for the Cethos network. This is where your marketing skills apply most directly.

### 5.1 Where translators come from — six channels

**Channel 1: Direct application.** Translators apply through the Cethos website or by emailing inquiries. The Cethos Vetting Program is the structured intake for these. This is your highest-quality inbound channel because applicants self-select for interest in working with Cethos.

**Channel 2: Professional body directories.** ATA, CTTIC, ATIA, IMIA, CCHI, NBCMI all maintain searchable directories of certified members. These are publicly available. You can identify candidates by language pair, specialization, location.

**Channel 3: ProZ.com and TranslatorsCafé.com.** The two major industry job boards / community sites. Translators post profiles; LSPs post jobs; you can search by language pair, specialty, rate band. ProZ is the larger and more globally diverse; both are useful.

**Channel 4: LinkedIn.** Translators are increasingly active on LinkedIn. Search by language, specialty, certifications. Cold outreach works if framed thoughtfully — your marketing background helps here.

**Channel 5: Referrals from existing linguists.** Cethos's qualified translators know other qualified translators. A "do you know anyone who works in [pair / specialty]" message to a trusted translator often produces high-quality leads.

**Channel 6: Conferences and events.** ATA conference, NAJIT conference (Raminder is attending June 5-7 in Atlanta), Critical Link conference, ISPOR meetings. In-person networking produces strong leads, especially for specialized work like COA.

### 5.2 What "good" means — six markers

Not every translator who can render a sentence is suitable for Cethos's work. Markers of a translator worth pursuing:

**Marker 1: Native target language.** A French speaker who learned English to professional level can translate English into French, not French into English. Native-into-target is the industry norm.

**Marker 2: Documented credentials.** Degree in translation, professional body certification, or substantial documented experience. ISO 17100 §3.1.4 paths apply.

**Marker 3: Subject matter specialization.** Generalist translators exist; specialized translators are more valuable. For Cethos's COA work, life sciences specialization is non-negotiable.

**Marker 4: CAT tool fluency.** Cethos workflows assume Trados, MemoQ, or Wordfast competence. A translator who has never used a CAT tool is significantly less valuable than one who has.

**Marker 5: Professional communication.** Responses to outreach are timely, clear, professional. A translator who takes three weeks to reply to an email will be a problem in production.

**Marker 6: Realistic rates.** Translators with rates dramatically below industry norms are often inexperienced or producing low-quality work. Translators with rates dramatically above industry norms may not be cost-fit for Cethos's work. Industry norms vary by language pair, specialization, region — your consultant can help calibrate.

### 5.3 Outreach craft — applying your marketing skills

Cold outreach to a translator is similar in structure to your marketing outreach experience, with adjusted content. Three principles:

**Be specific about why you're reaching out.** Generic "we're looking for translators" gets ignored. Specific "we have an upcoming life sciences project requiring EN→ES translators with clinical specialization, and your CTTIC certification and ATA medical specialty caught my attention" gets responses.

**Treat them as professionals, not vendors.** Translators are skilled specialists, and many have been approached badly by LSPs treating them as commodities. Tone matters. Address them as colleagues.

**Make the next step low-friction.** Don't ask for 47 documents upfront. Initial outreach offers a short conversation; if interested, point to the CVP application process; let them choose to engage formally.

**Sample first-contact email structure:**

> Subject: EN→ES medical translation — Cethos Solutions
>
> Hi [Name],
>
> I'm Fayza from Cethos Solutions, a Calgary-based language services company specializing in life sciences and certified translation. We're expanding our network of medical translators for English-to-Spanish work, with a particular focus on clinical outcome assessment (COA) and regulatory content.
>
> Your profile on [where you found them] suggested a strong match — particularly your [specific qualification or experience point]. I'd be interested in a brief conversation to see if there's a fit on both sides.
>
> If you'd like to explore, I'd suggest 15 minutes by phone or video at your convenience next week. Alternatively, our formal application process is at [link] if you prefer to start there.
>
> Either way, thank you for your time.
>
> Fayza
> Cethos Solutions
> [contact info]

This is the structure to adapt; specifics vary by candidate. Personalize the "specific qualification" point — generic templates get treated as spam.

### 5.4 The Cethos Vetting Program (CVP) — where leads become candidates

Once a translator expresses interest, the formal pathway is the CVP. The CVP is Cethos's structured qualification pipeline. End-to-end:

**Stage 1: Application.** Translator submits a CVP application via the Cethos website. Captured in `cvp_applications` table. Fields include role type, education, certifications, work samples, services offered, language pairs, domains. The application can also branch into specialty types — clinician translator, COG (cognitive debriefing) translator, interpreter, transcriber — with role-specific fields.

**Stage 2: AI prescreening.** The application is automatically scored. AI evaluates the credentials, work samples, and stated capabilities, producing a prescreen score and surfacing flags for staff review. Flags are things like: inconsistent rate vs experience, work samples that don't match claimed language pairs, education claims that don't verify, etc.

**Stage 3: Staff review of prescreen.** You (or vendor management staff) review the prescreen output and decide whether to advance the candidate. Decisions are logged in `cvp_prescreen_flag_feedback`, which also trains the AI over time.

**Stage 4: Testing.** Advanced candidates are assigned tests from `cvp_test_library` (63 tests as of last count, indexed by source/target language × domain × service type). Tests are sized to evaluate the specific competences needed. The combination of tests assigned is recorded in `cvp_test_combinations`. The candidate submits test responses; the submission is captured in `cvp_test_submissions` with AI assessment scores and MQM dimension breakdowns.

**Stage 5: Reference checks.** Where applicable, formal reference checks are conducted. Captured in `cvp_application_reference_requests` and `cvp_application_references`. AI may pre-analyze references.

**Stage 6: Decision.** A decision is made based on testing, references, prescreen. Captured in `cvp_application_decisions` with AI-processed staff notes and outbound message. Possible decisions: approved (advance to onboarding), rejected (with reasoning, possibly with `can_reapply_after` date), waitlist (specific reason).

**Stage 7: Onboarding.** Approved candidates are onboarded — NDA signed, training assigned, system access granted, vendor record created. The candidate graduates from `cvp_applications` into `cvp_translators` and is linked to the `vendors` table.

**Stage 8: Ongoing performance management.** The qualified linguist is now in the production network. Performance is tracked through revision findings, on-time delivery, customer feedback, complaints. Performance signals feed re-qualification decisions and pool composition.

### 5.5 Where you sit in this pipeline

As vendor management / scouting lead, you operate primarily at Stages 1-3 (intake, prescreen review) and Stage 8 (ongoing performance and relationship). Stages 4-7 (testing, references, decision, onboarding) are heavily AI-supported with staff review where needed; you'll participate in decisions but the workflow drives them.

For the audit-readiness sprint specifically, your scouting work focuses on building the qualified COA pool — identifying 20-50 translators meeting ISO 17100 §3.1.4 + life sciences subject matter + active NDA. Some of these are already in the CVP pipeline. Some need to be re-engaged from the `vendors` table. Some may need fresh sourcing if specific language pairs are under-covered.

### 5.6 Quick-reference summary — Part III

- Six sourcing channels: direct application, professional bodies, ProZ/TranslatorsCafé, LinkedIn, referrals, conferences
- Six markers of a good candidate: native target, credentials, specialization, CAT tools, communication, realistic rates
- Outreach craft: be specific, treat as professionals, make next steps low-friction
- CVP pipeline: 8 stages from application to ongoing performance management
- Your scouting role concentrates on Stages 1-3 and 8

---

## 6. Part IV — Translator evaluation

How to assess a candidate beyond the AI prescreen. Sound judgment here is what separates a competent vendor manager from someone who just clicks "approve."

### 6.1 Reading a CV — what to look for

Translation CVs vary widely in format. The five things to extract:

**Working languages.** Source(s) and target(s), with native vs working distinction. Be precise — "English" alone is ambiguous; "English (native, US)" and "English (C2, professional working)" are different.

**Qualifications.** Degrees (in translation or in other fields), professional certifications (ATA, CTTIC, ATIA, ITI, etc.), specialized training (medical translator, legal interpreter, etc.). Note the issuing body and year.

**Experience.** Years of professional translation work, prior employers or clients (with permission to verify), volume indicators (annual word counts, project counts).

**Specializations.** Subject matter domains claimed. Be skeptical of CVs claiming ten specializations — meaningful specialization usually means three to five focused domains.

**CAT tools.** Which tools, what proficiency level (basic / proficient / expert).

### 6.2 Red flags on a CV

A CV with several of these warrants extra scrutiny:

- Working language claims that don't match nationality or education (a person claiming native English with all schooling in another country and no documented English exposure)
- Vague experience ("10+ years experience" with no employers or project examples)
- Generalist claims with no specialization (everything from poetry to nuclear engineering)
- Rates dramatically out of band (very low suggests inexperience; very high suggests potential mismatch for typical work)
- Missing dates (gaps that aren't explained)
- Self-certification ("ATA Certified" without specifying the language pair and year)
- All experience with a single client (concentration risk; what happens when that client ends)

A CV with one red flag is normal; three or more warrants serious skepticism.

### 6.3 Verifying credentials

ISO 17100 §3.1.4 requires *documented* competence — meaning verifiable. Verification methods:

**Degree verification.** Direct check with the issuing institution's registrar (most reliable). Alternatively, credential evaluation service (WES, IQAS) — common for foreign-educated translators. Or visual inspection of an original/notarized copy with documented review.

**Certification verification.** Most professional bodies (ATA, CTTIC, ATIA) maintain online verification of certified members. Search by name; confirm certification status and language pair. Note the verification method in `qms.competence_evidence`.

**Experience verification.** Reference letters from prior employers or clients (verify by direct contact); tax records (rare to request but acceptable); prior agency project records.

The standard for the COA pool is: every competence claim has a verified document on file. Self-attestation is not sufficient under ISO 17100.

### 6.4 Test assessment

Tests in the `cvp_test_library` are scored automatically by AI plus assessed by staff. Your involvement in test review focuses on:

- Disagreement with AI assessment — when you believe the AI score over- or under-rates the submission
- Borderline cases where the AI score is ambiguous
- Specialty assessments where domain judgment is required (clinical accuracy in a medical text, for instance)

The MQM error taxonomy is the framework most tests use. Categories: accuracy errors (mistranslation, omission, addition), fluency errors (grammar, register, terminology), and style errors. Severity: minor (annoying), major (changes meaning or usability), critical (renders the translation unusable or potentially harmful).

For COA work, accuracy errors at major or critical severity are essentially disqualifying — clinical equivalence cannot tolerate them.

### 6.5 Reference checks

When references are requested:

**Who to ask.** Prior LSPs the translator worked with (not direct clients, who may have less perspective on translation quality). Project managers who can speak to delivery reliability. Other linguists who have revised the candidate's work (best perspective on quality).

**What to ask.** Reliability and communication; quality of work delivered; specific strengths and weaknesses; would the reference work with the translator again; any concerns to share.

**Red flags in references.** Hesitation when asked "would you work with this person again"; vague answers; references whose details don't match the candidate's claims; references the candidate provided who turn out to be friends rather than professional contacts.

### 6.6 Cultural fit and reliability indicators

Beyond credentials and skill, translators succeed at Cethos based on a few softer factors:

- **Responsiveness.** Do they reply to emails within 24-48 hours during business days?
- **Professionalism.** Communications are courteous, accurate, free of typos in their own working languages.
- **Reliability.** Stated availability matches actual availability; deadlines are met.
- **Receptiveness to feedback.** When given revision feedback, do they incorporate it productively or do they argue every change?
- **Long-term thinking.** Are they treating Cethos as a one-off or as a relationship to invest in?

These factors don't show on a CV. They emerge through outreach, initial conversations, test interaction, first project. Track them in `qms.linguist_performance_snapshot` over time.

### 6.7 The qualification decision

For COA pool admission, a candidate must satisfy all of:

- ISO 17100 §3.1.4 competence (one of the three paths) — verified
- Subject matter qualification: life sciences / clinical — documented
- Language pair qualification — native target plus documented working source
- Test performance acceptable for COA work — typically no major or critical accuracy errors
- References positive or no significant negatives
- NDA signed
- Reasonable expectations on rate
- Communication and reliability indicators positive

Borderline cases get discussed with Raminder. Document the decision and rationale in `cvp_application_decisions`.

### 6.8 Quick-reference summary — Part IV

- Five CV things: languages, qualifications, experience, specializations, CAT tools
- Seven CV red flags: mismatched native claim, vague experience, generalist excess, off-band rates, gaps, self-certification, single-client concentration
- Verification: registrar check (degrees), professional body lookup (certifications), reference contact (experience)
- Tests: MQM framework; accuracy errors major/critical are disqualifying for COA
- References: ask other LSPs and project managers; "would you work with them again" is the killer question
- Soft factors: responsiveness, professionalism, reliability, feedback receptiveness, long-term thinking

---

## 7. Part V — Vendor relationship management

Once a linguist is qualified and onboarded, what's the ongoing relationship?

### 7.1 The relationship reality

Freelance linguists choose which LSPs to work with based on three factors, roughly in this order:

1. **Predictability of work.** Steady project flow at predictable cadence.
2. **Rate.** Pay that's fair for the work.
3. **Treatment.** How they're communicated with, paid on time, given reasonable specifications, supported.

Cethos competes on factors 2 and 3 — small enough to provide good treatment, specialized enough to pay fair rates for life sciences work. Treatment is your differentiator.

### 7.2 Onboarding done right

A new linguist's first 30 days in the Cethos network set the tone for everything that follows. The onboarding sequence:

**Day 1 — Welcome.** Personal email from you welcoming them; brief overview of what to expect; introduction to the project manager who'll be assigning them work.

**Day 1-3 — Documentation.** NDA signed; payment information collected; CAT tool access (or confirmation of their existing tools); training materials sent.

**Day 3-7 — Training completion.** Required training (COA methodology, data handling, Acceptable Use Policy acknowledgment) completed and recorded.

**Day 7-14 — First small project.** A modest first assignment to confirm fit. Not the highest-stakes work; not a throwaway test. Something representative.

**Day 14-30 — Check-in.** A short conversation after the first project to gather their experience, address any friction, set expectations going forward.

The goal: by Day 30, the linguist has a clear picture of how Cethos works, has produced one successful piece of work, and has had a personal touchpoint that signals this is a real professional relationship.

### 7.3 Communication rhythm

Ongoing communication patterns that work:

**Project communication.** Project-specific communications come from project managers, not from you. Your role is the relationship, not the project. A vendor manager who's constantly in project specifics confuses the lines.

**Periodic check-ins.** A short message every 2-3 months to active linguists: "how are things going, any feedback on recent projects, any availability changes." Doesn't need to be elaborate. Signals presence.

**Performance feedback.** When a linguist's work generates positive feedback (a customer compliment, a clean revision, an on-time delivery on a tough deadline), forward it to them. Translators rarely hear "good job" — it stands out.

**Difficult feedback.** When work has issues, the project manager handles the immediate communication. Your role kicks in when patterns emerge — three projects with similar issues, repeated late deliveries, recurring quality concerns. That conversation is yours.

### 7.4 Difficult conversations

Three types you'll need to handle:

**Performance feedback conversations.** When a linguist's work has fallen below expectations and you need to discuss it. Frame: specific observations (not vague impressions); impact on the work; what change is needed; offer of support if appropriate (additional training, revised specifications). Document the conversation in the linguist record.

**Rate discussions.** When a linguist wants a higher rate, or when Cethos needs a lower rate for a specific opportunity. Be direct about Cethos's position; understand theirs; reach a documented agreement or a documented disagreement. Don't sandbag — if a rate is unsustainable for Cethos, say so.

**Suspension or offboarding conversations.** When a linguist needs to be removed from the active pool, either temporarily (suspension pending remediation) or permanently (offboarding). These are the hardest. Frame: specific reasons (per the performance record); decision (suspend or offboard); what the linguist can do to address it (if applicable); next steps administratively (access revocation, payment of any outstanding balance, NDA continuing obligation). Document.

These conversations are professional, not personal. Your marketing background hasn't typically required these specific conversations — your consultant can role-play them with you during the sprint.

### 7.5 Retention — keeping good linguists engaged

A qualified linguist who stops working with Cethos is a loss. Retention factors:

- Predictable project flow (the biggest retention factor)
- Timely payment (Cethos's payment terms must be honored — every late payment damages trust)
- Reasonable specifications (clear scope, achievable timelines, sane queries)
- Respect (treating linguists as professionals; not micromanaging; trusting their expertise)
- Recognition (acknowledging good work; positive feedback when it occurs)
- Growth (offering interesting work, expanding their specialization with you)

When a good linguist starts declining projects, find out why. Sometimes it's external (their availability changed). Sometimes it's internal (something about working with Cethos has degraded). Both are worth knowing.

### 7.6 Performance monitoring at scale

For 1,468 vendors, monitoring everything is impractical. The Cethos system surfaces signals:

- Revision finding rates per linguist
- On-time delivery rates
- Customer feedback (positive and negative)
- Complaint involvement
- Project decline rates (how often they say no when offered work)
- Activity recency (have they worked recently?)

The `qms.linguist_performance_snapshot` materialized view aggregates these. Your job is to review the dashboard regularly (weekly during the sprint; monthly thereafter) and flag linguists whose signals warrant intervention — coaching, suspension, retention conversation, or removal.

### 7.7 Quick-reference summary — Part V

- Linguists choose LSPs by predictability, rate, treatment
- Onboarding sequence: Day 1 welcome → Day 1-7 docs and training → Day 7-14 first small project → Day 14-30 check-in
- Communication: project comms from PMs; periodic check-ins from you; positive feedback when it occurs; pattern-level feedback from you
- Three difficult conversations: performance, rates, offboarding
- Retention factors: project flow, payment, specifications, respect, recognition, growth
- Performance monitoring is signal-based, not exhaustive

---

## 8. Part VI — The life sciences / COA vertical

Why this vertical is different, and what scouting and managing linguists for it requires.

### 8.1 Why life sciences is different from generalist translation

Three things distinguish life sciences translation work:

**Regulatory consequence.** A translation error in a clinical outcome assessment can affect patient safety reporting in a regulatory submission. A translation error in a drug label can affect prescribing decisions. The stakes are higher than general translation work.

**Methodology-driven.** COA work follows specific multi-step methodologies (forward translation, back translation, reconciliation, cognitive debriefing, harmonization). General translation work is process-driven but not methodology-driven to the same extent.

**Sponsor scrutiny.** Pharma sponsors have vendor QA functions specifically to evaluate translation suppliers. They audit, they test, they request documentation. General translation work is mostly buyer-trust based; life sciences is documentation-based.

### 8.2 The patient-reported outcome (PRO) instrument

A PRO instrument is a questionnaire that captures the patient's own report on how they feel, function, or experience their condition. Examples:

- A pain scale (rate your pain 0-10)
- A quality-of-life questionnaire (EQ-5D, SF-36)
- A symptom diary (in disease X, report frequency and severity of symptom Y)
- A functional ability scale (in disease X, can you perform activities A, B, C)

PRO instruments are developed in one source language (typically English) and validated psychometrically — meaning the instrument has been demonstrated to measure what it's supposed to measure consistently and reliably. When the instrument is used in a multi-country clinical trial, it must be translated into the languages of the trial countries — but the translation must preserve psychometric equivalence.

This is what linguistic validation methodology produces: a translated instrument plus the documentary evidence that it measures the same construct as the original.

### 8.3 The pharma sponsor mindset

Pharma sponsors approach translation suppliers with two priorities:

**Risk management.** A bad translation creates regulatory risk, patient safety risk, and trial integrity risk. The sponsor's vendor QA function exists to mitigate these. Their default stance toward a vendor is "verify, then trust."

**Documentation.** Every methodology step generates records. The records become part of the regulatory submission. The sponsor needs to receive complete, audit-ready documentation, not just translated files.

This is why the methodology pack matters more than translation quality alone. Excellent translation with poor documentation can fail a sponsor audit. Adequate translation with excellent documentation often passes.

### 8.4 What COA translators need to know

A translator joining Cethos's COA pool needs working knowledge of:

- The COA methodology cycle (forward → back → reconciliation → cognitive debriefing → harmonization)
- Conceptual equivalence — the goal isn't literal translation, it's measurement equivalence
- Documentation discipline — translator notes, decision rationale, captured at the time of translation
- Clinical/medical terminology in the target language
- Sponsor-specific style guides and terminology (varies by sponsor and project)
- Confidentiality protocols specific to clinical trial materials

Cethos's COA methodology training (referenced in your QA Manager training plan) is what brings new translators up to speed on these. As vendor manager, you ensure every translator added to the COA pool has completed this training and acknowledged the methodology.

### 8.5 Scouting specifically for COA

Where to find COA-capable translators specifically:

- ISPOR membership directories (ispor.org) — translators specifically active in PRO/COA work
- ATA Medical Translation Division — specialized within ATA
- IMIA (medical interpreters but with translation overlap)
- Linguistic validation specialist LSP networks — translators who've worked with the major LSPs in this space (Mapi, RWS Linguistic Validation, BioScript, ICON) and may freelance directly
- Conferences: ISPOR meetings (annual North America in May; international in November); ASHA conventions
- Direct referral from existing COA-qualified Cethos translators

Quality markers for COA candidates:
- Documented life sciences subject matter (clinical, medical, regulatory, pharma corporate)
- Prior experience on PRO/COA work (named projects or sponsor types)
- Familiarity with linguistic validation methodology (ISPOR principles, ideally Wild et al. references)
- Health sector clinical background (a translator who's also a nurse or pharmacist is highly valuable; rare but exists)

### 8.6 Quick-reference summary — Part VI

- Life sciences translation is regulatory-consequence, methodology-driven, sponsor-scrutinized
- PRO instruments measure patient self-reports; require psychometric equivalence across languages
- Pharma sponsor mindset: risk management + documentation
- COA translators need methodology + conceptual equivalence + documentation + clinical terminology + confidentiality
- Scouting specifically for COA: ISPOR, ATA Medical Division, IMIA, linguistic validation LSP alumni, conferences, referrals

---

## 9. Part VII — The Cethos operational systems

A working tour of the Supabase database tables you'll use daily. This is hands-on familiarity, not theory.

### 9.1 The `vendors` table

The canonical linguist record. 1,468 rows. Key columns:

- `id` — UUID, primary key
- `full_name`, `email`, `phone` — identity and contact
- `country`, `city`, `timezone` — location
- `native_languages` (jsonb), `vendor_type` — currently mostly null, needs populating
- `specializations` (jsonb), `certifications` (jsonb) — currently mostly null, needs populating
- `years_experience`, `rating`, `total_projects` — performance indicators
- `status` (active, etc.), `xtrf_vendor_id` (legacy reference)
- `invitation_sent_at`, `invitation_accepted_at` — onboarding state (mostly null currently)
- `notes` — internal notes
- `created_at`, `updated_at`

**What you'll do with it during the sprint:** Identify the COA pool subset; populate missing data for that subset; ensure each has the supporting records (language pairs, evidence, NDA, performance history).

### 9.2 The `vendor_language_pairs` table

Maps vendors to language pairs. 5,188 rows. Key columns:

- `vendor_id` — FK to vendors
- `source_language`, `target_language` — currently text codes (EN, FR-CA, PT-BR), not FK to `languages` table — this is the impedance mismatch we discussed
- Other metadata about the pair

### 9.3 The `cvp_applications` table

The vetting pipeline intake. 107 rows. Key columns:

- `id` — primary key
- `applicant_name`, `email`, `phone`, `country` — identity
- `role_type` — translator, interpreter, transcriber, COG translator, etc.
- `education_level`, `years_experience`, `certifications` (jsonb)
- `services_offered`, `work_samples`
- AI prescreening fields: `prescreen_score`, `prescreen_result`, `prescreen_flags`
- `status` — application state in the pipeline
- `translator_id` — populated if graduated to `cvp_translators` (currently 1 row has this set)
- `can_reapply_after`, `do_not_contact` — for rejected applicants
- Created/updated timestamps

### 9.4 The `cvp_translators` table

Graduates from the CVP. 1 row currently. Key columns:

- `id` — primary key
- `application_id` — FK to `cvp_applications`
- `auth_user_id` — Supabase auth link (if onboarded with login)
- `approved_combinations` — jsonb of (language pair × domain) approvals
- `tier`, `default_rate`
- `is_active`
- Performance and metadata

### 9.5 The `cvp_translator_domains` table

Newer relational version of the per-translator domain approvals. 4 rows. Key columns:

- `translator_id` — FK to `cvp_translators`
- `language_pair_id` — references
- `domain_id` — subject matter domain
- `approval_state` — approved, pending, etc.

This is replacing the jsonb `approved_combinations` field; expect this to grow as CVP graduates increase.

### 9.6 The `cvp_test_library`, `cvp_test_combinations`, `cvp_test_submissions` tables

The testing infrastructure. 63 tests in the library, 730 test combinations assigned, a small number of submissions so far. You'll engage with these when reviewing AI assessment results and making qualification decisions.

### 9.7 The `cvp_application_decisions` table

Decision history per application. 3 rows currently. Each decision captures: decision outcome, decision rationale, AI-processed staff notes, outbound message body, decision date. This is critical evidence for an audit — every decision is documented.

### 9.8 The `cvp_inbound_emails` and `cvp_outbound_messages` tables

Full conversation threading with applicants. 48 inbound emails, 12 outbound messages. The communication audit trail.

### 9.9 The `cvp_application_references` and `cvp_application_reference_requests` tables

Formal reference checks. 1 of each currently. As volume grows, these become the structured evidence of reference checks per applicant.

### 9.10 The `cvp_trainings`, `cvp_training_lessons`, `cvp_training_assignments`, `cvp_training_lesson_progress` tables

Training infrastructure for onboarded linguists. 11 training lessons in the library currently. Tracks which linguists have completed which training and when.

### 9.11 The `languages` table

The canonical language reference. 141 rows. Key columns: `code` (lowercase ISO 639-1 with locale, e.g., `en`, `fr-CA`, `ar-EG`), `name`, `native_name`, `tier`, `is_active`. Used by FK from CVP tables.

### 9.12 Practical exercise — your Week 1 hands-on

By end of Week 1, you should be able to (with Amrita's help on the SQL where needed):

- List the 50 vendors most likely to be COA pool candidates based on country, language pairs, and prior project history
- For any specific vendor, retrieve their language pairs, current status, and recent notes
- For any CVP application, retrieve the prescreen result, test assignments, and decision history
- For any qualified translator (currently 1, will grow), retrieve their approved combinations and recent performance

If you can do these confidently, you're functional on the systems.

### 9.13 Quick-reference summary — Part VII

- `vendors` is the canonical linguist record; `cvp_*` is the vetting pipeline; `vendor_language_pairs` connects vendors to language work
- The vendors table has 1,468 rows with significant data gaps in qualification fields
- CVP has 107 applications and 1 graduate; throughput is currently low
- `languages` has 141 entries with FK relationships from CVP tables
- `vendor_language_pairs` uses text codes (not FK) — this is the known impedance mismatch

---

## 10. Part VIII — Professional bodies and certifications

Who's who in the translation industry world, and what their credentials mean.

### 10.1 General translation bodies

**ATA — American Translators Association** (atanet.org)
- Largest U.S. body; ~10,000 members
- ATA Certification: rigorous exam, language-pair-specific, well-recognized internationally
- Specialty divisions: Medical, Legal, Financial, Literary, Software, etc.
- For Cethos: ATA Certified translators are strong candidates; Medical Division members are prime COA candidates

**CTTIC — Canadian Translators, Terminologists and Interpreters Council** (cttic.org)
- Federal Canadian body; umbrella for provincial associations
- CTTIC Certification (Certified Translator / Certified Interpreter / Certified Terminologist): rigorous exam, recognized for federal work

**ATIA — Association of Translators and Interpreters of Alberta** (atia.ab.ca)
- Alberta provincial association under CTTIC
- Relevant for Calgary-based work; Cethos is Alberta-headquartered

**Provincial equivalents in other provinces** — OTTIAQ (Quebec), ATIO (Ontario), STIBC (BC), CTINB (NB), ATINS (NS), etc.

**ITI — Institute of Translation and Interpreting** (iti.org.uk)
- UK body
- ITI Membership / Qualified Member status

**FIT — International Federation of Translators** (fit-ift.org)
- Umbrella body globally; member associations include most national bodies

### 10.2 Interpreting bodies

**NAJIT — National Association of Judiciary Interpreters and Translators** (najit.org)
- U.S. body for legal/judiciary interpreting
- Raminder is attending the conference June 5-7 in Atlanta

**IMIA — International Medical Interpreters Association** (imiaweb.org)
- Global body for medical interpreting
- IMIA Certification track

**CCHI — Certification Commission for Healthcare Interpreters** (cchicertification.org)
- U.S. healthcare interpreting certification
- CHI (Certified Healthcare Interpreter) credential, language-specific

**NBCMI — National Board of Certification for Medical Interpreters** (certifiedmedicalinterpreters.org)
- U.S. healthcare interpreting certification (parallel/competing to CCHI)
- CMI (Certified Medical Interpreter) credential

**Critical Link / HIN — Healthcare Interpretation Network of Canada** (criticallinkcanada.com)
- Canadian community interpreting; maintains NSGCIS

### 10.3 Life sciences / COA bodies

**ISPOR — Professional Society for Health Economics and Outcomes Research** (ispor.org)
- The professional society for PRO and COA work
- ISPOR Translation and Cultural Adaptation Task Force — published Wild et al. 2005

**RSI / DIA — Drug Information Association** (diaglobal.org)
- Pharma industry body covering regulatory affairs broadly; translation is one topic among many

### 10.4 What certifications actually mean

When you see a certification on a CV, ask:

- **Issuing body** — is it a recognized body (ATA, CTTIC, ATIA, IMIA, CCHI, NBCMI) or something obscure?
- **Language pair** — is the certification for the specific pair claimed? ATA Certification is language-pair-specific
- **Year** — recent certifications are stronger than decades-old ones (though older ones still count, with continued professional development)
- **Specialty designation** — ATA Medical Translation Division membership is specifically relevant for medical work; ATA general certification is broader

Self-claimed certifications without verification ("ATA Certified" with no language pair specified, no year, no member ID) warrant verification.

### 10.5 Industry events worth knowing

**ATA Annual Conference** — typically October/November, U.S. cities. Largest English-language translation conference.

**Locworld** — localization industry conference, multiple per year globally.

**ISPOR Annual Meeting** — May; ISPOR Europe in November. Where COA work is discussed by sponsors and providers.

**NAJIT Annual Conference** — June (this year June 5-7 in Atlanta).

**Critical Link Conference** — community interpreting; held periodically.

Cethos doesn't need to attend everything. ISPOR and NAJIT are the highest-leverage events for the verticals Cethos focuses on.

### 10.6 Quick-reference summary — Part VIII

- General translation: ATA (U.S.), CTTIC + provincial (Canada), ITI (UK), FIT (global)
- Interpreting: NAJIT (legal U.S.), IMIA (medical global), CCHI + NBCMI (medical U.S.), Critical Link (Canadian community)
- Life sciences: ISPOR (the major body for COA/PRO work)
- Certifications: verify issuing body, language pair, year, specialty

---

## 11. Sequencing into your QA Manager training

How this prerequisite training overlaps with the QA Manager training in the 5-week sprint plan.

### Weeks 1-2 — Prerequisite priority

Concentrate on this document. Specifically:
- Week 1: Parts I-IV (industry foundations, roles, sourcing, evaluation)
- Week 2: Parts V-VII (relationship management, life sciences vertical, Cethos systems)

The QA Manager training in Week 1-2 focuses on ISO 17100 foundations and SOP authoring craft — those are complementary, not competing. You can read both in parallel.

### Weeks 3-4 — Transition to QA Manager focus

Prerequisite reference shifts from primary study to background reference. The QA Manager training intensifies — ISO 17100 §6 in depth, vendor qualification mastery, COA methodology depth, consultant coaching intensive. You're now actively authoring SOPs, building the COA pool dossier, demonstrating qualifications.

### Week 5 — Integration

By Week 5 your prerequisite knowledge has been operationalized into actual SOPs, actual vendor records, actual qualification decisions. The two trainings converge into a single working competence.

### After the audit — Continued growth

Vendor management is a deep field. Six months from now, areas worth continuing to develop:

- Rate negotiation across language pairs and specialties
- Linguist career-arc thinking (how does a junior translator become a senior reviser, and how does Cethos support that?)
- Cross-functional alignment with project management
- Industry trend tracking (MT post-editing market, eCOA growth, regulatory shifts)
- Conference participation and network building
- Capacity planning (matching qualified pool composition to expected project mix)

The audit-readiness sprint produces functional vendor management. Mastery takes longer. That's expected.

---

## 12. Self-assessment checkpoints

End of each week, score yourself honestly. Discuss with Raminder and the consultant if any score is below 6/10 (relaxed threshold given the compressed timeline).

| Week | Question | Target |
|---|---|---|
| 1 | Can I explain the translation industry structure in 5 minutes? | Yes |
| 1 | Can I name the linguist roles (translator, reviser, reviewer, proofreader, post-editor, interpreter) and what each does? | Yes |
| 1 | Can I describe the CVP pipeline from application to onboarding? | Yes |
| 1 | Can I read a translator CV and identify their qualifications, languages, specializations? | Yes |
| 2 | Can I describe the onboarding sequence for a new linguist? | Yes |
| 2 | Can I explain what makes life sciences / COA work different from generalist translation? | Yes |
| 2 | Can I navigate the Cethos vendors, CVP, and language tables with confidence? | Yes |
| 2 | Can I name the major professional bodies and what their certifications mean? | Yes |

---

## 13. Bridges to the rest of the training pack

Once you've worked through this prerequisite document, the rest of the training infrastructure connects:

**Next read:** Your QA Manager training plan. The vocabulary and operational reality from this document make ISO 17100 clauses make more sense; you'll read them as descriptions of work you now understand operationally rather than as abstract requirements.

**Reference daily:** The standards walkthrough pack — particularly ISO 17100 Part I and ISO 18841 Part IV. When you're authoring an SOP about vendor qualification, the standards pack tells you the clause-level requirements; this document tells you the operational reality those clauses describe.

**Reference for COA work:** The methodology pack — particularly Part I (linguistic validation methodology). The pharma sponsor's audit will probe COA methodology deeply; the methodology pack is your operational expertise reference.

**Reference for audit prep:** The methodology pack Part II (audit principles) and your QA Manager training plan §3 (Q&A bank).

The whole training infrastructure is designed so that no single document has to carry everything — each piece references the others. This prerequisite document is the foundation; everything else builds on it.

---

## 14. A closing note

The transition from marketing outreach to QA Manager via vendor management is a real one. Seven weeks is fast. The audit on June 29-30 is real. The team is small. The work is intense.

Three things will carry you through:

**Take the existing skills seriously.** Your outreach craft, your pipeline thinking, your communication discipline — these are legitimate professional skills that transfer directly. You're not starting from zero. You're rebuilding on a real foundation.

**Be honest about gaps.** When you don't know something, say so and find out. The audit doesn't require you to know everything; it requires you to be in command of the system you operate. Honest gaps with documented learning plans are defensible; pretended expertise that doesn't hold up under questioning is catastrophic.

**Ask for help.** Raminder, Amrita, the consultant — everyone in this sprint wants the audit to succeed. The cost of asking a question is low; the cost of guessing wrong is high. Don't silent-stall.

You've got this.
