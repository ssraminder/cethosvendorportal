# Cethos QMS — COA Methodology & QMS Practice Pack

**Document status:** v0.1 — companion to standards walkthrough pack and individual training plans
**Purpose:** Self-contained study reference for clinical outcome assessment (COA) / linguistic validation methodology, audit principles, CAPA methodology, document control practice, and risk management. Use alongside the standards walkthrough pack.

---

# Part I — COA / Linguistic Validation Methodology

This is the highest-stakes operational topic for the June audit. The pharma sponsor will probe COA methodology more deeply than any other area.

## 1. What linguistic validation actually is

A clinical outcome assessment (COA) — sometimes called a patient-reported outcome (PRO), clinician-reported outcome (ClinRO), observer-reported outcome (ObsRO), or performance outcome (PerfO) — is an instrument used in clinical trials to measure how a patient feels, functions, or survives. Examples: pain scales, quality-of-life questionnaires, symptom diaries, functional ability scales.

These instruments are originally developed and validated in one language (typically English). When a multi-country clinical trial recruits patients in other languages, the instrument must be translated. But a translation isn't enough — the translated instrument must be demonstrably equivalent to the original in what it measures, how patients understand it, and what answers it elicits.

**Linguistic validation is the methodology that produces this equivalence.** It's not "high-quality translation." It's a structured methodology — typically 8 to 12 distinct steps — that produces both the translated instrument *and* the documentary evidence that the translation is equivalent.

Regulators (FDA, EMA) require this evidence when COA data is used to support drug approval or labeling claims. Sponsors require it from their translation vendors. The auditor checking Cethos on June 29-30 will be evaluating whether Cethos has the methodology, the documentation, and the qualified people to deliver this work.

## 2. The methodology sources

Three documents define industry methodology for COA / PRO translation:

### 2.1 ISPOR Good Practice — Wild et al. (2005)

**Full citation:** Wild D, Grove A, Martin M, Eremenco S, McElroy S, Verjee-Lorenz A, Erikson P. Principles of Good Practice for the Translation and Cultural Adaptation Process for Patient-Reported Outcomes (PRO) Measures: Report of the ISPOR Task Force for Translation and Cultural Adaptation. *Value in Health* 8(2): 94-104 (2005).

**Issuer:** International Society for Pharmacoeconomics and Outcomes Research (ISPOR)
**Where to access:** ispor.org; published in *Value in Health* — accessible via ISPOR membership or one-off purchase ~CAD $30
**Why it matters:** This is the foundational methodology paper. Sponsors and regulators reference it as the de facto industry standard. Every linguistic validation procedure ultimately traces to this paper.

### 2.2 FDA PRO Guidance (2009)

**Full citation:** U.S. Department of Health and Human Services, Food and Drug Administration. *Guidance for Industry: Patient-Reported Outcome Measures: Use in Medical Product Development to Support Labeling Claims.* December 2009.

**Issuer:** FDA
**Where to access:** fda.gov, free PDF
**Why it matters:** This guidance defines what FDA expects to see when PRO data supports a labeling claim. While it's a U.S. document, the methodological expectations have become near-universal. Linguistic validation evidence is explicitly required when PRO instruments are translated for clinical trials.

### 2.3 EMA Reflection Paper on HRQoL Measures

**Full citation:** European Medicines Agency, Committee for Medicinal Products for Human Use. *Reflection paper on the regulatory guidance for the use of health-related quality of life (HRQoL) measures in the evaluation of medicinal products.* July 2005.

**Issuer:** EMA
**Where to access:** ema.europa.eu, free PDF
**Why it matters:** European regulatory framing of the same concepts. Important for any sponsor with EU regulatory submissions.

### 2.4 ISPOR follow-up reports (2018-2020)

ISPOR has published additional task force reports refining specific aspects of the methodology — pediatric instruments, cognitive debriefing, harmonization, eCOA (electronic clinical outcome assessment). Reference these when working on specific instrument types.

## 3. The 10-step methodology (canonical structure)

Different methodology sources use slightly different step counts (Wild et al. has 10; the FDA implicitly has 12; some sponsor protocols specify 7-step or 14-step variations). The canonical 10-step structure below is the most widely referenced.

### Step 1: Preparation

**Purpose:** Establish the methodology, team, and resources for the project.

**Activities:**
- Confirm scope with sponsor (instrument, languages, populations)
- Obtain instrument developer permissions (PRO instruments are typically copyrighted; permission to translate is required)
- Assemble project team: project manager, forward translators, back translator, methodology lead, target population for cognitive debriefing
- Confirm conceptual definitions for each item in the instrument with the developer (the most important upfront activity — what is each item actually trying to measure?)
- Confirm cultural adaptation expectations
- Document the methodology to be followed

**Records generated:** Project specification, scope confirmation, developer permission, conceptual definitions document.

**Cethos application:** Captured in SOP-PROD-001 Project Intake and Specification plus the Linguistic Validation Master Document.

### Step 2: Forward translation (typically two independent translators)

**Purpose:** Produce two independent forward translations from source language to target language.

**Activities:**
- Two qualified translators independently translate the source instrument into the target language
- Translators must be native speakers of the target language
- Translators should not consult each other or compare versions
- Translators record significant decisions, uncertainties, alternative options
- Translators have access to the conceptual definitions from Step 1

