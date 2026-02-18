# CVP Admin Integration — Prompt for CETHOS Portal

**Purpose:** Use this prompt in a Claude Code session on the `portal.cethos.com` codebase to integrate the CVP (CETHOS Vendor Portal) admin recruitment pages.

---

## Task

Add a **Vendor Recruitment** section to the existing CETHOS admin portal at `portal.cethos.com`. This section manages freelance translator and cognitive debriefing consultant applications. The pages query **existing Supabase tables** (already created, already populated by edge functions in the `cethos-vendor` repo).

Add these routes under the existing admin navigation:

1. `/admin/recruitment` — Application queue (list view with tabs)
2. `/admin/recruitment/:id` — Application detail (three-panel view)

Both pages query the **same Supabase project** the portal already uses (`lmzoyezvsjgsxveoakdr`). No new API layer needed — these are direct Supabase client queries.

---

## Database Tables (Already Exist — Do Not Create)

All tables use `cvp_` prefix. They are in the same Supabase project the CETHOS portal already connects to. Staff access is controlled by existing RLS policies that check `staff_users.auth_user_id = auth.uid()`.

### `cvp_applications` — Primary record per vendor application

```sql
-- Key columns you'll query:
id                          UUID PRIMARY KEY
application_number          VARCHAR(20) NOT NULL UNIQUE  -- Format: APP-YY-NNNN
role_type                   VARCHAR(30) NOT NULL  -- 'translator' | 'cognitive_debriefing'

-- Personal info
email                       VARCHAR(255) NOT NULL
full_name                   VARCHAR(255) NOT NULL
phone                       VARCHAR(50)
city                        VARCHAR(100)
country                     VARCHAR(100) NOT NULL
linkedin_url                TEXT

-- Professional background (translator)
years_experience            INTEGER  -- 0=<1yr, 1, 3, 5, 7, 10 (lower bound of bracket)
education_level             VARCHAR(50)  -- bachelor, master, phd, diploma_certificate, other
certifications              JSONB DEFAULT '[]'  -- [{name: "ATA", customName?: string, expiryDate?: "2027-03-01"}]
cat_tools                   TEXT[] DEFAULT '{}'  -- ["Trados", "MemoQ", ...]
services_offered            TEXT[] DEFAULT '{}'  -- ["translation", "translation_review", "lqa_review"]
work_samples                JSONB DEFAULT '[]'  -- [{storage_path: "vendor/samples/...", description: "..."}]
rate_expectation            DECIMAL(10,2)  -- Per page, CAD
referral_source             VARCHAR(100)
notes                       TEXT

-- Professional background (cognitive debriefing)
cog_years_experience        INTEGER
cog_degree_field            VARCHAR(200)
cog_credentials             TEXT
cog_instrument_types        TEXT[] DEFAULT '{}'  -- ["pro", "clinro", "obro", "interview_guide", "survey"]
cog_therapy_areas           TEXT[] DEFAULT '{}'
cog_pharma_clients          TEXT  -- Confidential
cog_ispor_familiarity       VARCHAR(20)  -- yes, no, partially
cog_fda_familiarity         VARCHAR(20)
cog_prior_debrief_reports   BOOLEAN DEFAULT FALSE
cog_sample_report_path      TEXT
cog_availability            VARCHAR(30)  -- full_time, part_time, project_based
cog_rate_expectation        DECIMAL(10,2)

-- Status (the main field you filter on)
status                      VARCHAR(40) NOT NULL DEFAULT 'submitted'
  -- Valid values: submitted, prescreening, prescreened, test_pending, test_sent,
  --   test_in_progress, test_submitted, test_assessed, negotiation,
  --   staff_review, approved, rejected, waitlisted, archived, info_requested

-- AI pre-screening results
ai_prescreening_score       INTEGER  -- 0-100
ai_prescreening_result      JSONB  -- Full AI output (see JSON structures below)
ai_prescreening_at          TIMESTAMPTZ

-- Tier assignment
assigned_tier               VARCHAR(20)  -- standard, senior, expert
tier_override_by            UUID REFERENCES staff_users(id)
tier_override_at            TIMESTAMPTZ

-- Rate negotiation
negotiation_status          VARCHAR(30)  -- not_needed, pending, offer_sent, accepted, countered, counter_accepted, staff_review, agreed, no_response
negotiation_log             JSONB DEFAULT '[]'  -- [{event, amount, final_amount, timestamp, notes}]
final_agreed_rate           DECIMAL(10,2)
negotiate_token             UUID UNIQUE
negotiate_token_expires_at  TIMESTAMPTZ

-- Staff review
staff_review_notes          TEXT  -- Editable by staff
staff_reviewed_by           UUID REFERENCES staff_users(id)
staff_reviewed_at           TIMESTAMPTZ

-- Rejection
rejection_reason            TEXT
rejection_email_draft       TEXT  -- AI-generated, staff-editable
rejection_email_status      VARCHAR(20) DEFAULT 'not_needed'  -- not_needed, queued, sent, intercepted
rejection_email_queued_at   TIMESTAMPTZ  -- 48hr interception window starts here

-- Reapplication control
can_reapply_after           DATE

-- Account link
translator_id               UUID  -- FK to cvp_translators.id (set on approval)

-- Waitlist
waitlist_language_pair      VARCHAR(100)
waitlist_notes              TEXT

-- Meta
created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### `cvp_test_combinations` — One row per language pair + domain + service type per application

```sql
id                    UUID PRIMARY KEY
application_id        UUID NOT NULL REFERENCES cvp_applications(id)
source_language_id    UUID NOT NULL REFERENCES languages(id)  -- Shared languages table
target_language_id    UUID NOT NULL REFERENCES languages(id)
domain                VARCHAR(50)  -- legal, medical, immigration, financial, technical, general
service_type          VARCHAR(30)  -- translation, translation_review, lqa_review
test_id               UUID  -- FK to cvp_test_library.id (set when test assigned)
test_submission_id    UUID  -- FK to cvp_test_submissions.id
status                VARCHAR(30) DEFAULT 'pending'
  -- Valid: pending, no_test_available, test_assigned, test_sent, test_submitted, assessed, approved, rejected, skipped
