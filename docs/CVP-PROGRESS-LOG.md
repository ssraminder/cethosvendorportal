# CVP — Development Progress Log

**Document:** `CVP-PROGRESS-LOG.md`
**Project:** CETHOS Vendor Portal (CVP)
**Repo:** cethos-vendor
**Started:** February 18, 2026

---

## How to Use This Document

Claude Code updates this file at the end of every development session.
Format: newest sessions at the top.

---

## Session — February 18, 2026 (Phase 1B — Testing Pipeline)

### Completed
- Built `cvp-send-tests` edge function (`supabase/functions/cvp-send-tests/index.ts`)
  - Matches tests from `cvp_test_library` to each pending `cvp_test_combinations` row
  - Prefers matching difficulty (from AI prescreen suggestion), falls back to any available
  - Selects least-recently-used test to distribute load
  - Creates `cvp_test_submissions` records with 48hr token expiry
  - Updates combination statuses, test library usage stats
  - Sends V3 batch test invitation email via Brevo with test links
  - Handles `no_test_available` case gracefully (flags for staff)
- Built `cvp-get-test` edge function (`supabase/functions/cvp-get-test/index.ts`)
  - Validates token, checks expiry and submission status
  - Returns test content (source text, instructions, LQA flawed translation if applicable)
  - Tracks views (first_viewed_at, view_count)
  - Returns saved draft content for resume capability
  - Never exposes reference translations or answer keys to applicant
  - Returns MQM dimensions for LQA review tests
- Built `cvp-save-test-draft` edge function (`supabase/functions/cvp-save-test-draft/index.ts`)
  - Auto-saves draft content every 60 seconds from frontend
  - Validates token, checks expiry and submission status
  - Updates status to `draft_saved` on first save
- Built `cvp-submit-test` edge function (`supabase/functions/cvp-submit-test/index.ts`)
  - Enforces one submission per token (strict)
  - Stores submitted content and optional notes
  - Updates combination and application statuses
  - Checks if all combinations submitted to update app status accordingly
  - Sends V7 Test Received confirmation email
  - Fire-and-forget trigger to `cvp-assess-test`
- Built `cvp-assess-test` edge function (`supabase/functions/cvp-assess-test/index.ts`)
  - Claude AI (claude-sonnet-4-6) assessment with MQM Core dimensions
  - Translation tests: Accuracy (35%), Fluency (25%), Terminology (20%), Formatting (10%), Certification-readiness (10%)
  - LQA tests: errors identified/missed/false positives, category accuracy, severity accuracy, comment quality
  - Scoring thresholds: >=80 auto-approve, 65-79 staff review, <65 auto-reject
  - Retry on first failure, fall back to staff_review on second failure (AI fallback rule)
  - Updates submission, combination, and application statuses
  - Updates test library pass/fail stats
  - Queues rejection email with 48hr window + 6-month cooldown for auto-reject
- Built `cvp-check-test-followups` cron function (`supabase/functions/cvp-check-test-followups/index.ts`)
  - Day 2: 24hr reminder email (V4) — 24 hours before token expiry
  - Day 3: Token expired notification (V5) — marks submission as expired
  - Day 7: Final chance email (V6) — applicant can request new link
  - Day 10: Auto-archive — archives application if no tests submitted
  - Processes in batches of 50, idempotent (safe to run multiple times)
  - Each email tracked independently per submission (reminder_day2/3/7_sent_at)
- Built `TestSubmission` page (`apps/recruitment/src/pages/TestSubmission.tsx`)
  - Token-based access at `/test/:token` — no login required
  - Loading, error (expired/already submitted/invalid), and submitted states
  - Displays test instructions, source text, and countdown timer
  - LQA mode: shows flawed translation + MQM category guide
  - Auto-saves draft every 60 seconds
  - Save draft button + submit button with confirmation dialog
  - Expiry warning when < 2 hours remaining
  - Source file download link when applicable
  - Mobile responsive, clean professional design
- Added `/test/:token` route to App.tsx

### Files Created
- `supabase/functions/cvp-send-tests/index.ts`
- `supabase/functions/cvp-get-test/index.ts`
- `supabase/functions/cvp-save-test-draft/index.ts`
- `supabase/functions/cvp-submit-test/index.ts`
- `supabase/functions/cvp-assess-test/index.ts`
- `supabase/functions/cvp-check-test-followups/index.ts`
- `apps/recruitment/src/pages/TestSubmission.tsx`

### Files Modified
- `apps/recruitment/src/App.tsx` — added `/test/:token` route