**Why two independent translations:** Different translators will make different choices on ambiguous source text. Comparing two versions surfaces those choices for deliberate resolution rather than accidental selection.

**Records generated:** Two forward translation files; translator notes from each; translator qualification records.

**Cethos application:** SOP-PROD-002 Forward Translation. Both forward translators must meet ISO 17100 §4.1.2 plus life sciences subject matter qualification.

### Step 3: Reconciliation

**Purpose:** Resolve differences between the two forward translations into a single reconciled version.

**Activities:**
- A methodology lead (typically a third linguist or experienced PM) reviews both forward translations side-by-side with the source
- For each segment, identifies differences and decides on the preferred rendering
- Resolves differences with conceptual definitions and instrument purpose in mind
- Documents reasoning for each significant decision
- Produces the reconciled forward translation

**Records generated:** Reconciliation table (source / FT1 / FT2 / reconciled / rationale); reconciled forward translation.

**Cethos application:** SOP-PROD-003 Reconciliation. The reconciliation step is the heart of methodology — it's where the systematic approach distinguishes from "have two translators check each other's work."

### Step 4: Back translation

**Purpose:** Translate the reconciled forward translation back into the source language, by a translator who has never seen the original source.

**Activities:**
- An independent back translator (native source language speaker, not exposed to original source) translates the reconciled forward translation back into the source language
- The back translator should not see the original instrument
- The back translator notes any ambiguities or difficulties

**Why blind back translation:** If the back translator has seen the original, they will subconsciously match it rather than producing an independent rendering. The independent back translation reveals where the forward translation may have lost or changed meaning.

**Records generated:** Back translation file; back translator notes; back translator qualification records.

**Cethos application:** SOP-PROD-004 Back Translation. Strict independence is enforced — back translator selection and assignment is a documented step.

### Step 5: Back translation review

**Purpose:** Compare back translation to original source; identify any conceptual mismatches.

**Activities:**
- Methodology lead compares back translation to original source segment-by-segment
- Identifies any places where back translation diverges meaningfully from original
- Each divergence is analyzed: is it because the forward translation lost or changed meaning? Or is it an acceptable surface difference that doesn't affect conceptual equivalence?
- Where forward translation requires revision, the changes are made and documented

**Records generated:** Back translation review table (source / back translation / divergence type / resolution); revised forward translation if applicable.

**Cethos application:** SOP-PROD-004 Back Translation includes review process.

### Step 6: Harmonization (multi-language projects only)

**Purpose:** When the same instrument is being translated into multiple languages, ensure conceptual consistency across all language versions.

**Activities:**
- A harmonization meeting (or asynchronous equivalent) brings together representatives from each language team plus methodology lead plus (often) instrument developer or sponsor representative
- Each language team presents their forward translation rationale
- Cross-language conceptual equivalence is evaluated
- Where languages have diverged on conceptually critical items, decisions are documented
- Harmonization adjustments are made to specific language versions if needed

**Records generated:** Harmonization meeting minutes documenting decisions per item per language; harmonization report.

**Cethos application:** SOP-PROD-005 Harmonization.

### Step 7: Cognitive debriefing

**Purpose:** Test the translated instrument with members of the target patient population to confirm comprehension, relevance, and equivalent measurement.

**Activities:**
- A small sample of target population members (typically 5-8 per language, per the relevant patient subgroup) is recruited
- A trained interviewer administers the translated instrument and conducts structured interviews probing:
  - Comprehension — do they understand each item the way it's intended?
  - Relevance — does the item apply to their experience?
  - Wording acceptability — is the language natural, non-offensive, appropriate?
  - Recall — can they answer based on the recall period?
- Each interview is recorded (audio or transcript)
- Patterns across interviews are analyzed

**Records generated:** Cognitive debriefing protocol; interview transcripts or summaries; cognitive debriefing report identifying issues and recommended changes.

**Cethos application:** SOP-PROD-006 Cognitive Debriefing. The interviewer must be qualified — typically a researcher or clinician with population access plus interview training.

### Step 8: Review of cognitive debriefing and finalization

**Purpose:** Incorporate cognitive debriefing findings into the translation; produce the finalized version.

**Activities:**
- Methodology lead reviews cognitive debriefing report
- Identifies items requiring change vs items that performed well
- Changes are made to the translation
- Changes are documented with rationale
- If changes are substantive, re-cognitive-debriefing may be required (small re-test)

**Records generated:** Finalization decisions document; finalized translation.

### Step 9: Proofreading

**Purpose:** Final correction pass on finalized translation before delivery.

**Activities:**
- Independent proofreader (different from translator, reviser, back translator) reviews finalized translation for typos, formatting, consistency, completeness
- Corrections applied

**Records generated:** Proofread finalized translation.

**Cethos application:** SOP-PROD-007 Final Quality Check.

### Step 10: Final report

**Purpose:** Document the complete methodology execution as the evidence package for the sponsor.

**Activities:**
- Compile project file: methodology applied, team qualifications, forward translation files, reconciliation table, back translation file, back translation review table, harmonization records (if applicable), cognitive debriefing report, finalization decisions, proofread output, key decisions throughout
- Produce final linguistic validation report summarizing the methodology and key findings

**Records generated:** Linguistic validation report; complete project file.

**Cethos application:** SOP-PROD-009 Project Closure and Records Retention. This report is what the sponsor incorporates into their regulatory submission.

## 4. Key methodology principles to internalize