ai_score              INTEGER  -- 0-100 (test assessment score)
ai_assessment_result  JSONB
approved_at           TIMESTAMPTZ
approved_by           UUID REFERENCES staff_users(id)
approved_rate         DECIMAL(10,2)
created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### `cvp_test_submissions` — One row per test token issued

```sql
id                      UUID PRIMARY KEY
combination_id          UUID NOT NULL REFERENCES cvp_test_combinations(id)
test_id                 UUID NOT NULL REFERENCES cvp_test_library(id)
application_id          UUID NOT NULL REFERENCES cvp_applications(id)
token                   UUID NOT NULL UNIQUE
token_expires_at        TIMESTAMPTZ NOT NULL  -- created_at + 48 hours
status                  VARCHAR(30) DEFAULT 'sent'
  -- Valid: sent, viewed, draft_saved, submitted, assessed, expired
submitted_at            TIMESTAMPTZ
ai_assessment_score     INTEGER  -- 0-100
first_viewed_at         TIMESTAMPTZ
view_count              INTEGER DEFAULT 0
created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### `languages` — Shared CETHOS table (already exists)

```sql
id        UUID PRIMARY KEY
name      TEXT  -- e.g. "Spanish"
code      VARCHAR  -- e.g. "es"
is_active BOOLEAN
```

---

## AI Pre-screening Result JSON Structures

The `ai_prescreening_result` column on `cvp_applications` contains one of three shapes:

### Translator pre-screen result
```json
{
  "overall_score": 74,
  "recommendation": "proceed",        // "proceed" | "staff_review" | "reject"
  "demand_match": "high",             // "high" | "medium" | "low"
  "certification_quality": "high",    // "high" | "medium" | "low" | "none"
  "experience_consistency": "medium", // "high" | "medium" | "low"
  "sample_quality": "not_provided",   // "high" | "medium" | "low" | "not_provided"
  "rate_expectation_assessment": "above_band",  // "within_band" | "above_band" | "below_band" | "not_provided"
  "red_flags": [],
  "notes": "...",
  "suggested_test_difficulty": "intermediate",  // "beginner" | "intermediate" | "advanced"
  "suggested_test_types": ["translation", "lqa_review"],
  "suggested_tier": "senior"          // "standard" | "senior" | "expert"
}
```

### Cognitive debriefing pre-screen result
```json
{
  "overall_score": 68,
  "recommendation": "staff_review",   // Always "staff_review" for cog debriefing
  "coa_instrument_experience": "strong",   // "strong" | "partial" | "weak"
  "guideline_familiarity": "partial",
  "interviewing_skills": "strong",
  "language_fluency": "strong",
  "report_writing_experience": "partial",
  "red_flags": [],
  "notes": "..."
}
```

### AI fallback (when AI call failed)
```json
{
  "error": "ai_fallback",
  "reason": "Claude API error 500: ..."
}
```

---

## Page 1: `/admin/recruitment` — Application Queue

### Layout
Tabbed list view with search and sortable columns.

### Tabs and filters
| Tab | Statuses shown |
|---|---|
| Needs Attention | `staff_review`, `info_requested` |
| In Progress | `submitted`, `prescreening`, `prescreened`, `test_pending`, `test_sent`, `test_in_progress`, `test_submitted`, `test_assessed`, `negotiation` |
| Decided | `approved`, `rejected`, `archived` |
| Waitlist | `waitlisted` |

Each tab shows its count badge.

### Table columns
- Application number (mono font)
- Name + email
- Role type badge (Translator or Cog. Debrief)
- Country
- AI Score (color: green >=70, yellow >=50, red <50)
- Tier (Standard/Senior/Expert)
- Status badge (color-coded)
- Applied date
- Days since last update
- Link to detail page

### Features
- Search by name, email, or application number
- Sortable by: name, AI score, applied date
- Tab counts update on load

### Supabase queries
```typescript
// Fetch filtered by tab
supabase.from('cvp_applications')
  .select('id, application_number, full_name, email, role_type, status, ai_prescreening_score, assigned_tier, country, created_at, updated_at')
  .in('status', statusesForTab)
  .order(sortField, { ascending: sortAsc })

