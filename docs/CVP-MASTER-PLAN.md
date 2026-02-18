# CETHOS Vendor Portal (CVP) — Master Plan

**Document:** `CVP-MASTER-PLAN.md`
**Version:** 1.0
**Date:** February 18, 2026
**Status:** APPROVED FOR IMPLEMENTATION
**Author:** Planning session with Raminder

---

## CRITICAL INSTRUCTION FOR CLAUDE CODE

> **Every time you work on this project, you MUST:**
> 1. Read this document (`CVP-MASTER-PLAN.md`) in full before writing any code
> 2. Read `CVP-DATABASE-SCHEMA.md` before touching any database-related code
> 3. Update the relevant section of this document after completing any task
> 4. Never assume — if something is unclear, refer back to this document first

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [URLs & Infrastructure](#3-urls--infrastructure)
4. [Repository Structure](#4-repository-structure)
5. [Phase 1 — Recruitment Portal](#5-phase-1--recruitment-portal)
6. [Application Form](#6-application-form)
7. [Translator Recruitment Pipeline](#7-translator-recruitment-pipeline)
8. [Cognitive Debriefing Pipeline](#8-cognitive-debriefing-pipeline)
9. [Rate Negotiation System](#9-rate-negotiation-system)
10. [Profile Health Check System](#10-profile-health-check-system)
11. [Admin Panel — Recruitment Module](#11-admin-panel--recruitment-module)
12. [Edge Functions](#12-edge-functions)
13. [Email Templates](#13-email-templates)
14. [Performance Scoring](#14-performance-scoring)
15. [Phase 2 — Vendor Working Portal](#15-phase-2--vendor-working-portal)
16. [Implementation Phases](#16-implementation-phases)
17. [Design Decisions Log](#17-design-decisions-log)
18. [Progress Tracker](#18-progress-tracker)

---

## 1. Project Overview

The CETHOS Vendor Portal (CVP) is an independent system for managing freelance translator recruitment, onboarding, job assignment, and payments. It is built as a standalone application that integrates with the main CETHOS portal via a controlled Supabase edge function API layer.

**Phase 1 scope (this document):** Recruitment pipeline only — from public application through AI assessment, testing, negotiation, and vendor account creation.

**Phase 2 scope (future):** Vendor working portal — job board, job execution, earnings, messaging.

### What CVP Solves

Without CVP, CETHOS has no formal system for:
- Recruiting and vetting freelance translators
- Testing translation quality before onboarding
- Managing vendor rates and negotiations
- Tracking vendor performance over time
- Onboarding cognitive debriefing consultants

### Two Applicant Types

| Type | Pipeline | Test | Decision |
|---|---|---|---|
| Translator / Reviewer | AI pre-screen → test per language pair/domain → AI assessment → negotiation → approval | Yes — translation, translation+review, and/or LQA review | AI auto-approve ≥80, staff review 65–79, auto-reject <65 |
| Cognitive Debriefing Consultant | AI credential screen → staff review | No test — CV and credential review only | Staff always decides |

---

## 2. System Architecture

```
join.cethos.com                    vendor.cethos.com (Phase 2)
(Recruitment Portal)               (Vendor Working Portal)
React + Vite / Claude Code         React + Vite / Claude Code
         |                                    |
         ↓                                    ↓
CVP Edge Functions (new)          CVP Edge Functions (new)
cvp-submit-application            cvp-get-job-board
cvp-prescreen-application         cvp-claim-job
cvp-send-tests                    cvp-submit-job
cvp-assess-test                   etc.
cvp-approve-application
         |                                    |
         └──────────────┬─────────────────────┘
                        ↓
             Supabase (shared project)
             lmzoyezvsjgsxveoakdr
             
             CVP tables: cvp_ prefix
             Shared tables: languages, staff_users (no prefix)
             File storage: quote-files bucket, vendor/ subfolder
```

### API Boundary Rule

**CVP apps NEVER directly query these CETHOS core tables:**
- `quotes`, `orders`, `customers`
- `ai_analysis_results`, `hitl_reviews`
- `quote_files`, `quote_pages`
- Any other non-CVP table

All cross-system data access goes through dedicated edge functions only. This makes future decoupling to a separate Supabase project a matter of changing connection strings, not rewriting code.

---

## 3. URLs & Infrastructure

| Resource | URL | Notes |
|---|---|---|
| Recruitment portal | `join.cethos.com` | New Netlify project |
| Vendor working portal | `vendor.cethos.com` | New Netlify project (Phase 2) |
| Admin recruitment module | `portal.cethos.com/admin/recruitment` | Added to existing CETHOS admin |
| Application form | `join.cethos.com/apply` | Public, no login |
| Test submission | `join.cethos.com/test/{token}` | Token-based, no login |
| Rate counter-offer | `join.cethos.com/negotiate/{token}` | Token-based, no login |
| Supabase project | `lmzoyezvsjgsxveoakdr` | Same as CETHOS portal |
| Repo | `cethos-vendor` | Claude Code, single repo for both portals |

### Netlify Configuration

Two separate Netlify sites from the same repo, using different base directories:
- `join.cethos.com` → builds from `/apps/recruitment`
- `vendor.cethos.com` → builds from `/apps/vendor` (Phase 2)

---

## 4. Repository Structure

```
cethos-vendor/
├── apps/
│   ├── recruitment/          ← join.cethos.com
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Apply.tsx           ← Application form
│   │   │   │   ├── TestSubmission.tsx  ← Test page /test/{token}
│   │   │   │   ├── Negotiate.tsx       ← Counter-offer page
│   │   │   │   └── Confirmation.tsx    ← Post-submit confirmation
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   │       └── supabase.ts
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── vendor/               ← vendor.cethos.com (Phase 2)
│       └── src/
│           └── (Phase 2)
│
├── supabase/
│   └── functions/
│       ├── cvp-submit-application/
│       ├── cvp-prescreen-application/
│       ├── cvp-send-tests/
│       ├── cvp-get-test/
│       ├── cvp-save-test-draft/
│       ├── cvp-submit-test/
│       ├── cvp-assess-test/
│       ├── cvp-send-negotiation/
│       ├── cvp-submit-counter/
│       ├── cvp-approve-application/
│       ├── cvp-reject-application/
│       ├── cvp-send-queued-rejections/  ← cron
│       ├── cvp-check-test-followups/    ← cron
│       └── cvp-check-vendor-profiles/  ← cron
│
├── docs/
│   ├── CVP-MASTER-PLAN.md       ← This file
│   ├── CVP-DATABASE-SCHEMA.md   ← Database reference
│   └── CVP-PROGRESS-LOG.md      ← Updated after each session
│
└── README.md
```

---

## 5. Phase 1 — Recruitment Portal

### Overview

`join.cethos.com` is a public-facing portal for two applicant types. Both types are accessed from a single URL with a role selector at the top of the form.

### Pages

| Route | Page | Auth |
|---|---|---|
| `/apply` | Application form (both role types) | Public |
| `/apply/confirmation` | Post-submission confirmation | Public |
| `/test/{token}` | Test submission page | Token only |
| `/negotiate/{token}` | Rate counter-offer page | Token only |

### Tech Stack

- React + Vite + TypeScript
- Tailwind CSS
- Supabase JS client (anon key — public operations only)
- React Hook Form + Zod for validation
- No authentication layer needed for Phase 1 (all public or token-based)

---

## 6. Application Form

**URL:** `join.cethos.com/apply`

### Role Selector

At the very top of the form — selecting a role dynamically shows/hides sections below:

```
I am applying as a:
● Translator / Reviewer
○ Cognitive Debriefing Consultant
```

Default: Translator / Reviewer

---

### 6A. Translator / Reviewer Form

#### Section 1 — Personal Information
| Field | Type | Required |
|---|---|---|
| Full name | Text | Yes |
| Email | Email | Yes |
| Phone | Tel | No |
| City | Text | No |
| Country | Select (countries) | Yes |
| LinkedIn URL | URL | No |

#### Section 2 — Professional Background
| Field | Type | Required |
|---|---|---|
| Years of experience | Select: <1, 1–3, 3–5, 5–10, 10+ | Yes |
| Education level | Select: Bachelor's, Master's, PhD, Diploma/Certificate, Other | Yes |
| Certifications | Multi-select with expiry date per cert | No |
| CAT tools | Multi-select | No |

**Certification options:**
- ATA (American Translators Association)
- CTTIC (Canadian Translators, Terminologists and Interpreters Council)
- ITI (Institute of Translation and Interpreting)
- CIOL (Chartered Institute of Linguists)
- ISO 17100 certified
- Other (free text)

**CAT tool options:** Trados, MemoQ, Wordfast, Phrase, Memsource, None, Other

#### Section 3 — Language Pairs & Domains

Dynamic, repeatable rows. Each row = one language pair + domain selection.

```
Language Pair 1
Source: [Spanish ▼]  →  Target: [English ▼]
Domains: ☑ Legal  ☑ Immigration  ☐ Medical
         ☐ Financial  ☐ Technical  ☐ General
                              [Remove row]

+ Add another language pair
```

**Domain options:** Legal, Medical, Immigration, Financial, Technical, General

Rules:
- Minimum 1 language pair required
- Source and target must be different languages
- At least 1 domain per pair required
- Each unique language pair + domain = one test combination

#### Section 4 — Services Offered

Multi-select — what they can do:
- Translation (source → target)
- Translation + Review (translate then self-review)
- LQA Review (reviewing someone else's translation using MQM Core)

#### Section 5 — Work Samples

- Upload 1–3 files (PDF, DOCX, max 10MB each) — optional
- Brief description field per file
- Note: "Samples improve your pre-screening score"

#### Section 6 — Rate Expectations

- Expected rate per page (CAD) — numeric, optional
- Display note: "This is used for initial matching and may be subject to discussion"

#### Section 7 — Additional Information

- Free text notes
- How did you hear about us? (LinkedIn, Google, Referral, Job board, Other)

#### Section 8 — Consent

- ☑ I agree to the Privacy Policy (required)
- ☑ I consent to receiving a translation test as part of this application (required)
- ☑ I understand the test is unpaid (required)

---

### 6B. Cognitive Debriefing Consultant Form

Shares Sections 1 and 8 with translator form. Unique sections:

#### Section 2 — Professional Background
| Field | Type | Required |
|---|---|---|
| Years of debriefing experience | Select: <1, 1–3, 3–5, 5–10, 10+ | Yes |
| Education level | Select | Yes |
| Degree field | Text (free entry) | Yes |
| Credentials / certifications | Free text | No |

#### Section 3 — Languages

- Native language (select from languages table)
- Additional fluent languages (multi-select) — not source/target, just languages they debrief in

#### Section 4 — Experience Profile
| Field | Type | Required |
|---|---|---|
| COA/PRO instrument types | Multi-select | Yes |
| Therapy areas | Multi-select | Yes |
| Pharma/CRO clients | Free text, marked confidential | No |
| Familiar with ISPOR guidelines | Yes / No / Partially | Yes |
| Familiar with FDA COA guidance | Yes / No / Partially | Yes |
| Prior debrief report writing | Yes / No | Yes |
| Sample debrief report | File upload (if Yes above) | Conditional |

**COA/PRO instrument types:** Patient-Reported Outcomes (PROs), Clinician-Reported Outcomes (ClinROs), Observer-Reported Outcomes (ObsROs), Interview guides, Surveys and questionnaires

**Therapy areas:** Oncology, Rheumatology, Neurology, Cardiology, Rare Disease, General, Other

#### Section 5 — Availability & Rate

- Availability: Full-time, Part-time, Project-based
- Expected day rate or per-project rate (CAD), optional

---

## 7. Translator Recruitment Pipeline

### Stage Flow

```
Form submitted
      ↓
[Stage 1] Record created → confirmation email sent
      ↓
[Stage 2] AI Pre-screen runs (background, instant)
      ↓
Score ≥ 70 ────────────→ [Stage 3] Tests assigned
Score 50–69 ──────────→ Staff review queue
Score < 50 ───────────→ Auto-reject queued (48hr interception)
      ↓
[Stage 3] Test assigned per language pair + domain combination
      ↓
[Stage 4] Test delivered → applicant submits via token page
      ↓
[Stage 5] AI test assessment runs (automatic)
      ↓
Score ≥ 80 ────────────→ Auto-approve that combination
Score 65–79 ──────────→ Staff review queue
Score < 65 ───────────→ Auto-reject that combination queued
      ↓
[Stage 6] Rate negotiation (if rate expectation gap exists)
      ↓
[Stage 7] Vendor account created on full approval
```

---

### Stage 2 — AI Pre-Screening

**Edge function:** `cvp-prescreen-application`
**Model:** Claude (claude-sonnet-4-6)
**Triggered:** Automatically after form submission

**Assessment criteria:**
- Language pair demand match (does CETHOS need this pair?)
- Certification quality (ATA/CTTIC = high weight)
- Experience level vs claimed domains — consistency check
- Work sample quality (if uploaded): fluency, accuracy, formatting, domain appropriateness
- Rate expectation vs CETHOS standard bands
- Red flags: inconsistencies, implausible claims, duplicate applications

**AI output structure:**
```json
{
  "overall_score": 74,
  "recommendation": "proceed",
  "demand_match": "high",
  "certification_quality": "high",
  "experience_consistency": "medium",
  "sample_quality": "not_provided",
  "rate_expectation_assessment": "above_band",
  "red_flags": [],
  "notes": "...",
  "suggested_test_difficulty": "intermediate",
  "suggested_test_types": ["translation", "lqa_review"]
}
```

**Routing thresholds:**

| Score | Action |
|---|---|
| ≥ 70 | Auto-advance to test assignment |
| 50–69 | Queue for staff review |
| < 50 | Queue auto-reject with 48hr staff interception window |

---

### Stage 3 — Test Assignment

**Edge function:** `cvp-send-tests`

For each `cvp_test_combinations` row linked to this application, the system:

1. Queries `cvp_test_library` filtered by: source_language_id, target_language_id, domain, service_type, difficulty (from AI suggestion)
2. Selects least recently used test if multiple available
3. If no test exists for a combination → flags to staff: "No test available for [pair + domain]. Create one or skip."
4. Creates `cvp_test_submissions` record with unique UUID token per combination
5. Sends batch test email with one section per test (Brevo Template V3)

**Test types by service offered:**

| Service | Test type |
|---|---|
| Translation only | Translation test |
| Translation + Review | Combined translation + self-review test |
| LQA Review | LQA review test (MQM Core) |
| Multiple services | Separate tests per type, batched in one email |

---

### Stage 4 — Test Submission Page

**URL:** `join.cethos.com/test/{token}`
**Auth:** Token validation only — no login

**Page behaviour:**
- Validate token on load — show error if expired or already submitted
- Display: instructions, source text/document, MQM error category guide (LQA tests only), upload field, notes field
- Auto-save draft every 60 seconds (calls `cvp-save-test-draft`)
- One submission per token — confirmation shown after submit
- Timer displayed showing time remaining (informational, not enforced)

**Token expiry:** 48 hours from creation

---

### Stage 4 — Follow-up Sequence

Cron job `cvp-check-test-followups` runs every hour.

| Timing | Template | Action |
|---|---|---|
| Day 1 | V3 | Test invitation sent |
| Day 2 (24hrs before expiry) | V4 | Reminder email |
| Day 3 (at expiry) | V5 | Token expired notification |
| Day 7 | V6 | Final chance — request new link |
| Day 10 | — | Status → `archived`, no email |

Each token has its own sequence tracked independently.

---

### Stage 5 — AI Test Assessment

**Edge function:** `cvp-assess-test`
**Triggered:** Automatically on test submission

#### For Translation Tests

Claude evaluates against:
- Reference translation in `cvp_test_library`
- Source document (completeness — no omissions, no additions)
- Domain-specific terminology expectations
- Canadian certified translation standards

**MQM Core dimensions scored:**

| Dimension | Weight |
|---|---|
| Accuracy | 35% |
| Fluency | 25% |
| Terminology | 20% |
| Formatting | 10% |
| Certification-readiness | 10% |

#### For LQA Review Tests

Claude evaluates:
- Whether errors were correctly identified
- MQM Core category assignment accuracy (Accuracy, Fluency, Terminology, Style, Locale Conventions, Design, Non-translation)
- Comment quality — actionable, professional, specific
- Severity ratings — Minor / Major / Critical applied correctly
- Whether reviewer missed critical errors

**AI output structure:**
```json
{
  "test_type": "translation",
  "language_pair": "ES→EN",
  "domain": "legal",
  "overall_score": 81,
  "pass": true,
  "dimension_scores": {
    "accuracy": 85,
    "fluency": 78,
    "terminology": 82,
    "formatting": 90,
    "certification_readiness": 75
  },
  "errors": [
    {
      "category": "terminology",
      "severity": "minor",
      "location": "Paragraph 2, sentence 3",
      "note": "Used 'marital status' where 'civil status' is standard in Canadian legal context"
    }
  ],
  "strengths": ["Accurate dates and numbers", "Clean formatting", "No omissions"],
  "feedback_draft": "Your translation demonstrated strong overall accuracy...",
  "suggested_tier": "standard",
  "confidence": "high"
}
```

**Routing thresholds:**

| Score | Action |
|---|---|
| ≥ 80 | Auto-approve this pair/domain combination |
| 65–79 | Staff review queue with AI notes + side-by-side |
| < 65 | Auto-reject queued — AI drafts rejection email |

**Key rule:** Approval is per combination. An applicant approved for ES→EN Legal can begin working that combination while ES→EN Medical is still pending. Vendor account is created when at least one combination is approved.

---

### Stage 7 — Account Creation

**Edge function:** `cvp-approve-application`

On approval of at least one combination:
1. Check if `cvp_translators` record already exists for this email (re-approval of additional combinations)
2. If new: create `cvp_translators` record with approved combinations
3. Create Supabase Auth user (or link if already exists)
4. Send magic link invite to `vendor.cethos.com` (Phase 2)
5. Send welcome email (Brevo Template V11) with onboarding checklist
6. Set `cvp_applications.translator_id` FK

On rejection:
1. AI-drafted rejection email queued (status: `queued`)
2. `rejection_email_queued_at` timestamp set
3. Cron `cvp-send-queued-rejections` runs every hour — sends emails past 48hr window
4. Staff can view and edit draft in admin panel during 48hr window
5. `can_reapply_after` set to 6 months from today
6. Reapplication check on new submissions: query for same email with active cooldown

---

## 8. Cognitive Debriefing Pipeline

```
Form submitted
      ↓
Record created (role_type: cognitive_debriefing)
      ↓
AI credential screen (no test — CV review only)
      ↓
ALWAYS goes to staff review queue
      ↓
Staff: Approve / Reject / Waitlist / Request more info
      ↓
Account created (cvp_translators with role_type: cognitive_debriefing)
```

### AI Credential Screen

**Criteria and weights:**

| Criterion | Weight |
|---|---|
| COA/PRO instrument experience | 30% |
| ISPOR/FDA COA guideline familiarity | 20% |
| Interviewing/qualitative research skills | 20% |
| Native/near-native target language fluency | 20% |
| Prior debrief report writing experience | 10% |

AI flags each criterion as: strong match / partial match / weak match. Provides overall recommendation and any red flags. **All applications go to staff review regardless of AI score — AI is advisory only for this pipeline.**

### "Request More Information" Action

Staff can send an information request email (Brevo Template V17 — to be created). Applicant receives email with a form link to submit additional information. Application status set to `info_requested`.

---

## 9. Rate Negotiation System

### When Negotiation Triggers

Negotiation is triggered when an applicant is moving toward approval AND their stated rate expectation differs from CETHOS's standard rate for that tier.

### Translator Tiers

Tier is assigned by AI during pre-screening based on experience and certifications. Staff can override.

| Tier | Criteria | Negotiation band |
|---|---|---|
| Standard | <3 years experience, basic or no certs | ±10% of standard rate |
| Senior | 3–7 years, ATA/CTTIC or equivalent | ±20% of standard rate |
| Expert | 7+ years, multiple recognised certs, specialist domains | ±30% of standard rate |

### Negotiation Flow

```
Applicant's expected rate vs CETHOS standard rate
         ↓
Within band → AI auto-accepts, rate confirmed, no email needed
         ↓
Above band → AI sends negotiation offer email (Template V9)
"We'd like to offer $X/page for [pair/domain]. This reflects 
our standard rate for [tier] translators."
         ↓
Applicant visits join.cethos.com/negotiate/{token}
Submits ONE counter-offer (or accepts)
         ↓
Counter within band → AI auto-accepts → confirmation sent (V10)
Counter outside band → Flagged to staff for manual decision
No response in 48hrs → CETHOS rate stands, approval proceeds
         ↓
All negotiation history stored on application record
Agreed rate stored as default for that combination on profile
Rate is ONE-TIME for recruitment — does not update stored profile rate
(Project-level negotiation is Phase 2)
```

### Negotiation Data Stored

All negotiation events stored in `cvp_applications.negotiation_log` (jsonb array):
```json
[
  {"event": "offer_sent", "amount": 12.00, "timestamp": "..."},
  {"event": "counter_received", "amount": 16.00, "timestamp": "..."},
  {"event": "auto_accepted", "final_amount": 14.40, "timestamp": "..."}
]
```

---

## 10. Profile Health Check System

Weekly cron job `cvp-check-vendor-profiles` runs every Monday at 9am UTC.

For each active `cvp_translators` record, checks:

| Check | Threshold | Action | Email to vendor? |
|---|---|---|---|
| Payout details missing | `payout_details` is null | Email nudge + escalate at 14 days + staff alert at 30 days | Yes |
| Profile completeness | Score < 80% | Email nudge with specific missing items | Yes |
| Certification expiry | Within 60 days | Reminder email (V15) | Yes |
| Language pairs stale | Not reviewed in > 6 months | Email check-in (V16) with one-click confirm | Yes |
| Inactive 90+ days | No jobs in 90 days | Staff dashboard flag only | No |

All nudges suppressed for 30 days per topic (tracked in `cvp_profile_nudges`). `resolved_at` set automatically when item is completed.

### Profile Completeness Score

| Item | Points |
|---|---|
| Profile photo uploaded | 10 |
| Bio written | 10 |
| At least one approved combination | 20 |
| Certifications with expiry dates stored | 15 |
| CAT tools listed | 10 |
| Payout details complete | 20 |
| At least one work sample uploaded | 15 |
| **Total** | **100** |

Recalculated every time the translator updates their profile. Stored as `cvp_translators.profile_completeness`.

---

## 11. Admin Panel — Recruitment Module

Added to existing `portal.cethos.com/admin` navigation under a new "Vendors" section.

### `/admin/recruitment` — Application Queue

**Four tabs:**

| Tab | What it shows |
|---|---|
| Needs Attention | Pre-screen flagged, borderline scores (65–79), interceptable rejections (within 48hr window), outside-band counter-offers awaiting staff decision |
| In Progress | Applications currently in test or negotiation |
| Decided | Approved, rejected, waitlisted, archived |
| Waitlist | Grouped by language pair — bulk invite capability |

**Per-row columns:** Name, role type, language pairs, pre-screen score, AI recommendation, status, days since last activity, action buttons.

---

### `/admin/recruitment/:id` — Application Detail

**Left panel:**
- Applicant info (name, email, phone, country, LinkedIn)
- Education + certifications
- Work samples viewer (inline PDF/DOCX preview)
- Rate expectation
- AI-assigned tier (with override dropdown)
- Negotiation history

**Centre panel (changes by stage):**
- **Pre-screen:** AI score breakdown, red flags, routing decision, override button
- **Test stage:** Per-combination status cards with token expiry countdowns, "Send test now" button for missing tests
- **Assessment stage:** Side-by-side viewer — source text | applicant submission | reference translation. MQM error table for LQA tests. Score per dimension. AI strengths/errors.
- **Negotiation:** Rate offer → counter → response timeline

**Right panel:**
- Staff notes (editable, timestamped)
- Decision buttons: Approve / Reject / Waitlist / Request More Info
- Rejection email editor (shows when AI draft is queued — staff can edit before 48hr window closes)
- Tier override

---

### `/admin/recruitment/tests` — Test Library

Table: title, language pair, domain, service type, difficulty, times used, avg pass rate, active.

Actions per row: Edit, Preview (applicant view), Duplicate, Deactivate.

**Add/Edit test modal fields:**
- Title (internal)
- Source language, target language, domain, service type, difficulty
- Source text (rich text editor)
- Reference translation (rich text editor) — for translation tests
- LQA source translation (flawed translation) — for LQA tests
- LQA answer key (structured error list) — for LQA tests
- MQM dimensions enabled (checkboxes)
- AI assessment rubric (additional Claude instructions)
- Active toggle

---

### `/admin/vendors` — Active Vendor Roster

Table: name, role type, tier, approved combinations count, profile completeness %, last active, jobs completed (Phase 2), avg performance score, status, flags.

**Filters:** Role type, tier, language pair, domain, completeness <80%, pending nudges, inactive 90+ days.

**Per-row flags (icon indicators):**
- 🔴 Payout details missing
- 🟡 Profile below 80%
- 🟠 Certification expiring
- ⚪ Inactive 90 days (staff only)

---

### `/admin/vendors/:id` — Vendor Detail

Full profile view. Staff can:
- Edit tier
- Edit approved combinations (add, remove, modify rate)
- View all job history (Phase 2)
- View performance scores (Phase 2)
- View nudge history
- Manually trigger a nudge
- Deactivate / reactivate account
- View payout history (Phase 2)

---

## 12. Edge Functions

All functions prefixed `cvp-`. All deployed to the existing Supabase project.

| Function | Trigger | Purpose |
|---|---|---|
| `cvp-submit-application` | Form submit (public) | Validates input, creates `cvp_applications` + `cvp_test_combinations`, triggers pre-screen |
| `cvp-prescreen-application` | Auto post-submit | Calls Claude, stores result, routes application |
| `cvp-get-available-tests` | Internal | Finds best test per combination from library |
| `cvp-send-tests` | Auto or staff manual | Creates tokens, sends batch test email |
| `cvp-get-test` | Applicant visits link | Validates token, returns test content |
| `cvp-save-test-draft` | Auto every 60s | Saves draft without submitting |
| `cvp-submit-test` | Applicant submits | Stores file, triggers AI assessment |
| `cvp-assess-test` | Auto post-submission | Claude scores test, routes by score |
| `cvp-send-negotiation` | Auto when rate gap detected | Creates negotiate token, sends offer email |
| `cvp-submit-counter` | Applicant counter-offer | Stores counter, AI accepts or flags to staff |
| `cvp-approve-application` | Staff or auto (≥80) | Creates `cvp_translators` + Supabase Auth user |
| `cvp-reject-application` | Staff or auto (<65) | Queues AI-drafted rejection with 48hr window |
| `cvp-send-queued-rejections` | **Cron: every hour** | Sends rejections past their 48hr window |
| `cvp-check-test-followups` | **Cron: every hour** | Fires Day 2/3/7 reminder sequences |
| `cvp-check-vendor-profiles` | **Cron: every Monday 9am UTC** | Profile health checks, queues nudges |
| `cvp-send-profile-nudges` | **Cron: daily 8am UTC** | Sends queued nudge emails |

---

## 13. Email Templates

All templates created in Brevo. Prefixed V (Vendor) to distinguish from existing CETHOS templates.

| ID | Template Name | Recipient | Trigger |
|---|---|---|---|
| V1 | Application Received | Applicant | Form submitted |
| V2 | Pre-screen Passed — Test Coming | Applicant | Score ≥70, auto-advance |
| V3 | Test Invitation (batch) | Applicant | Tests assigned |
| V4 | Test Reminder — 24hrs | Applicant | Day 2 cron |
| V5 | Test Expired | Applicant | Day 3 cron |
| V6 | Final Chance — Day 7 | Applicant | Day 7 cron |
| V7 | Test Received — Under Assessment | Applicant | Test submitted |
| V8 | Application Under Manual Review | Applicant | Queued for staff (score 50–69) |
| V9 | Rate Negotiation Offer | Applicant | Rate gap detected |
| V10 | Rate Agreed | Applicant | Negotiation resolved |
| V11 | Application Approved — Welcome | Applicant | Approval confirmed |
| V12 | Application Rejected | Applicant | Post 48hr window (AI-drafted, staff-edited) |
| V13 | Waitlisted | Applicant | Waitlist action |
| V14 | Profile Nudge (personalised) | Translator | Weekly cron |
| V15 | Certification Expiry Reminder | Translator | 60 days before cert expiry |
| V16 | Language Pairs Check | Translator | 6 months since last review |
| V17 | Request More Information | Applicant | Staff action (cognitive debriefing) |

---

## 14. Performance Scoring

**Scope:** Phase 1 creates the `cvp_translators` record with initial tier. Performance scoring on live jobs is Phase 2. The schema is designed for it from day one.

### Post-Job Scoring (Phase 2 — documented here for schema planning)

AI generates a score per completed job using:

| Signal | Description |
|---|---|
| Instructions followed | AI reviews submitted file against job brief/instructions |
| On-time delivery | Binary — submitted before deadline? |
| Follow-up count | Messages sent by staff to chase or clarify |
| Revision count | Times work was sent back |
| File quality | Correct format, proper naming, no corruption |
| Work quality | AI reviews file against source, project brief, client style guide — no reference needed |

Staff also rates quality 1–5 manually. Final score = AI score + staff rating combined.

**Visibility:**
- Translator sees simplified score on their earnings page (Phase 2)
- Staff sees full breakdown in admin
- Low scores flag to staff dashboard — no email to translator

---

## 15. Phase 2 — Vendor Working Portal

**Out of scope for Phase 1. Documented here for planning purposes.**

### What Phase 2 Covers

- `vendor.cethos.com` — authenticated working portal for approved translators
- FCFS job board: approved translators browse and claim jobs matching their approved combinations
- Staff direct assignment as fallback
- Job execution: source file download, translation upload, messaging with staff
- Price negotiation on live jobs (project-specific, one counter allowed)
- Earnings page with performance scores and payout history
- Profile management

### Phase 2 Architecture Additions

**New tables needed:**
- `cvp_jobs` — vendor job assignments
- `cvp_job_messages` — per-job messaging
- `cvp_payments` — payout tracking

**New edge functions:**
- `cvp-get-job-board`, `cvp-claim-job`, `cvp-assign-job`
- `cvp-accept-job`, `cvp-decline-job`
- `cvp-submit-job-work`, `cvp-approve-job-submission`
- `cvp-get-vendor-earnings`

**Admin additions:**
- Assign translator section on `portal.cethos.com/admin/orders/:id`
- Payout management page
- Job board configuration

---

## 16. Implementation Phases

### Phase 1A — Foundation (Week 1–2)
- [ ] DB migration — all cvp_ tables (see CVP-DATABASE-SCHEMA.md)
- [ ] Repo setup — `cethos-vendor`, monorepo structure, two Netlify sites
- [ ] Supabase client config in recruitment app
- [ ] Application form UI — translator path complete
- [ ] Application form UI — cognitive debriefing path complete
- [ ] Form validation (React Hook Form + Zod)
- [ ] `cvp-submit-application` edge function
- [ ] `cvp-prescreen-application` edge function (Claude integration)
- [ ] Brevo templates V1, V2, V8
- [ ] Admin recruitment queue (basic list)

### Phase 1B — Testing Pipeline (Week 2–3)
- [ ] Test library DB + admin UI (`/admin/recruitment/tests`)
- [ ] `cvp-send-tests` edge function
- [ ] `cvp-get-test` edge function
- [ ] `cvp-save-test-draft` edge function
- [ ] `cvp-submit-test` edge function
- [ ] Applicant test page (`/test/{token}`)
- [ ] `cvp-assess-test` edge function (Claude integration, MQM)
- [ ] Brevo templates V3–V7
- [ ] `cvp-check-test-followups` cron

### Phase 1C — Review, Negotiation & Approval (Week 3–4)
- [ ] Admin application detail page with side-by-side test review
- [ ] Staff approve/reject/waitlist/request-info actions
- [ ] `cvp-send-negotiation` edge function
- [ ] `cvp-submit-counter` edge function
- [ ] Negotiate page (`/negotiate/{token}`)
- [ ] `cvp-approve-application` edge function
- [ ] `cvp-reject-application` edge function + 48hr queue
- [ ] `cvp-send-queued-rejections` cron
- [ ] Brevo templates V9–V13

### Phase 1D — Profile Health (Week 4–5)
- [ ] `cvp_translators` basic profile page on vendor portal (login + profile only)
- [ ] Profile completeness score calculation
- [ ] `cvp-check-vendor-profiles` cron
- [ ] `cvp-send-profile-nudges` cron
- [ ] Admin vendor roster (`/admin/vendors`)
- [ ] Brevo templates V14–V17

---

## 17. Design Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| Integration approach | Shared Supabase DB + edge function API layer | Fastest to build, clean migration path to full independence later |
| Table prefix | `cvp_` | Identifies all vendor portal tables for easy future extraction |
| Applicant test auth | Token-based, no login | Reduces abandonment — no account creation barrier |
| AI autonomy on tests | ≥80 auto-approve, 65–79 staff review, <65 auto-reject | Balances automation with human oversight |
| Rejection email flow | AI drafts, 48hr staff interception window | Ensures quality of feedback without slowing pipeline |
| Approval granularity | Per language pair + domain combination | Translators can work approved pairs while others are assessed |
| Negotiation | One counter-offer allowed, AI resolves within band | Clean, simple, avoids back-and-forth overhead |
| Negotiation band | Per translator tier (Standard/Senior/Expert) | Fairer — more experienced translators have more leverage |
| Performance scoring visibility | Translator sees simplified score, staff sees full | Transparency without over-disclosing internal metrics |
| Cognitive debriefing test | CV/credential review only — no translation test | Different skill set — process knowledge, not text quality |
| Inactivity flag | Internal staff flag only — no email to translator | Don't penalise translators for being busy elsewhere |
| Repo structure | Monorepo with two Netlify sites | Share code between recruitment and vendor portal |
| Form URL | `join.cethos.com` | Clean, public-facing, separates from vendor working portal |

---

## 18. Progress Tracker

*Updated after each development session.*

| Phase | Task | Status | Date | Notes |
|---|---|---|---|---|
| Setup | Repo created | ⬜ Pending | | |
| Setup | Netlify sites configured | ⬜ Pending | | |
| Setup | DB migration run | ⬜ Pending | | |
| 1A | Application form — translator | ⬜ Pending | | |
| 1A | Application form — cog debriefing | ⬜ Pending | | |
| 1A | cvp-submit-application | ⬜ Pending | | |
| 1A | cvp-prescreen-application | ⬜ Pending | | |

---

*End of CVP-MASTER-PLAN.md*
