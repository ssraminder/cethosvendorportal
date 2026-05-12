# Cethos — Dual-Track Roadmap
## Audit-Readiness Sprint (June 29-30, 2026) + ISO 17100 Certification Path

**Document status:** v0.2 — supersedes prior ISO-only roadmap
**Prepared:** May 11, 2026
**Hard rule throughout:** The pharma sponsor is never named in this document, in any SOP, or in any external-facing material. Standard phrasing: *"a vendor qualification audit at the end of June,"* *"the pharma sponsor's audit,"* *"the auditor,"* *"the sponsor."*

---

## 1. Strategic context

A major pharma sponsor has scheduled a two-day remote vendor qualification audit for **June 29-30, 2026**. The audit covers translation services and linguistic validation of clinical outcome assessments (COA), conducted by an Enterprise Vendor QA Auditor 2. This is not a courtesy review. The auditor will examine ISO 17100 conformance, COA-specific linguistic validation methodology, vendor controls, data handling, confidentiality, and information security posture.

Two independent considerations point in the same direction:

**The June audit and the December Orion audit examine substantially the same evidence.** ISO 17100 conformance, vendor qualification, translator competence, project specification handling, revision controls, complaint handling, document control, training records, internal audit — all are in scope for both audits. The June sprint is not a detour; it is the front-loaded portion of the Orion build.

**The June audit will be harder than the December audit in the areas the sponsor cares most about.** Pharma vendor QA scrutinizes COA methodology, data handling for clinical trial documents, and subprocessor controls more aggressively than a general ISO 17100 auditor will. The COA-specific methodology depth and information security posture required for June exceed ISO 17100's baseline. If Cethos clears June 29-30, December is largely a structural review.

**The team change matters.** Maria Teressa and Luis Esguerra leaving in QA-adjacent roles, with Fayza now wearing both QA Manager and translator scouting / vendor relations hats, is a real audit risk. The on-paper structure (Raminder = Head of Quality, Fayza = QA Manager, external consultant = QA Advisor) is defensible if Fayza can speak fluently to the SOPs and is visibly in command of operational quality during the audit. Part of the consultant's value is bringing Fayza up to speed for the role and stress-testing her audit readiness.

## 2. Two parallel tracks

The work splits cleanly into two tracks running concurrently.

**Track A — Audit-readiness sprint.** Now through June 29-30, 2026. ~7 weeks. Goal: pass the late-June audit with no major findings and a clean enough impression to retain and expand the sponsor relationship. External QA consultant is the operational driver under Raminder's direction; Fayza is the internal owner; Track B work is paused or narrowed where it would compete.

**Track B — ISO 17100 certification path.** Resumes in earnest in July 2026 after the audit debrief. Goal: integrated ISO 9001 + 17100 + 18587 + 18841 + NSGCIS Stage 2 audit by Orion, target December 2026 (February 2027 fallback). Almost all Track A artifacts feed directly into Track B; the post-audit work is structural integration and expansion across the standards bundle, not building from scratch.

The original Phase 1 vendor qualification schema work — proposed for Claude Code — proceeds during Track A in narrowed scope. Build the schema and seed it for the **COA-relevant translator pool only** before June 29. Full migration of all 1,468 vendors moves to Track B after the audit.

---

## 3. Track A — Audit-readiness sprint (May 12 → June 30, 2026)

### 3.1 Scope of the sprint

Eight workstreams to deliver in seven weeks:

1. **External consultant engagement** — confirmed; scope defined below
2. **Gap analysis** — current state vs ISO 17100 + COA-specific methodology + information security baseline
3. **SOP package** — 15 existing SOPs reviewed, gaps closed, COA-specific SOPs added
4. **COA methodology documentation** — explicit linguistic validation methodology aligned to ISPOR good practices
5. **Vendor qualification dossier** — narrow pool of qualified COA translators with documented evidence
6. **Information security package** — ISMS-lite aligned to ISO 27001 principles, with COA-specific data handling
7. **Mock audit** — week of June 22-26 with the consultant playing auditor
8. **Audit logistics and presentation** — document index, role assignments, dry run