// Count per tab
supabase.from('cvp_applications')
  .select('*', { count: 'exact', head: true })
  .in('status', statusesForTab)
```

---

## Page 2: `/admin/recruitment/:id` — Application Detail

### Layout
Three-column grid: left (3/12), centre (5/12), right (4/12).

### Header
- Back link to `/admin/recruitment`
- Applicant name, status badge, tier badge
- Application number, role type, applied date, days ago

### Left panel — Applicant info
- **Contact:** Email (mailto link), phone, city/country, LinkedIn (external link)
- **Professional background (translator):** Experience bracket, education, certifications with expiry dates, CAT tools, services offered
- **Professional background (cognitive debriefing):** Debriefing experience, education, degree field, credentials, COA/PRO instrument types, therapy areas, ISPOR familiarity, FDA COA familiarity, prior debrief reports, availability
- **Rate & referral:** Expected rate, agreed rate (if set), referral source
- **Work samples:** List with descriptions and storage paths
- **Applicant notes:** Free text from form submission

### Centre panel — Stage content
- **AI Pre-screening section (collapsible):**
  - Score in large text (color by threshold)
  - For translator: 2x3 grid of score badges (recommendation, demand match, certification quality, experience consistency, sample quality, rate assessment), suggested test difficulty + tier, suggested test types, red flags, AI notes
  - For cognitive debriefing: 2x3 grid (COA/PRO experience, guideline familiarity, interviewing skills, language fluency, report writing, recommendation), red flags, AI notes
  - For AI fallback: amber warning box with reason
  - Screened timestamp
- **Test Combinations section (collapsible):**
  - One card per combination showing: source → target language, domain, service type, status badge
  - Test score (if assessed, color by threshold: green >=80, yellow >=65, red <65)
  - Approval info (if approved, with date and rate)
  - Test submission info (if token exists): token status, expiry countdown in hours, view count, submitted timestamp
- **Negotiation history:** Timeline of events with amounts and timestamps
- **Reapplication cooldown:** Yellow notice if `can_reapply_after` is set

### Right panel — Staff actions
- **Staff notes:** Textarea, save button, last reviewed timestamp
- **Tier override (translator only):** Dropdown (standard/senior/expert), update button, override timestamp
- **Decision buttons (2x2 grid):**
  - Approve (green) — sets status to `approved`
  - Reject (red) — sets status to `rejected`, queues rejection email with 48hr window, sets 6-month reapply cooldown
  - Waitlist (cyan outline) — sets status to `waitlisted`
  - Request Info (yellow outline) — sets status to `info_requested`
- **Rejection email editor (conditional):** Shows when `rejection_email_status` is `queued` or `intercepted`. Includes: countdown of hours left in 48hr window, intercepted confirmation banner, editable textarea for the draft, save draft button, intercept button (stops auto-send)
- **Waitlist details (conditional):** Shows when status is `waitlisted`
- **Timeline:** List of key dates (applied, AI prescreened with score, staff reviewed, rejection queued, tier overridden, last updated)

### Supabase queries for detail page
```typescript
// Application
supabase.from('cvp_applications').select('*').eq('id', id).single()

// Test combinations
supabase.from('cvp_test_combinations').select('*').eq('application_id', id).order('created_at', { ascending: true })

// Language names for combinations (resolve source_language_id and target_language_id)
supabase.from('languages').select('id, name').in('id', allLanguageIds)