**Independence at every step.** Forward translators don't compare with each other. Back translator doesn't see the original. Cognitive debriefing interviewer doesn't have a stake in the translation outcome. Independence is what makes the methodology produce valid evidence.

**Documentation as you go.** Every step generates records. The records are the audit trail and the regulatory evidence. "We followed the methodology" is not enough; the records prove it.

**Conceptual equivalence, not linguistic literalness.** The goal isn't word-for-word translation. The goal is that a patient in language X answering item Y is responding to the same underlying concept as a patient in the source language. Sometimes that requires cultural adaptation. Sometimes that requires substantial rewording. The methodology supports this because it tests measurement equivalence at the end.

**Cognitive debriefing is the empirical test.** Everything before cognitive debriefing is theoretical. Cognitive debriefing is where you test whether the theoretical equivalence translates to actual patient comprehension. A theoretically perfect translation that patients don't understand is a failed translation.

**Harmonization protects multi-language studies.** A clinical trial running in 30 countries needs every language version asking the same question. Harmonization is what prevents one language version drifting conceptually away from the others.

## 5. The auditor will probe — questions to expect

A pharma vendor QA auditor's probe sequence on COA methodology typically runs:

- "Walk me through your linguistic validation methodology."
- "How many forward translators do you use?"
- "What happens if the two forward translators agree on everything?" (Trick — even when they agree, the reconciliation step is documented; agreement is not the absence of methodology, it's evidence captured in the reconciliation table.)
- "How do you ensure your back translator is truly blind to the source?"
- "Show me a reconciliation table from a recent project."
- "Show me a cognitive debriefing report."
- "How many cognitive debriefing participants do you recruit?"
- "What's your harmonization process for multi-language studies?"
- "What happens if cognitive debriefing reveals significant issues?"
- "Who qualifies as a forward translator for this work?"
- "Show me the qualifications of the translator who did the most recent project."

Have specific examples ready. The auditor will ask for evidence.

## 6. Quick-reference summary

**The 10 steps in order:**
1. Preparation
2. Forward translation (two independent translators)
3. Reconciliation
4. Back translation (blind to original)
5. Back translation review
6. Harmonization (multi-language only)
7. Cognitive debriefing (5-8 patients per language)
8. Review of cognitive debriefing and finalization
9. Proofreading
10. Final report

**The four methodology principles:**
1. Independence at every step
2. Document as you go
3. Conceptual equivalence, not literalness
4. Cognitive debriefing is the empirical test

---

# Part II — Audit Principles

The general principles that govern how audits are conducted, why, and how to participate effectively. Drawn from ISO 19011 (Guidelines for auditing management systems) and industry practice.

## 1. The three types of audit

**First-party (internal) audit.** Cethos audits itself. Required by ISO 9001 §9.2 and ISO 17100. Used to identify nonconformities and improvement opportunities before external audits.

**Second-party audit.** Cethos is audited by a customer (or potential customer) — typically a sponsor evaluating a vendor. **The June 29-30 audit is a second-party audit.** Sponsor sets the scope and criteria; Cethos hosts; outcome typically affects the commercial relationship.

**Third-party audit.** Cethos is audited by an independent certification body (Orion) against a standard (ISO 17100, 9001, etc.). Outcome determines certification status. **The December 2026 or February 2027 audit is a third-party audit.**

The three types differ in stakes and tone but follow the same general process.

## 2. ISO 19011 audit principles

The six principles that govern audit conduct from the auditor's side. Knowing these helps you understand auditor behavior and respond appropriately.

**Integrity** — auditors act professionally, honestly, with sense of fair play. They follow the audit process. They don't conduct audits with personal agendas.

**Fair presentation** — audit findings, reports, and conclusions reflect truthfully what was observed. Auditors don't inflate findings; they don't minimize them either.

**Due professional care** — auditors apply diligence and judgment proportionate to the importance of the work and confidence placed in them.

**Confidentiality** — auditors protect information they obtain. They don't share Cethos's information with competitors or use it for personal gain.

**Independence** — auditors are independent of the activity being audited. They don't have conflicts of interest. (For second-party audits, the auditor may work for the sponsor — but is independent of the project teams using Cethos's services.)

**Evidence-based approach** — audit conclusions are based on evidence obtainable in a sample of available information. Auditors don't conclude based on what they assume or what one source claims; they verify.

**Risk-based approach** — auditors focus effort on areas of higher risk and importance. They don't spend equal time on every clause.

## 3. The audit process — five phases

### 3.1 Phase 1: Audit planning

The auditor determines audit scope, criteria, and objectives. Audit plan is shared in advance with Cethos. This is what arrived from the pharma sponsor — the schedule of June 29-30 and the scope statement.

### 3.2 Phase 2: Preparation

Both sides prepare. The auditor reviews any pre-submitted materials. Cethos prepares the audit dossier, briefs the team, conducts mock audits if applicable.

The auditor may request specific documents in advance. Provide them. The auditor uses pre-audit material to focus their probes during the audit itself.

### 3.3 Phase 3: Audit execution

Typically structured as:

