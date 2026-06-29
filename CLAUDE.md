# CLAUDE.md — Claude Code Project Instructions

You are building the **CETHOS Vendor Portal (CVP)** — a standalone recruitment and vendor management system for freelance translators.

## Project memory (read at session start, update before commit)

This repository has a project-local memory system at `/memory/`:

- `memory/user.md` — primary user profile (role, context, working style)
- `memory/people.md` — team, stakeholders, vendors, clients referenced in conversations
- `memory/preferences.md` — captured preferences for code, communication, tooling
- `memory/decisions.md` — architectural, product, and business decisions with rationale

**At the start of every session:** read all four files before doing substantive work. They carry context from prior sessions that won't be in your conversation history.

**Before every `git commit`:** update the relevant memory file(s) with anything new from this session — new decisions, preferences confirmed, people introduced, or shifts in the user's context. Stage the memory updates as part of the same commit so context is version-controlled with the code.

If a memory file is stale or contradicts current reality, fix it rather than just appending.

## Before Writing Any Code

You MUST read these documents first:

1. `/docs/CVP-MASTER-PLAN.md` — Full system plan and specifications
2. `/docs/CVP-DATABASE-SCHEMA.md` — All table definitions and RLS policies
3. `/docs/CVP-PROGRESS-LOG.md` — What has already been built
4. `/docs/CVP-CLAUDE-CODE-INSTRUCTIONS.md` — Prompt templates and detailed rules

## Absolute Rules

- All new database tables MUST use the `cvp_` prefix
- Never touch tables without `cvp_` prefix — those belong to CETHOS portal
- Never query CETHOS core tables (`quotes`, `orders`, `customers`, etc.) directly
- All cross-system access goes through edge functions only
- All edge functions must be prefixed `cvp-`
- After completing your task, update `/docs/CVP-PROGRESS-LOG.md` with what was done
- If anything in the task conflicts with the plan documents, flag it before proceeding
- **Release note + version bump per PR (REQUIRED).** Any PR that changes app source MUST prepend a new entry to the affected app's `releaseNotes.ts` (bumps the CalVer `YEAR.MONTH.PATCH`): `apps/vendor/src/lib/releaseNotes.ts` for the vendor portal, `apps/recruitment/src/lib/releaseNotes.ts` for the recruitment site. When either bumps, ALSO update its maintained entry in the admin repo's `client/lib/portalRegistry.ts` ("All Cethos systems" overview). A CI required check (`require-release-note`) fails the PR if `apps/*/src/**` changed without the matching `releaseNotes.ts`. Docs/tests/CI/config-only changes are exempt.

## Code Standards

- TypeScript strict mode throughout — no `any` types without comment explaining why
- All edge functions use Deno + Supabase `service_role` key
- Frontend uses Supabase `anon` key only

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS
- React Hook Form + Zod (forms and validation)
- Supabase JS client
- Deployed on Netlify
- Supabase project: `lmzoyezvsjgsxveoakdr`

## Key Business Rules

1. **Table naming:** All new tables must start with `cvp_`
2. **API boundary:** CVP edge functions never query `quotes`, `orders`, `customers`, `ai_analysis_results`, `hitl_reviews`, `quote_files`, or any CETHOS table without `cvp_` prefix
3. **Test tokens:** 48-hour expiry from creation. One submission per token. No login required.
4. **Rejection window:** 48 hours from `rejection_email_queued_at` before auto-send. Check this column, not `created_at`.
5. **Approval granularity:** Each `cvp_test_combinations` row is approved independently. Vendor account created when >= 1 combination approved.
6. **Negotiation limit:** Applicant can submit ONE counter-offer. `negotiate_token` becomes invalid after first use.
7. **Reapplication cooldown:** Check `can_reapply_after` on new submissions. Reject with polite message if within cooldown.
8. **Nudge suppression:** Check `cvp_profile_nudges.suppressed_until` before sending any nudge email. Never send the same nudge type within 30 days.
9. **AI fallback:** If any AI call fails (timeout, parse error, API error), fall back to `staff_review` status — never block the pipeline.
10. **Payout details:** Never log `payout_details` column in any console output or error message.

## Environment Variables

Reference these but never hardcode values:

```
VITE_SUPABASE_URL=https://lmzoyezvsjgsxveoakdr.supabase.co
VITE_SUPABASE_ANON_KEY=[from Supabase dashboard]
SUPABASE_SERVICE_ROLE_KEY=[from Supabase dashboard — edge functions only]
ANTHROPIC_API_KEY=[from Anthropic console — edge functions only]
BREVO_API_KEY=[from Brevo dashboard — edge functions only]
VITE_APP_URL=https://join.cethos.com
VITE_VENDOR_URL=https://vendor.cethos.com
VITE_ADMIN_URL=https://portal.cethos.com
```

## For Detailed Prompt Templates

See `/docs/CVP-CLAUDE-CODE-INSTRUCTIONS.md` for task-specific prompt templates covering:
- Database migrations
- Edge functions
- Frontend pages/components
- Admin panel pages
- Cron jobs
- AI integration