### 3.2 Consultant engagement scope

Engaging within the next 7-10 days is the highest-leverage action. CAD $7-15K budget, 40-60 hours over 6-8 weeks. Proposed scope (refine in the SOW):

- **Gap analysis** against ISO 17100 + COA audit checklist + ISO 27001 baseline (week 1-2)
- **SOP review and revision** of the 15 existing SOPs, with new SOPs drafted where critical gaps exist (weeks 2-5)
- **COA methodology documentation** — explicit forward translation / back translation / reconciliation / cognitive debriefing / harmonization procedure aligned to ISPOR (weeks 2-4)
- **Mock audit** the week of June 22-26 (week 6-7)
- **Audit standby** June 29-30, on call during sessions, real-time advisory between sessions
- **Information security light review** — at least a structured ISMS-lite framework, even if not full ISO 27001 alignment (weeks 3-5)
- **Fayza coaching for QA Manager role** — embedded throughout; she should be running the audit sessions, with the consultant in support, not the other way around

When evaluating consultant candidates, two qualifications matter more than the others: **direct experience with pharma vendor QA audits of translation suppliers**, and **familiarity with linguistic validation of COA / PRO instruments**. A consultant who only knows generic ISO 17100 will miss the specific COA methodology bars the auditor will measure against.

### 3.3 SOP package — critical inventory

The 15 existing SOPs should be inventoried first. The consultant will tell you which are usable as-is, which need revision, and which need to be added. Based on what a pharma vendor QA auditor will ask to see, the minimum complete set includes:

**Production SOPs (ISO 17100 + COA methodology)**
- Project Intake and Specification
- Forward Translation
- Reconciliation of Forward Translations
- Back Translation
- Back Translation Review and Cognitive Debriefing
- Harmonization Meeting (for multi-language COA projects)
- Final Quality Check / Proofreading
- Linguistic Validation Master Procedure (overarching COA methodology)
- Project Closure and Records Retention
- Machine Translation Post-Editing (if any COA work touches MT — typically prohibited for COA, document that explicitly)

**Vendor management SOPs (ISO 17100 §6.1 + ISO 9001 §8.4)**
- Translator Qualification and Vetting
- Reviser Qualification
- Interpreter Qualification (relevant if any audit-related interpreting)
- Vendor Onboarding (incl. NDA, training, system access)
- Vendor Performance Monitoring
- Vendor Re-qualification (annual cadence)
- Vendor Offboarding and Records Handling

**Management system SOPs (ISO 9001 + cross-cutting)**
- Document Control and Records Retention
- Internal Audit
- Management Review
- Corrective and Preventive Action (CAPA)
- Customer Complaint Handling
- Customer Satisfaction Monitoring
- Risk and Opportunity Management
- Training and Competence

**Information security SOPs (ISO 27001 alignment / sponsor expectation)**
- Information Security Policy (master document)
- Acceptable Use Policy (linguists and staff)
- Data Classification and Handling — with clinical trial data classified as restricted/confidential
- Access Control
- Subprocessor / Linguist Confidentiality and Data Handling
- Encryption and Secure Transmission
- Incident Response and Breach Notification
- Backup and Business Continuity
- Device Security (laptops, mobile, removable media)
- Data Retention and Secure Disposal

This is more than 15 SOPs. The realistic deliverable for late June is: every production and vendor management SOP audit-ready, the COA methodology master document audit-ready, and the information security package at "documented and defensible" level — full polish on infosec moves to Track B.

### 3.4 Vendor qualification dossier — narrowed scope

Building documented competence records for all 1,468 vendors in seven weeks is not realistic. The realistic and audit-defensible move is to define a **qualified COA pool** — a subset of perhaps 20-50 translators who routinely work on the sponsor's projects or comparable COA work — and complete the qualification dossier for that pool only.

For each translator in the qualified COA pool the dossier should include:

- Identity verification (passport / ID document where retained)
- Evidence of ISO 17100 §3.1.4 competence (degree certificate, professional experience records, references)
- Subject-matter qualification for life sciences / clinical trials with evidence
- Language pair qualification with proficiency evidence
- Signed current NDA / confidentiality agreement
- Documented training: COA methodology, data handling, confidentiality
- Performance history for the past 12-24 months
- Re-qualification date set for the next review