- **Opening meeting** — introductions, scope confirmation, logistics, brief overview. Raminder runs the Cethos side. Approximately 30 minutes.
- **Document review** — auditor requests documents per their checklist; reviews them; takes notes. May span multiple sessions interleaved with interviews.
- **Interviews** — auditor interviews specific roles. Fayza for operational topics; Raminder for executive topics; Amrita demonstrates document retrieval; the consultant may be asked questions in an advisory role.
- **Site walkthrough or system demonstration** — for remote audits, demonstrate systems via screen share. Show the qms database queries; show the document register; show how a project flows through the system.
- **Closing meeting** — auditor presents preliminary findings. Cethos listens, asks clarifying questions, accepts response timeline. Approximately 60-90 minutes.

### 3.4 Phase 4: Reporting

The auditor writes a formal report (typically within 2-4 weeks of audit close). Findings are categorized:

- **Critical** — major nonconformity threatening the system's ability to operate within standard
- **Major** — nonconformity significantly affecting QMS effectiveness
- **Minor** — isolated nonconformity not significantly affecting QMS effectiveness
- **Observation** — not a nonconformity, but a noted point that could become one
- **Opportunity for improvement** — suggestion, no immediate action required

### 3.5 Phase 5: Follow-up

Cethos responds to each finding with a corrective action plan (CAP) within the agreed timeline (typically 30 days). The CAP includes: root cause, corrective action, target closure date, evidence to be provided. Cethos implements actions; submits evidence; auditor reviews closure.

## 4. Audit interview craft

Three principles for being interviewed effectively.

**Answer the question that was asked, not the question you wish was asked.** If the auditor asks "how do you qualify translators?" answer that. Don't pivot to "let me tell you about our complaint system." Auditors hear pivots as evasion.

**Reference the evidence.** Strong answer: "Our translator qualification process is defined in SOP-VND-001. The competence record for each translator is captured in our qualification database; I can show you a specific example." Weak answer: "We have a thorough qualification process and we're really careful about who we work with."

**Don't volunteer information.** Every additional fact opens a new line of inquiry. If the auditor's question is closed and your answer is complete, stop talking. Discipline.

Four phrases that work in any interview:

- **"Let me check that — give me 30 seconds."** When you can find the answer but need to look.
- **"I don't recall the specific detail; let me confirm and come back to you."** When you genuinely don't know.
- **"That's Fayza's area — Fayza, can you take this?"** When the question is outside your role.
- **"Would it be helpful to show you the actual record?"** When the auditor seems skeptical and you can prove it.

Four phrases that don't work:

- **"We always..."** or **"We never..."** — invites the auditor to find the exception
- **"That's not really documented but we do it."** — translates as: document control gap
- **"The previous Quality Manager used to handle that."** — translates as: knowledge walked out the door
- **"Our consultant handles that."** — translates as: we don't own this

## 5. Categorizing findings — Cethos's perspective

When the auditor announces a finding, your perspective on it determines your response strategy.

**Accept and own.** If the finding is genuinely a gap, accept it. Push back on categorization only if you have evidence the impact is lower than claimed. Don't argue substance.

**Clarify before disputing.** Sometimes the auditor has misunderstood. *"Can you help me understand what specifically you observed that led to this finding?"* — neutral, professional, opens space.

**Negotiate categorization where appropriate.** A finding the auditor calls Major may be Minor if you can demonstrate the impact is limited. Be specific: *"We see the finding. We agree on the underlying gap. We'd ask you to consider Minor rather than Major because [the records in question are non-customer-facing, the impact is internal only, there are compensating controls, etc.]."*

**Never argue in front of the team.** If you disagree with a finding, raise it through proper channels — at the closing meeting or in writing. Public arguments make the audit relationship adversarial.

## 6. Quick-reference summary

- Three types: first-party (internal), second-party (customer/sponsor — the June audit), third-party (certification — the December/February audit)
- Five phases: planning, preparation, execution, reporting, follow-up
- ISO 19011 principles: integrity, fair presentation, due professional care, confidentiality, independence, evidence-based, risk-based
- Interview craft: answer the question asked, reference evidence, don't volunteer
- Findings categories: critical / major / minor / observation / OFI

---

# Part III — CAPA Methodology

Corrective and Preventive Action is the system that responds to nonconformities, complaints, audit findings, and quality issues with documented root cause analysis and tracked actions. Required by ISO 9001 §10.2 and ISO 17100 §7.

## 1. Corrective vs preventive action — the distinction

**Corrective action** addresses a nonconformity that has occurred. The trigger is real: a complaint received, a defect found, an audit finding raised. Corrective action's job is to fix the immediate issue and prevent its recurrence.

**Preventive action** addresses a potential nonconformity before it occurs. The trigger is anticipation: a trend in metrics suggesting future trouble, an analysis of risks not yet realized. Preventive action's job is to prevent first occurrence.

ISO 9001:2015 deemphasized the distinction (the 2015 revision integrated preventive thinking throughout risk-based thinking) but the practical workflow remains.

## 2. CAPA triggers

Triggers that should generate a CAPA record:

- Customer complaint above severity threshold
- Internal audit finding
- External audit finding (second-party or third-party)
- Recurring quality issue identified in performance monitoring
- Significant nonconformity in a project
- Regulatory or contractual change requiring system adjustment
- Identified risk above acceptance threshold

Not every issue requires a formal CAPA. Minor isolated issues with no systemic implication are handled through standard correction without the full CAPA process. The threshold is documented in SOP-MGT-007 CAPA.

## 3. The CAPA workflow — eight steps

### Step 1: Identification and recording

A CAPA is opened in the CAPA register with: trigger source, brief description, opening date, initial assignee. Captured promptly when the trigger is recognized.

