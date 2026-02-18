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
| 1A | Foundation — form + pre-screen | ⬜ Not started |
| 1B | Testing pipeline | ⬜ Not started |
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