### Next Steps
- Deploy new edge functions to Supabase
- Create Brevo email templates V3, V4, V5, V6, V7
- Register `cvp-check-test-followups` as pg_cron job (every hour)
- Build test library admin UI in CETHOS portal (separate repo)
- Begin Phase 1C — review, negotiation, and approval pipeline

---

## Session — February 18, 2026 (Admin Pages → Portal Integration Prompt)

### Completed
- Removed admin pages (`RecruitmentQueue.tsx`, `ApplicationDetail.tsx`) from recruitment app — they belong in the CETHOS portal at `portal.cethos.com`, not in `join.cethos.com`
- Removed admin routes from `App.tsx`
- Created `docs/CVP-ADMIN-INTEGRATION-PROMPT.md` — self-contained prompt for integrating admin recruitment pages into the existing CETHOS portal codebase, including:
  - Full database schema reference for all CVP tables (cvp_applications, cvp_test_combinations, cvp_test_submissions)
  - AI pre-screening result JSON structures (translator, cognitive debriefing, fallback)
  - Complete page specs for queue + detail pages
  - All Supabase query patterns
  - Display constants and form option labels
  - Business rules (rejection window, cooldown, tier override, thresholds)

### Files Created
- `docs/CVP-ADMIN-INTEGRATION-PROMPT.md`

### Files Removed
- `apps/recruitment/src/pages/admin/RecruitmentQueue.tsx`
- `apps/recruitment/src/pages/admin/ApplicationDetail.tsx`

### Files Modified
- `apps/recruitment/src/App.tsx` — removed admin routes

### Next Steps
- Use `CVP-ADMIN-INTEGRATION-PROMPT.md` in a Claude Code session on the CETHOS portal repo to build the admin pages there
- Begin Phase 1B — testing pipeline in this repo

---

## Session — February 18, 2026 (Phase 1A — Admin Application Detail Page)

### Completed
- Built admin application detail page (`apps/recruitment/src/pages/admin/ApplicationDetail.tsx`)
  - Three-column layout: applicant info (left), stage-specific content (centre), staff actions (right)
  - **Left panel:** Contact info, professional background (translator + cognitive debriefing paths), certifications, CAT tools, services, rate expectations, work samples, applicant notes
  - **Centre panel:** AI pre-screening results with score breakdown (translator: demand match, certification quality, experience consistency, sample quality, rate assessment; cognitive debriefing: COA/PRO experience, guideline familiarity, interviewing skills, language fluency, report writing); red flags display; AI fallback indicator; test combinations with per-combination status cards, test scores, token expiry countdowns; negotiation history timeline; reapplication cooldown notice
  - **Right panel:** Editable staff notes with save; tier override dropdown (translator only); decision buttons (Approve, Reject, Waitlist, Request Info); rejection email editor with 48hr interception window; rejection intercept action; waitlist details; application timeline
- Added `/admin/recruitment/:id` route to App.tsx
- TypeScript strict mode passes with zero errors
- Vite production build succeeds

### Files Created
- `apps/recruitment/src/pages/admin/ApplicationDetail.tsx`

### Files Modified
- `apps/recruitment/src/App.tsx` — added detail page route

### Next Steps
- Begin Phase 1B — testing pipeline (test library admin UI, send-tests edge function, test page)

---

## Session — February 18, 2026 (Phase 1A — Edge Functions + Admin Queue)

### Completed
- Built `cvp-submit-application` edge function (`supabase/functions/cvp-submit-application/index.ts`)
  - Validates input, checks reapplication cooldown
  - Creates `cvp_applications` row with all fields per schema
  - Creates `cvp_test_combinations` rows (one per language pair + domain + service type)
  - Generates application number (APP-YY-NNNN format)
  - Sends V1 confirmation email via Brevo
  - Fire-and-forget trigger to `cvp-prescreen-application`
- Built `cvp-prescreen-application` edge function (`supabase/functions/cvp-prescreen-application/index.ts`)
  - Calls Claude API (claude-sonnet-4-6) with structured prompts for translator and cognitive debriefing paths
  - Translator: scores 0-100, routes by threshold (>=70 proceed, 50-69 staff review, <50 reject)
  - Cognitive debriefing: always routes to staff_review (AI advisory only per spec)
  - AI fallback: on any failure, falls back to staff_review status (never blocks pipeline)
  - Assigns tier (standard/senior/expert) based on AI suggestion
  - For auto-rejects: queues rejection email with 48hr window, sets 6-month reapply cooldown
  - Sends V2 (passed) or V8 (under review) emails via Brevo