### Step 2: Immediate action (containment)

If the issue is ongoing, what stops the bleeding right now? A complaint about a delivered translation may trigger immediate communication with the customer, immediate hold on similar work in progress, immediate notification of relevant team members. Containment is not the corrective action; it's the containment.

### Step 3: Root cause analysis

The most important step. The goal is to identify the underlying cause, not just the symptom. Several techniques are used in industry:

**The 5 Whys.** Ask "why?" repeatedly, drilling from symptom to root cause. Usually five iterations is enough.

> Example. Complaint: customer reported translation errors in clinical document.
> Why? — The translator missed several terminology items.
> Why? — The terminology glossary for that project wasn't shared with the translator.
> Why? — The project manager wasn't aware a glossary existed.
> Why? — The glossary was created on a prior project but not stored in the project's reference materials folder.
> Why? — Our project closure SOP doesn't require migrating glossaries to a shared terminology repository.
> **Root cause:** SOP gap in project closure regarding terminology asset management.

**Ishikawa / Fishbone diagram.** Visual method that brainstorms potential causes across six categories: Materials, Methods, Machines, Measurements, Environment, People. Useful when the cause is genuinely multifactorial.

**Fault tree analysis.** Starts with the failure and works backward through logical OR/AND gates to potential underlying causes. More formal; used in higher-stakes situations.

**Pareto analysis.** When the issue is recurring, plot frequency by category to identify the vital few causes contributing to most occurrences.

The technique matters less than the discipline of asking *why* until you reach a systemic cause that, if addressed, would prevent recurrence. Stopping too early ("the translator made an error") leads to corrective actions that don't actually prevent recurrence.

### Step 4: Define corrective action

What action will be taken to prevent recurrence of this root cause? Must be:

- Specific (not "improve training" — but "add terminology asset migration to SOP-PROD-009 Project Closure")
- Owned (a named person responsible)
- Time-bound (a target completion date)
- Verifiable (you can confirm it was done)

### Step 5: Define preventive action (where applicable)

If the root cause analysis surfaces conditions that could cause similar issues elsewhere, define preventive action to address the broader risk.

> In the example: if SOP-PROD-009 has an asset migration gap, the same gap may exist in other SOPs. Preventive action: review related SOPs for asset management coverage.

### Step 6: Implement actions

Owner executes the agreed actions. Implementation evidence is captured (revised SOP, completed training records, etc.).

### Step 7: Verify effectiveness

After implementation, verify the action actually addressed the root cause. Methods:

- Did the SOP update happen? Evidence: SOP register shows new version.
- Did the trained people demonstrate the new behavior? Evidence: subsequent project records.
- Has the issue recurred? Evidence: complaint log, performance metrics.

Verification often happens 60-90 days after implementation to allow time for recurrence (or its absence) to be observed.

### Step 8: Close

Once verification confirms effectiveness, CAPA is closed in the register. Closure date, closure verification evidence, closure approval recorded.

## 4. CAPA quality — common failure modes

**Symptom-level CAPAs.** "Trained the translator on terminology" closes the immediate issue but doesn't address the SOP gap. Recurrence likely.

**Vague actions.** "Improve quality assurance" is not an action. "Add a verification step to SOP-PROD-001 §6.3 requiring PM confirmation of terminology asset availability before translator assignment" is an action.

**Untracked closure.** CAPA opened, action taken, but no closure verification documented. The auditor sees an open CAPA from 18 months ago and questions whether the system is functional.

**No effectiveness verification.** Action implemented but never tested. Auditor's question: "How do you know this corrective action was effective?"

## 5. The CAPA register — what it tracks

A single register (typically Google Sheets or QMS database table) with one row per CAPA. Columns:

| Column | Notes |
|---|---|
| CAPA ID | sequential identifier |
| Date opened | |
| Trigger source | complaint / audit / monitoring / other |
| Issue description | what triggered the CAPA |
| Severity | |
| Containment action | |
| Root cause | from RCA |
| Corrective action | |
| Preventive action | |
| Owner | |
| Target closure date | |
| Status | open / in progress / verifying / closed |
| Actual closure date | |
| Verification evidence | |
| Linked records | SOPs revised, training records, etc. |

This register is one of the first things an auditor will ask for. A healthy register shows: a manageable number of open CAPAs (not zero — zero is suspicious), reasonable closure timeframes, no items aged beyond target without explanation, evidence of root cause analysis depth.

## 6. Quick-reference summary

- Corrective = response to occurred issue; preventive = response to anticipated issue
- The 8-step workflow: identify → contain → root cause → corrective action → preventive action → implement → verify → close
- Root cause analysis techniques: 5 Whys (default), Ishikawa (multifactorial), fault tree (high-stakes), Pareto (recurring)
- Failure modes: symptom-level CAPAs, vague actions, untracked closure, no effectiveness verification
- The CAPA register is one of the first things an auditor asks for

---

# Part IV — Document Control Practice

The discipline of managing controlled documents — SOPs, policies, forms, registers — through their lifecycle. Required by ISO 9001 §7.5 and ISO 17100.

## 1. Documents vs records — the critical distinction

**Documents** tell people what to do. SOPs, policies, work instructions, forms (blank), templates.

**Records** are evidence that something was done. Completed forms, signed agreements, audit reports, training certificates, complaint logs.