// Test submissions
supabase.from('cvp_test_submissions').select('*').eq('application_id', id).order('created_at', { ascending: true })

// Staff update examples:
supabase.from('cvp_applications').update({ staff_review_notes: notes, updated_at: now }).eq('id', id)
supabase.from('cvp_applications').update({ assigned_tier: tier, tier_override_at: now, updated_at: now }).eq('id', id)
supabase.from('cvp_applications').update({ status: 'rejected', rejection_reason: '...', rejection_email_status: 'queued', rejection_email_queued_at: now, can_reapply_after: sixMonthsFromNow, updated_at: now }).eq('id', id)
supabase.from('cvp_applications').update({ rejection_email_status: 'intercepted', updated_at: now }).eq('id', id)
```

---

## Display Constants

### Status labels and colors
```typescript
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted', prescreening: 'Pre-screening', prescreened: 'Pre-screened',
  test_pending: 'Test Pending', test_sent: 'Test Sent', test_in_progress: 'Test In Progress',
  test_submitted: 'Test Submitted', test_assessed: 'Test Assessed', negotiation: 'Negotiation',
  staff_review: 'Staff Review', approved: 'Approved', rejected: 'Rejected',
  waitlisted: 'Waitlisted', archived: 'Archived', info_requested: 'Info Requested',
}
```

### Tier labels
- `standard` → "Standard"
- `senior` → "Senior"
- `expert` → "Expert"

### Combination status labels
- `pending` → "Pending", `no_test_available` → "No Test Available", `test_assigned` → "Test Assigned"
- `test_sent` → "Test Sent", `test_submitted` → "Test Submitted", `assessed` → "Assessed"
- `approved` → "Approved", `rejected` → "Rejected", `skipped` → "Skipped"

### Form option labels (for displaying stored values)
```
Experience: 0="Less than 1 year", 1="1–3 years", 3="3–5 years", 5="5–10 years", 10="10+ years"
Education: bachelor="Bachelor's", master="Master's", phd="PhD", diploma_certificate="Diploma / Certificate", other="Other"
Certifications: ATA="ATA (American Translators Association)", CTTIC="CTTIC (Canadian Translators, Terminologists and Interpreters Council)", ITI="ITI (Institute of Translation and Interpreting)", CIOL="CIOL (Chartered Institute of Linguists)", ISO_17100="ISO 17100 certified"
Domain: legal="Legal", medical="Medical", immigration="Immigration", financial="Financial", technical="Technical", general="General"
Service: translation="Translation", translation_review="Translation + Review", lqa_review="LQA Review"
COA instruments: pro="Patient-Reported Outcomes (PROs)", clinro="Clinician-Reported Outcomes (ClinROs)", obro="Observer-Reported Outcomes (ObsROs)", interview_guide="Interview guides", survey="Surveys and questionnaires"
Therapy areas: oncology="Oncology", rheumatology="Rheumatology", neurology="Neurology", cardiology="Cardiology", rare_disease="Rare Disease", general="General", other="Other"
Familiarity: yes="Yes", no="No", partially="Partially"
Availability: full_time="Full-time", part_time="Part-time", project_based="Project-based"
```

---

## Business Rules

1. **Rejection 48hr window:** When rejecting, set `rejection_email_queued_at` to now. A cron job sends the email after 48 hours. Staff can intercept (set `rejection_email_status = 'intercepted'`) or edit the draft during this window. The window is calculated from `rejection_email_queued_at`, NOT from `created_at`.
2. **Reapplication cooldown:** On rejection, set `can_reapply_after` to 6 months from now (date only).
3. **Tier override:** Staff can change tier at any time. Record `tier_override_at` timestamp.
4. **Cognitive debriefing:** AI is advisory only — all cog debriefing applications go to staff review regardless of score.
5. **AI score thresholds (translator pre-screen):** >=70 proceed to test, 50-69 staff review, <50 auto-reject.
6. **AI score thresholds (test assessment):** >=80 auto-approve combo, 65-79 staff review, <65 auto-reject combo.
7. **Never log `payout_details`** — this column exists on `cvp_translators` but must never appear in console output.

---

## Integration Notes

- These pages should be added under a **"Vendors"** section in the existing admin sidebar/navigation.
- The pages use the same Supabase client the portal already has configured.
- The pages are self-contained — they only need Supabase client access, a router with `:id` params, and an icon library (Lucide React recommended).
- Adapt to match the existing portal's UI framework, layout patterns, and component library.

---

*End of CVP-ADMIN-INTEGRATION-PROMPT.md*