- Created shared Brevo email helper (`supabase/functions/_shared/brevo.ts`)
  - Template ID constants for all 17 Brevo templates (V1–V17)
  - `sendBrevoEmail()` utility function with error handling
- Built admin recruitment queue page (`apps/recruitment/src/pages/admin/RecruitmentQueue.tsx`)
  - Four tabs: Needs Attention, In Progress, Decided, Waitlist
  - Per-tab application counts
  - Sortable columns: name, AI score, applied date
  - Search by name, email, or application number
  - Color-coded status badges and AI score indicators
  - Tier display, days-since-activity counter
  - Link to detail page (placeholder route)
- Added `/admin/recruitment` route to the app

### Files Created
- `supabase/functions/cvp-submit-application/index.ts`
- `supabase/functions/cvp-prescreen-application/index.ts`
- `supabase/functions/_shared/brevo.ts`
- `apps/recruitment/src/pages/admin/RecruitmentQueue.tsx`

### Files Modified
- `apps/recruitment/src/App.tsx` — added admin route

### Next Steps
- Deploy edge functions to Supabase (`supabase functions deploy`)
- Create Brevo email templates V1, V2, V8 in the Brevo dashboard
- Build admin application detail page (`/admin/recruitment/:id`)
- Begin Phase 1B — testing pipeline

---

## Session — February 18, 2026 (Phase 1A — Project Scaffold + Application Form)

### Completed
- Set up monorepo structure: `/apps/recruitment`, `/apps/vendor` (placeholder), `/supabase/`
- Scaffolded recruitment app with Vite + React + TypeScript
- Installed and configured Tailwind CSS v4 (via `@tailwindcss/vite`)
- Installed dependencies: Supabase JS client, React Hook Form, Zod v4, React Router, Lucide icons
- Configured Supabase client (`src/lib/supabase.ts`) using `anon` key via env vars
- Created `.env.example` with required environment variables
- Built complete application form UI for **Translator / Reviewer** path (all 8 sections per spec)
- Built complete application form UI for **Cognitive Debriefing Consultant** path (all sections per spec)
- Built role type selector that dynamically switches between both form paths
- Built reusable components: Layout, FormSection, FormField, LanguagePairRow
- Built Zod validation schemas for both translator and cognitive debriefing forms
- Built confirmation page (`/apply/confirmation`) with application number display
- Set up React Router with routes: `/apply`, `/apply/confirmation`, `/` redirect
- Created Netlify config with SPA redirect rule
- Created all 8 database migration files (001–008) matching `CVP-DATABASE-SCHEMA.md` exactly
- TypeScript strict mode passes with zero errors
- Vite production build succeeds

### Files Created
- `apps/recruitment/` — full Vite + React + TS app
- `apps/recruitment/src/pages/Apply.tsx` — main application form (translator + cognitive debriefing)
- `apps/recruitment/src/pages/Confirmation.tsx` — post-submission confirmation page
- `apps/recruitment/src/components/Layout.tsx` — page layout with header + footer
- `apps/recruitment/src/components/FormSection.tsx` — reusable form section wrapper
- `apps/recruitment/src/components/FormField.tsx` — reusable labeled form field
- `apps/recruitment/src/components/LanguagePairRow.tsx` — dynamic language pair + domain row
- `apps/recruitment/src/lib/supabase.ts` — Supabase client config
- `apps/recruitment/src/lib/schemas.ts` — Zod validation schemas
- `apps/recruitment/src/lib/constants.ts` — form option constants (countries, domains, etc.)
- `apps/recruitment/src/hooks/useLanguages.ts` — hook to fetch languages from Supabase
- `apps/recruitment/src/types/application.ts` — TypeScript type definitions
- `apps/recruitment/netlify.toml` — Netlify build + redirect config
- `apps/recruitment/.env.example` — environment variables template
- `apps/vendor/src/placeholder.ts` — Phase 2 placeholder
- `supabase/migrations/001_cvp_test_library.sql`
- `supabase/migrations/002_cvp_applications.sql`
- `supabase/migrations/003_cvp_test_combinations.sql`
- `supabase/migrations/004_cvp_test_submissions.sql`
- `supabase/migrations/005_cvp_translators.sql`
- `supabase/migrations/006_cvp_profile_nudges.sql`
- `supabase/migrations/007_cvp_rls_policies.sql`
- `supabase/migrations/008_cvp_add_translator_fk.sql`

### Next Steps
- Run DB migrations against Supabase (`supabase db push` or apply manually)
- Set up environment variables (Supabase anon key)
- Build `cvp-submit-application` edge function
- Build `cvp-prescreen-application` edge function (Claude AI integration)
- Create Brevo email templates V1, V2, V8
- Build admin recruitment queue (basic list view)