The same physical thing can be a document when blank and a record when completed. A Training Completion Form (blank) is a document; once filled out and signed, it's a record.

Document control governs documents; records control (a related but distinct discipline, covered in §7.5.3 of ISO 9001 — "documented information of external origin" and retention) governs records.

## 2. The document lifecycle

Documents move through six states:

### 2.1 Draft

The document is being created or revised. Visible only to the author and reviewers. No operational authority.

### 2.2 In review

The author has submitted the draft for review. Reviewer is checking content, compliance, integration with related documents.

### 2.3 Approved

Reviewer and approver have signed off. Document is ready for publication.

### 2.4 Published / Effective

The document is in force. Available to people who need it. The single authoritative version.

### 2.5 Superseded

A newer version of the document has been published. The superseded version is retained for historical reference but is no longer authoritative. Clearly marked as superseded.

### 2.6 Withdrawn

The document is no longer in use and not replaced. May be due to scope change, regulatory change, or end of relevant activity. Retained per retention policy.

## 3. Version numbering

Industry standard:

- **0.x** — pre-publication drafts (0.1, 0.2, 0.3)
- **1.0** — first published version
- **1.x** — minor revisions (formatting, clarifications, non-substantive changes)
- **2.0+** — major revisions (substantive changes to procedure, requirements, or scope)

Every published version, major or minor, requires the full author/reviewer/approver workflow.

## 4. Change history

Every published document carries a change history table. Each row records:

| Version | Date | Author | Change summary | Reason |
|---|---|---|---|---|
| 1.0 | 2026-05-25 | Fayza | Initial publication | New SOP for COA methodology |
| 1.1 | 2026-06-10 | Fayza | Clarified reviser independence requirement in §6.4 | Internal review finding |

The change history is what the auditor uses to understand how a document evolved. Don't backfill — record changes as they happen.

## 5. The three-signature workflow

Every controlled document requires three signatures before publication:

**Author.** Confirms content is correct, complete, and accurate.

**Reviewer.** Independent of author. Checks the document against:
- Standards conformance (does it meet ISO 17100/9001/etc. requirements?)
- Integration with related SOPs (no contradictions, references correct)
- Operational reality (does it match how Cethos actually works?)
- Language quality (clear, unambiguous, uses correct ISO vocabulary)

**Approver.** The responsible authority. Typically:
- Quality Policy and Information Security Policy → Raminder (Head of Quality)
- Production and vendor SOPs → Fayza (Quality Manager)
- Management system SOPs → Fayza or Raminder depending on scope
- Forms and templates → Amrita (QMS Coordinator) under delegated authority

The signatures are recorded in the document's header signature block AND in the document register. Publication happens only after all three signatures are recorded.

## 6. The document register

A single Google Sheet (or QMS database table) maintained by the QMS Coordinator. One row per controlled document.

Required columns:

- Document code (e.g., SOP-PROD-001)
- Title
- Type (SOP / Policy / Form / Register / Work Instruction)
- Version
- Status (draft / in_review / approved / published / superseded / withdrawn)
- Owner (role title, not personal name)
- Author (personal name)
- Reviewer (personal name)
- Approver (personal name)
- Effective date
- Next review date (typically effective date + 12 months)
- Last reviewed
- Storage location (Drive path)
- Supersedes (previous version code if applicable)
- Notes

The register is the auditor's navigation tool. When they ask "what version of SOP-X is in force?" you check the register.

## 7. Naming and coding conventions

File naming: `[CODE]-[shortname]-v[version].ext`

Examples:
- `SOP-PROD-001-forward-translation-v1.0.pdf`
- `POL-IS-001-information-security-policy-v1.0.pdf`
- `REG-VND-001-vendor-qualification-register-v1.0.gsheet`

Document codes: `[TYPE]-[AREA]-[NUMBER]`

Type codes:
- SOP — Standard Operating Procedure
- POL — Policy
- REG — Register
- FRM — Form
- WI — Work Instruction
- TPL — Template

Area codes:
- QPL — Quality Policy
- PROD — Production
- VND — Vendor
- MGT — Management System
- IS — Information Security
- HR — Human Resources

Number: zero-padded three-digit sequential within type+area combination.

## 8. Distribution and access

Controlled documents are available to people who need them, in their current authoritative version, and *only* in their current authoritative version. Common failure modes:

**Multiple copies in different folders.** People work from outdated versions because they have a personal copy. Mitigated by: single source of truth (one Drive folder); explicit policy that personal copies are not controlled; communication on every publication.

**Email attachments persisting.** Someone emailed SOP-X v1.0 to a translator six months ago; v1.3 is now in force. Translator still has v1.0. Mitigated by: don't distribute via email attachment; link to controlled location.

**External access without version control.** Translators or external parties have access to documents but aren't notified of updates. Mitigated by: controlled access through a portal (not direct file access); publication notifications.

## 9. Records control distinction

Records have their own control discipline (governed by SOP-MGT-002 Records Retention):

- **Identification** — every record clearly identifies what it is
- **Retention period** — how long the record must be kept (varies by record type and regulatory requirements)
- **Storage** — where the record is held; protection against loss, damage, unauthorized change
- **Access** — who can view, edit, retrieve
- **Disposition** — what happens at end of retention

For Cethos's COA records, retention typically tracks GCP (Good Clinical Practice) requirements — 15 to 25 years depending on jurisdiction and trial type. Sponsor agreement specifies. The retention requirement is captured per project at intake.