Translators outside the qualified COA pool are flagged as not eligible for COA-scoped projects. The auditor sees a deliberate, documented gating mechanism rather than a 1,468-row mystery list. This is the same architectural pattern as Track B's QMS schema; just scoped tighter.

**Claude Code Phase 1 work fits inside this.** The schema build is still the right structural move and gives the auditor a structured database to inspect rather than a spreadsheet. Narrow the in-session goal to: schema live, seeded, qualified COA pool fully loaded, auditor views functioning. Defer the language code normalization and the broader vendor base migration to Track B unless time permits.

### 3.5 Information security package — ISMS-lite

The auditor's focus on data handling for life sciences vendors signals an ISO 27001-aligned review even though Cethos is not certified to 27001. The deliverable for late June is a documented, defensible ISMS-lite — not a 27001 certification effort.

Minimum content:

- Information Security Policy signed by the Head of Quality
- Statement of Applicability covering the 27001 Annex A controls Cethos has implemented (even if informally)
- Data Classification scheme with clinical trial data clearly identified as the highest classification
- Risk register with at least the top 15-20 identified information security risks and treatment decisions
- Access control matrix (who has access to what systems and data classifications)
- Subprocessor inventory (linguists are subprocessors) with DPAs or equivalent contractual controls
- Documented encryption posture (data in transit and at rest, including CAT tool packages)
- Incident response procedure with notification timelines
- Backup and recovery plan with documented test record
- Device security policy for in-house staff and freelance linguists

Sponsor auditors in life sciences typically also probe **21 CFR Part 11 alignment** if any ePRO or electronic source data is in scope, and **GDPR** if any EU data subjects are involved in clinical trials. Both are worth a short documented position even if the answer is "we do not currently handle ePRO data directly" or "our linguistic validation work does not involve identifiable patient data."

### 3.6 Mock audit (week of June 22-26)

The consultant runs a full mock audit in the format the sponsor will use: opening meeting, document review session, interview sessions with each role (Head of Quality, QA Manager, production team representative, vendor management representative), site walkthrough by video, closing meeting with preliminary findings.

Output: a list of weaknesses Cethos has one week to remediate. This is the highest-value single deliverable in the consultant scope and the moment the team's audit-readiness becomes real rather than theoretical.

### 3.7 Audit logistics and presentation

The week of June 22-26 should also produce:

- **Audit dossier index** — a single document presented to the auditor at the opening meeting listing every SOP, record, register, and artifact, with locations and version numbers. The auditor uses this to drive document requests.
- **Role assignments** for each audit session — who speaks to what topic, with backups
- **Document presentation protocol** — how records are pulled, how RLS is demonstrated for the qualification database, how evidence files are surfaced
- **Pre-audit dry run** of the qualification database with the auditor-style queries actually executed in front of internal staff to confirm they return clean results
- **Marketing scrub** — the cethos.com homepage "ISO 17100 and ISO 9001 compliant processes" claim must be removed before the audit; auditors review marketing materials and false compliance claims are a fast path to a major finding regardless of how good the SOPs are. NAP inconsistencies across BBB / LinkedIn / GBP listings should be aligned to a single canonical address and phone before the audit if possible

### 3.8 Sprint timeline

| Week | Dates | Focus |
|---|---|---|
| 1 | May 12-16 | Consultant SOW signed and engaged; SOP inventory; gap analysis kickoff; homepage ISO claim removed |
| 2 | May 18-22 | Gap analysis complete; SOP revision plan finalized; COA methodology drafting begins; Claude Code Phase 1 schema migration applied (narrowed scope) |
| 3 | May 25-29 | SOP revision in flight; ISMS-lite drafting begins; vendor qualification dossier for COA pool begins |
| 4 | June 1-5 | SOP package substantially complete; ISMS-lite draft complete; qualified COA pool dossier ~50% complete. Raminder at NAJIT June 5-7; coverage planning |
| 5 | June 8-12 | All SOPs finalized; ISMS-lite finalized; qualified COA pool dossier complete; database loaded; audit dossier index drafted |
| 6 | June 15-19 | Internal review pass; Fayza coaching intensive; pre-mock-audit polish |
| 7 | June 22-26 | Mock audit (with consultant); remediation; final dry run; audit-day materials packed |
| Audit | June 29-30 | Audit with consultant on standby |