---

## Session — February 18, 2026 (Repo Setup)

### Completed
- Created `/docs/` directory and moved all planning docs into it (matches path references in documents)
- Created `CLAUDE.md` at repo root — Claude Code auto-reads this file on every session
- `CLAUDE.md` contains project rules, tech stack, business rules, and pointers to detailed docs

### Files Changed
- `docs/CVP-MASTER-PLAN.md` — moved from repo root to `/docs/`
- `docs/CVP-DATABASE-SCHEMA.md` — moved from repo root to `/docs/`
- `docs/CVP-CLAUDE-CODE-INSTRUCTIONS.md` — moved from repo root to `/docs/`
- `docs/CVP-PROGRESS-LOG.md` — moved from repo root to `/docs/`
- `CLAUDE.md` — created at repo root (new file)

### Next Steps
- Begin Phase 1A tasks (see list below)

---

## Session — February 18, 2026 (Planning)

### Completed
- Full recruitment plan defined through Q&A with Raminder
- CVP-MASTER-PLAN.md created
- CVP-DATABASE-SCHEMA.md created
- CVP-CLAUDE-CODE-INSTRUCTIONS.md created
- CVP-PROGRESS-LOG.md created (this file)

### Decisions Made This Session
- Integration: Shared Supabase project, edge function API layer
- Table prefix: `cvp_`
- Recruitment URL: `join.cethos.com`
- Vendor portal URL: `vendor.cethos.com` (Phase 2)
- Repo: `cethos-vendor` (monorepo, Claude Code)
- Stack: React + Vite + TypeScript + Tailwind
- Two applicant types: Translator and Cognitive Debriefing Consultant
- Test types: Translation, Translation + Review, LQA Review (MQM Core)
- Approval granularity: per language pair + domain + service type combination
- AI scoring thresholds: ≥80 auto-approve, 65–79 staff review, <65 auto-reject
- Rejection flow: AI drafts email, 48hr staff interception window
- Rate negotiation: per translator tier (Standard/Senior/Expert), one counter allowed
- Follow-up sequence: Day 1, 2, 3, 7, 10 (archive)
- Profile health checks: weekly cron, 5 triggers, 30-day suppression
- Performance scoring: Phase 2 (schema ready from Phase 1)

### Nothing Built Yet
All tasks in Phase 1A are pending.

### Next Steps (Phase 1A — Week 1)
- [ ] Create `cethos-vendor` repository
- [ ] Set up monorepo structure with `/apps/recruitment` and `/apps/vendor`
- [ ] Configure two Netlify sites from same repo
- [ ] Set up Supabase client in recruitment app
- [ ] Run DB migration for all Phase 1 cvp_ tables
- [ ] Build application form UI (translator path)
- [ ] Build application form UI (cognitive debriefing path)
- [ ] Build `cvp-submit-application` edge function
- [ ] Build `cvp-prescreen-application` edge function
- [ ] Create Brevo templates V1, V2, V8
- [ ] Build admin recruitment queue (basic list view)

---

## Phase Status Overview

| Phase | Name | Status |
|---|---|---|
| 1A | Foundation — form + pre-screen | ✅ Complete |
| 1B | Testing pipeline | ✅ Complete (edge functions + frontend + cron) |
| 1C | Review, negotiation, approval | ⬜ Not started |
| 1D | Profile health system | ⬜ Not started |
| 2 | Vendor working portal | ⬜ Not started (Phase 2) |

---

## Key Files

| File | Purpose | Location |
|---|---|---|
| CVP-MASTER-PLAN.md | Full system plan and specifications | /docs/ |
| CVP-DATABASE-SCHEMA.md | All table definitions and RLS policies | /docs/ |
| CVP-CLAUDE-CODE-INSTRUCTIONS.md | Prompt templates and rules for Claude Code | /docs/ |
| CVP-PROGRESS-LOG.md | This file — session history | /docs/ |

---

## Environment Setup Checklist

- [ ] Supabase project confirmed: lmzoyezvsjgsxveoakdr
- [ ] `cethos-vendor` repo created on GitHub
- [ ] Netlify site 1 created: join.cethos.com
- [ ] Netlify site 2 created: vendor.cethos.com (Phase 2 — can wait)
- [ ] DNS records configured for join.cethos.com
- [ ] Supabase secrets set: ANTHROPIC_API_KEY, BREVO_API_KEY
- [ ] DB migrations run successfully
- [ ] Brevo sender domain verified for join.cethos.com emails

---

*End of CVP-PROGRESS-LOG.md*