## 10. Quick-reference summary

- Documents tell people what to do; records are evidence that things were done
- Six states: draft, in_review, approved, published, superseded, withdrawn
- Version: 0.x pre-pub, 1.0 first publication, 1.x minor, 2.0+ major
- Every document has a change history table — never backfill
- Three signatures: author + reviewer + approver
- Single source of truth: the document register
- Distribution failure modes: multiple copies, email attachments, external access without version control
- Records control is a related but distinct discipline with retention periods often 15-25 years for COA work

---

# Part V — Risk Management Basics

Risk-based thinking is woven through ISO 9001:2015 and required by every modern management system standard. Cethos needs a documented risk management approach for both quality risks and information security risks.

## 1. The risk concept

A **risk** is the effect of uncertainty on objectives. Risks can be negative (threats) or positive (opportunities), though most practical risk management focuses on threats.

For Cethos, risks live in several categories:

- **Quality risks** — risks to the quality of services delivered (translator unavailability, methodology error, late delivery)
- **Information security risks** — risks to confidentiality, integrity, availability of information (data breach, system failure, unauthorized access)
- **Compliance risks** — risks of failing to meet regulatory or contractual requirements
- **Operational risks** — risks to business continuity (key person dependency, supplier failure)
- **Strategic risks** — risks to business objectives (market shift, client concentration, capacity)

## 2. The risk management process — five stages

The widely-used framework from ISO 31000 (Risk management — Guidelines):

### Stage 1: Establish context

Define scope, objectives, and risk criteria. For a QMS risk register, the context is "risks to the QMS's ability to deliver conforming services and meet customer requirements." For an ISMS risk register, the context is "risks to the confidentiality, integrity, and availability of information Cethos handles."

### Stage 2: Risk identification

Brainstorm potential risks. Methods:
- Checklist approach (use industry-standard risk lists)
- Brainstorming sessions with cross-functional team
- Review of past incidents and complaints
- External scan (regulatory changes, industry events)
- "What if" analysis on key processes

Identification should capture the risk event (what could happen), the source (what could cause it), and the impact (what would result).

### Stage 3: Risk assessment

For each identified risk, assess likelihood and impact. A common simple scale:

**Likelihood** — Low (rare, unlikely in normal operation), Medium (could occur occasionally), High (likely to occur regularly without controls).

**Impact** — Low (minor inconvenience, internal only), Medium (significant impact on a project or customer), High (significant business impact, regulatory exposure, multiple customers).

Risk score = likelihood × impact, producing a 3×3 matrix:

| | Low Impact | Medium Impact | High Impact |
|---|---|---|---|
| **High Likelihood** | Medium risk | High risk | Critical risk |
| **Medium Likelihood** | Low risk | Medium risk | High risk |
| **Low Likelihood** | Low risk | Low risk | Medium risk |

More sophisticated assessments use 5-point scales or quantitative methods (FMEA — Failure Mode and Effects Analysis), but 3×3 is adequate for most Cethos risks.

### Stage 4: Risk treatment

Four treatment options for each risk:

- **Avoid** — change the activity to eliminate the risk (stop providing service to the high-risk segment)
- **Mitigate** — reduce likelihood or impact through controls
- **Transfer** — shift the risk to another party (insurance, contractual indemnification, subcontracting)
- **Accept** — acknowledge the risk and take no specific action

Most risks are mitigated. The choice of treatment depends on cost/benefit, residual risk after treatment, and risk appetite.

### Stage 5: Monitor and review

Risks change over time. New risks emerge; existing risks change in likelihood or impact. Treatment effectiveness varies. The risk register is reviewed regularly — typically at management review (annually) plus event-driven reviews after significant incidents.

## 3. The risk register — what it captures

One row per identified risk:

| Column | Notes |
|---|---|
| Risk ID | sequential |
| Description | what could happen |
| Source / cause | what could trigger it |
| Category | quality / information security / compliance / operational / strategic |
| Affected objective | what's at stake |
| Inherent likelihood | before existing controls |
| Inherent impact | before existing controls |
| Inherent score | |
| Existing controls | what's already in place |
| Residual likelihood | after existing controls |
| Residual impact | after existing controls |
| Residual score | |
| Treatment decision | avoid / mitigate / transfer / accept |
| Additional treatment actions | if mitigation, what specifically |
| Treatment owner | |
| Treatment target date | |
| Review date | |
| Status | open / in treatment / closed |

For Cethos's ISMS-lite, target 15-20 risks in the initial register. Coverage should include:

- Unauthorized access to clinical trial source material
- Loss or compromise of a linguist's device containing project data
- Translation memory or terminology asset compromise
- Subprocessor (linguist) breach of confidentiality
- Cloud storage provider outage or security incident
- Internal staff data handling error
- Phishing or social engineering of staff
- Backup failure during recovery scenario
- Source material transmission outside controlled channels
- Project closure data destruction failure

For quality risks, target 10-15 in the initial register. Coverage should include:

- Translator unavailability for in-flight project
- Reviser conflict of interest (same person as translator)
- Methodology error in COA project leading to non-conforming linguistic validation
- Missed terminology asset migration between projects
- Cognitive debriefing recruitment failure
- Sponsor specification change mid-project
- Customer complaint escalation
- Internal staff turnover affecting project continuity
- CAT tool data corruption or loss
- Late delivery on contractual deadline