### 3.9 What Track A produces

By end of June 30, 2026, Cethos has:

- A complete and audit-ready SOP package covering production, vendor management, management system, and information security
- An explicit, documented COA linguistic validation methodology
- A vendor qualification database loaded with the qualified COA pool, with verifiable evidence and auditor-facing queries
- A documented ISMS-lite covering classification, risk, access, subprocessors, encryption, incident response, backup
- A trained QA Manager (Fayza) and Head of Quality (Raminder) ready to speak to every artifact
- A consultant on standby during the audit itself
- A clean exit from June with at most minor findings, and an actionable list of improvements to fold into Track B

---

## 4. Track B — ISO 17100 certification path (July 2026 → audit)

The original ISO certification roadmap stays largely intact but tightens because so much of the foundational work is done by June 30.

### 4.1 Re-baseline (July 7-18, 2026)

- Debrief on June 29-30 audit findings and bake corrective actions into Track B planning
- Re-baseline the Orion roadmap against what exists post-audit vs what remains
- Decide whether Orion Stage 2 stays at December 2026 or shifts to February 2027 (see Decision 1 below)

### 4.2 QMS expansion (July - September 2026)

- Extend the vendor qualification schema from the qualified COA pool to the broader vendor base (the full 1,468)
- Apply the language code normalization deferred from Track A
- Complete the bridge between `cvp_translators` and `vendors`
- Extend SOPs from the audit-ready set to the full integrated standards bundle:
  - ISO 18587 post-editing of MT — specific PEMT competence and workflow SOPs
  - ISO 18841 interpreting general requirements — interpreter qualification, working conditions, mode-specific SOPs
  - NSGCIS community interpreting — cultural competence, ethics, healthcare/legal/social service domain training
- Build the integrated clause-mapping matrix proving one document set covers all five standards

### 4.3 Internal audit and management review (October-November 2026)

- Internal audit cycle covering all clauses across all five standards
- Management review with documented inputs, outputs, decisions
- CAPA log populated from internal audit findings
- All evidence captured in the QMS database, not in Word docs

### 4.4 Orion Stage 1 and Stage 2

- Stage 1 readiness review (early November if December audit; mid-December if February audit)
- Stage 1 audit (document review, gap identification)
- Stage 2 audit (full certification audit) — December 2026 or February 2027

---

## 5. Information security — sequencing recommendation

The pharma sponsor's interest in data handling for life sciences vendors makes ISO 27001 alignment a real, not theoretical, requirement on the Track A timeline. The recommendation is **structured ISMS-lite for Track A, expanded post-audit, certification deferred to a future phase if ever pursued.**

Three sequencing tiers:

**Tier 1 — Track A baseline (mandatory).** The ISMS-lite described in §3.5. Sufficient to clear the late-June audit if executed well. Approximate effort: 30-40% of the consultant scope.

**Tier 2 — Track B expansion (recommended).** September-November 2026, alongside QMS expansion. Bring the ISMS-lite to full ISO 27001 alignment — every Annex A control formally assessed, Statement of Applicability complete, internal audit performed against 27001, management review including infosec. Not certified to 27001 but structurally ready if certification is later pursued. This is also defensive against future sponsor audits that may probe deeper.

**Tier 3 — Full ISO 27001 certification (optional, post-December).** A separate certification engagement, typically 6-9 months, ~CAD $25-50K depending on certification body. Worth considering in 2027 if the pharma client relationship grows or if other sponsors require it, but not a Track B necessity.

**21 CFR Part 11 and GDPR.** Both are likely to come up tangentially during the June audit. Track A deliverable: a short documented position statement on each — explaining what Cethos does and does not handle, and the controls in place where relevant. Track B expansion: full assessment if any business is in scope.

---

## 6. Decisions needed in the next 7-10 days