## 4. Risk appetite

How much risk Cethos is willing to accept. Set at the top of the organization, applied throughout. Examples:

- **Information security**: Very low appetite for risks affecting clinical trial data confidentiality. Higher tolerance for risks affecting non-restricted data.
- **Quality**: Very low appetite for risks affecting linguistic validation methodology correctness. Higher tolerance for minor formatting or stylistic issues.
- **Operational**: Moderate tolerance for short-term capacity risks; very low tolerance for risks affecting customer contractual commitments.

Risk appetite informs treatment decisions. A risk above appetite must be mitigated below appetite; a risk below appetite may be accepted.

## 5. Common risk management failure modes

**Risk register that's never reviewed.** Created once, filed, forgotten. Auditor: "When was this last reviewed?" — silence.

**Treatment actions never implemented.** Risk identified, treatment defined, owner assigned, nothing happens. Auditor: "I see this risk has a treatment action targeted for closure six months ago — what's the status?"

**Inherent vs residual confusion.** Risk register shows the same likelihood/impact before and after controls — meaning either controls aren't doing anything, or the assessment isn't capturing reality.

**Risks without controls.** Identified risks with no listed existing controls suggests the team hasn't actually thought about what's already in place to manage the risk.

**Generic risks copied from a template.** Risks like "data breach" or "regulatory non-compliance" without specifics. Auditor sees these as not really applied to the organization.

## 6. Quick-reference summary

- Risk = effect of uncertainty on objectives
- Five-stage process: context → identification → assessment → treatment → monitor/review
- Treatment options: avoid / mitigate / transfer / accept
- 3×3 matrix (likelihood × impact) adequate for most Cethos risks
- ISMS-lite target: 15-20 information security risks; QMS target: 10-15 quality risks
- Risk register is reviewed at management review minimum; event-driven for significant incidents
- Failure modes: unreviewed register, unexecuted treatments, generic copied risks

---

# Part VI — Putting it all together

The five disciplines in this pack interlock. A quick map of how:

## Cycle 1: Daily operations

- **Production SOPs** define how translation work is done
- **Document control** ensures everyone uses the current versions
- **Records** are generated as work proceeds
- **Records retention** governs how long records are kept

## Cycle 2: Issue response

- A **customer complaint** comes in
- A **CAPA** is opened
- **Root cause analysis** identifies the underlying issue
- **Corrective action** is implemented (often involves SOP revision via document control)
- **Risk register** may be updated if the root cause reveals a new risk
- **Verification** confirms effectiveness
- **CAPA register** records closure

## Cycle 3: Continual improvement

- **Internal audit** examines QMS conformance
- **Audit findings** generate CAPAs
- **Risk reviews** identify new or changed risks
- **Management review** aggregates the picture: customer feedback, audit results, CAPA effectiveness, risk landscape
- **Decisions and actions** flow from management review back into the QMS

The auditor on June 29-30 will probe each of these cycles. Strong answers don't just describe the cycle — they reference the specific SOP, the specific register, the specific recent example.

---

# Appendix A — Free downloads for Week 1

Three documents to download and read in Week 1. All free.

**FDA PRO Guidance (2009)**
- URL: fda.gov/regulatory-information/search-fda-guidance-documents/patient-reported-outcome-measures-use-medical-product-development-support-labeling-claims
- ~30 pages
- Time: 60-90 min

**EMA Reflection paper on HRQoL measures**
- URL: ema.europa.eu — search "Reflection paper HRQoL"
- ~10 pages
- Time: 30-45 min

**ISPOR Task Force resources page**
- URL: ispor.org — search "Translation and Cultural Adaptation"
- Several free task force reports referenced from the page
- Time: as needed

Wild et al. (2005) itself requires ISPOR membership or one-off purchase at ~CAD $30 — well worth it. The 11-page paper is the foundational methodology document; everyone on the team should read it once.

# Appendix B — Recommended reading beyond the standards

- Mossop, Brian. *Revising and Editing for Translators.* Routledge. Excellent practical guide on revision work.
- Drugan, Joanna. *Quality in Professional Translation.* Bloomsbury. Industry perspective on quality systems.
- Acolad / TransPerfect / RWS public methodology white papers — many of the major LSP competitors publish methodology overviews that are useful comparative references (note: pharma sponsors will be familiar with these competitors, so understanding their public methodology framing helps anticipate audit comparisons)
- ISO 19011:2018 — Guidelines for auditing management systems. ~CAD $150 from ISO; useful for the internal audit program author.

# Appendix C — How to use this pack

**Raminder.** Read Part II (Audit Principles) carefully. Read Part I (COA Methodology) at concept level — you'll be asked policy-level COA questions, not operational ones. Skim Parts III-V; you need awareness of the disciplines without owning the operational detail.

**Fayza.** Read Part I (COA Methodology) in depth — this is the operational heart of the June audit. Read Part II (Audit Principles) carefully — you'll be the primary interviewee. Read Parts III-V (CAPA, Document Control, Risk) at working depth — you'll be answering operational questions across all of them.

**Amrita.** Read Part I (COA Methodology) once for concept awareness — you won't be the primary interviewee but you'll be retrieving COA project records. Read Part IV (Document Control) carefully — this is your home discipline. Read Parts II, III, V at orientation level. Note Part IV §3 (the document lifecycle), §6 (the document register), §7 (naming conventions) — those are your daily work.