Six decisions that gate the sprint:

**Decision 1 — Orion Stage 2 timing.** Stay at December 2026 or pre-emptively slide to February 2027? Track A pressure plus Track B compression argues for the slide. February gives the team a full month of recovery after the June audit before Track B intensifies, and avoids running internal audit / management review through the November holiday distractions. Recommended: **slide to February 2027.**

**Decision 2 — Consultant scope expansion.** The proposed scope is closer to 60 hours than 40 if it covers the SOP revision plus COA methodology plus ISMS-lite plus mock audit plus standby plus Fayza coaching. CAD $15K is plausible only with a consultant willing to take a project-based fee at the lower end of the rate scale. Recommended: **budget the higher end (~$15-18K), confirm scope explicitly includes operational embedded support during the sprint and not just advisory.**

**Decision 3 — Consultant candidate qualifications.** Two non-negotiable requirements when shortlisting: direct pharma vendor QA audit experience for translation suppliers, and COA / linguistic validation methodology familiarity. A generalist ISO 17100 consultant will miss the specific bars the late-June auditor measures against. Recommended: **screen on these two before everything else.**

**Decision 4 — Claude Code Phase 1 scope inside Track A.** Build the qualification schema and load the qualified COA pool only; defer language code normalization and the full vendor base migration to Track B. The schema gives the auditor structured queryable evidence; full-base migration is not needed for the late-June audit. Recommended: **narrowed scope confirmed for Track A.**

**Decision 5 — Information security tier.** Tier 1 ISMS-lite is mandatory; Tier 2 expansion in Track B is recommended; Tier 3 full ISO 27001 certification is optional. Recommended: **Tier 1 in Track A, Tier 2 confirmed for Track B, Tier 3 deferred pending business case.**

**Decision 6 — Marketing scrub timing.** The cethos.com homepage "ISO 17100 and ISO 9001 compliant processes" claim must come off before June 29 regardless. NAP cleanup across BBB / LinkedIn / GBP listings should ideally precede the audit too. Both are out of consultant scope and need internal owners assigned. Recommended: **Raminder owns the homepage edit by May 16; NAP cleanup by June 19.**

---

## 7. What does not change

A few things stay exactly as previously planned:

- The certificate scope statement submitted to Orion is authoritative and stays unchanged
- ISO 9001 §8.3 (Design and Development) remains the sole exclusion
- The five-standard integrated audit (ISO 9001 + 17100 + 18587 + 18841 + NSGCIS) remains the Orion scope
- The CVP pipeline remains the path for new translator qualification going forward
- XTRF retirement continues; nothing in Track A or Track B reverses or pauses that

## 8. Risk register additions

Three risks new to the project as of this update:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Insufficient consultant lead time — engagement signed too late to land Week 1-2 gap analysis on schedule | Medium | High | Engage within 7-10 days; if no qualified candidate found by May 22, escalate scope flexibility and consider two consultants in parallel |
| QA Manager continuity — Fayza unable to fully cover both QA Manager and vendor scouting under audit pressure | Medium | High | Consultant operates as embedded operational QA support during sprint; reassess Fayza's split after audit; consider QA Manager hire in Q3 2026 |
| Vendor qualification dossier incomplete for COA pool by June 29 due to evidence gaps (vendors unreachable, credentials not retrievable) | Medium | Medium | Start the dossier work in Week 2, not Week 4; identify the COA pool early; have a documented backup position: "qualified per CVP graduation + project history + reference check" with documented compensating controls for any specific evidence gaps |

## 9. Next actions this week (May 12-16)

1. Consultant outreach — shortlist 3 candidates against the two non-negotiable qualifications, RFP out by May 14, contract signed by May 19
2. SOP inventory pulled together internally — Fayza identifies the 15 existing SOPs, current version, last review date, owner
3. Homepage marketing claim removed — Raminder owns
4. Claude Code Phase 1 session scheduled, with the narrowed Track A scope reflected in the briefing
5. Communicate the sprint shape to Fayza so she knows what's coming and can plan her own time accordingly

---

**End of v0.2 roadmap.** Updates trigger v0.3.
