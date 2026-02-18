# CVP — Claude Code Instructions & Prompt Template

**Document:** `CVP-CLAUDE-CODE-INSTRUCTIONS.md`
**Version:** 1.0
**Date:** February 18, 2026

---

## How to Use This Document

This document is the **template** for every prompt sent to Claude Code when building the CVP system. Copy the relevant section, fill in the task-specific parts, and send to Claude Code.

Every single prompt MUST include the mandatory preamble below — no exceptions.

---

## MANDATORY PREAMBLE (include at the start of every prompt)

```
You are building the CETHOS Vendor Portal (CVP) — a standalone recruitment and 
vendor management system for freelance translators.

Before writing any code, you MUST:
1. Read /docs/CVP-MASTER-PLAN.md in full
2. Read /docs/CVP-DATABASE-SCHEMA.md before any database work
3. Read /docs/CVP-PROGRESS-LOG.md to understand what has already been built

Rules you must follow at all times:
- All new database tables MUST use the cvp_ prefix
- Never touch tables without cvp_ prefix — those belong to CETHOS portal
- Never query CETHOS core tables (quotes, orders, customers, etc.) directly
- All cross-system access goes through edge functions only
- All edge functions must be prefixed cvp-
- After completing your task, update /docs/CVP-PROGRESS-LOG.md with what was done
- If anything in the task conflicts with the plan documents, flag it before proceeding
- TypeScript strict mode throughout — no `any` types without comment explaining why
- All edge functions use Deno + Supabase service_role key
- Frontend uses Supabase anon key only

Tech stack:
- React + Vite + TypeScript
- Tailwind CSS
- React Hook Form + Zod (forms and validation)
- Supabase JS client
- Deployed on Netlify
- Supabase project: lmzoyezvsjgsxveoakdr
```

---

## Prompt Templates by Task Type

---

### TEMPLATE 1: Database Migration

```
[MANDATORY PREAMBLE]

TASK: Create database migration

Read CVP-DATABASE-SCHEMA.md. Create migration file(s) for the following tables:
- [list tables]

Requirements:
- File location: /supabase/migrations/{timestamp}_{description}.sql
- Follow the migration order specified in CVP-DATABASE-SCHEMA.md
- Include all indexes defined in the schema
- Include RLS policies from the schema
- Add a comment header with: table name, purpose, date, dependencies
- Test that the migration is idempotent where possible (use IF NOT EXISTS)

After writing the migration:
- Confirm which tables it creates
- List any dependencies on existing tables
- Update CVP-PROGRESS-LOG.md
```

---

### TEMPLATE 2: Edge Function

```
[MANDATORY PREAMBLE]

TASK: Build edge function — cvp-[function-name]

Read CVP-MASTER-PLAN.md section [section number] for the full specification of 
this function.

Requirements:
- File location: /supabase/functions/cvp-[function-name]/index.ts
- Use Deno runtime
- Use Supabase service_role key (from Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
- Include CORS headers (OPTIONS + actual request)
- Return consistent JSON: { success: bool, data?: any, error?: string }
- Log meaningful errors to console with context
- Never expose internal error details to the client response
- TypeScript strict — define types for all request/response shapes

This function should:
[paste relevant section from MASTER-PLAN]

The function interacts with these tables:
[list relevant cvp_ tables from DATABASE-SCHEMA]

Error cases to handle:
- [list expected error conditions]

After building:
- Write a brief test curl command showing how to invoke it
- Update CVP-PROGRESS-LOG.md
```

---

### TEMPLATE 3: Frontend Page / Component

```
[MANDATORY PREAMBLE]

TASK: Build [page/component name]

Read CVP-MASTER-PLAN.md section [section number] for the full specification.

Location: /apps/recruitment/src/[pages or components]/[ComponentName].tsx

This [page/component] is part of: [recruitment portal / vendor portal]
Route: [route if applicable]

Design requirements:
- Clean, professional appearance appropriate for a vendor/recruiter facing tool
- Tailwind CSS only — no additional CSS files
- Mobile responsive
- Form validation using React Hook Form + Zod
- Loading states for all async operations
- Error states with user-friendly messages
- Empty states where applicable

Functional requirements:
[paste relevant section from MASTER-PLAN]

It calls these edge functions:
- [list edge functions]

It reads/writes these data fields:
[list relevant fields from DATABASE-SCHEMA]

After building:
- List any edge functions that must exist before this component works
- Update CVP-PROGRESS-LOG.md
```

---

### TEMPLATE 4: Admin Panel Page

```
[MANDATORY PREAMBLE]

TASK: Build admin panel page — [page name]

Read CVP-MASTER-PLAN.md section 11 (Admin Panel) for the full specification.

This page is added to the EXISTING CETHOS admin panel at portal.cethos.com.
Location in CETHOS codebase: [path in CETHOS repo — to be confirmed]
Route: /admin/recruitment/[route]

Important: This page lives in the CETHOS portal repo, not cethos-vendor repo.
It uses the existing AdminLayout component and staff authentication.

Requirements:
[paste relevant section from MASTER-PLAN section 11]

Tables it reads:
[list cvp_ tables]

Edge functions it calls:
[list cvp- edge functions]

After building:
- Confirm it integrates with existing AdminLayout
- List navigation changes needed (adding to sidebar)
- Update CVP-PROGRESS-LOG.md
```

---

### TEMPLATE 5: Cron Job / Scheduled Function

```
[MANDATORY PREAMBLE]

TASK: Build cron edge function — cvp-[function-name]

Read CVP-MASTER-PLAN.md section 12 for the schedule and purpose.

Location: /supabase/functions/cvp-[function-name]/index.ts

Schedule: [every hour / every Monday 9am UTC / daily 8am UTC]
This function is triggered by Supabase cron (pg_cron) — NOT by HTTP request.

What it does:
[paste relevant section from MASTER-PLAN]

Processing rules:
- Must be idempotent — safe to run multiple times
- Process in batches of 50 to avoid timeout
- Log summary of actions taken (X processed, Y emails queued, Z flags set)
- Never send the same email twice (check tracking columns before sending)
- If a step fails, continue processing others and log the failure

Tables it reads/writes:
[list cvp_ tables]

After building:
- Write the pg_cron registration SQL
- Document any rate limit considerations (Brevo email sending limits)
- Update CVP-PROGRESS-LOG.md
```

---

### TEMPLATE 6: AI Integration (Claude API call within edge function)

```
[MANDATORY PREAMBLE]

TASK: Add Claude AI assessment to edge function cvp-[function-name]

Read CVP-MASTER-PLAN.md section [section] for the full assessment specification.

This function calls the Anthropic API to [assess test / pre-screen application / etc.]

Claude API config:
- Model: claude-sonnet-4-6
- API key from: Deno.env.get('ANTHROPIC_API_KEY')
- Max tokens: [specify based on output complexity]

The system prompt must:
[paste exact specification of what Claude should assess from MASTER-PLAN]

The expected output is structured JSON:
[paste JSON schema from MASTER-PLAN]

Requirements:
- Ask Claude to respond ONLY in valid JSON — no preamble, no markdown
- Parse and validate the JSON response before storing
- If Claude returns invalid JSON, retry once then fall back to manual_review status
- Store the full raw Claude response in the _result JSONB column
- Never expose raw Claude output to the applicant — it's internal only
- Map Claude's recommendation to the appropriate routing action per MASTER-PLAN

Error handling:
- API timeout → set status to staff_review, flag with reason "ai_timeout"
- Invalid JSON after retry → set status to staff_review, flag with reason "ai_parse_error"
- API error → set status to staff_review, flag with reason "ai_api_error"
- All errors: log full error context, notify via console

After building:
- Document the exact prompt used (include in code as a constant)
- Update CVP-PROGRESS-LOG.md
```

---

## Progress Log Template

Every session, Claude Code updates `/docs/CVP-PROGRESS-LOG.md` with this format:

```markdown
## Session — [Date]

### Completed
- [task] — [file(s) created/modified]
- [task] — [file(s) created/modified]

### Issues Encountered
- [issue] → [how resolved or still open]

### Next Steps
- [what needs to be done next]

### Files Changed
- [path] — [what changed]
```

---

## Environment Variables Required

Claude Code should reference these but never hardcode values:

```
# Supabase
VITE_SUPABASE_URL=https://lmzoyezvsjgsxveoakdr.supabase.co
VITE_SUPABASE_ANON_KEY=[from Supabase dashboard]
SUPABASE_SERVICE_ROLE_KEY=[from Supabase dashboard — edge functions only]

# Anthropic (edge functions only)
ANTHROPIC_API_KEY=[from Anthropic console]

# Brevo (edge functions only)
BREVO_API_KEY=[from Brevo dashboard]

# App URLs
VITE_APP_URL=https://join.cethos.com
VITE_VENDOR_URL=https://vendor.cethos.com
VITE_ADMIN_URL=https://portal.cethos.com
```

---

## Reference: Brevo Template IDs

When writing email-sending code, use these template IDs:

| Template | ID | Trigger |
|---|---|---|
| V1 Application Received | TBD | Form submit |
| V2 Pre-screen Passed | TBD | Score ≥70 |
| V3 Test Invitation | TBD | Tests sent |
| V4 Test Reminder 24hr | TBD | Day 2 cron |
| V5 Test Expired | TBD | Day 3 cron |
| V6 Final Chance Day 7 | TBD | Day 7 cron |
| V7 Test Received | TBD | Test submitted |
| V8 Under Review | TBD | Score 50–69 |
| V9 Negotiation Offer | TBD | Rate gap |
| V10 Rate Agreed | TBD | Negotiation resolved |
| V11 Approved Welcome | TBD | Approval |
| V12 Rejected | TBD | Post 48hr window |
| V13 Waitlisted | TBD | Waitlist action |
| V14 Profile Nudge | TBD | Weekly cron |
| V15 Cert Expiry | TBD | 60 days before |
| V16 Language Pairs Check | TBD | 6 months stale |
| V17 Request More Info | TBD | Staff action |

*TBD = create template in Brevo first, then update this table with the ID*

---

## Reference: Key Business Rules

Claude Code must enforce these rules in code, not just as comments:

1. **Table naming:** All new tables must start with `cvp_`
2. **API boundary:** CVP edge functions never query `quotes`, `orders`, `customers`, `ai_analysis_results`, `hitl_reviews`, `quote_files`, or any CETHOS table without `cvp_` prefix
3. **Test tokens:** 48-hour expiry from creation. One submission per token. No login required.
4. **Rejection window:** 48 hours from `rejection_email_queued_at` before auto-send. Check this column, not created_at.
5. **Approval granularity:** Each `cvp_test_combinations` row is approved independently. Vendor account created when ≥1 combination approved.
6. **Negotiation limit:** Applicant can submit ONE counter-offer. `negotiate_token` becomes invalid after first use.
7. **Reapplication cooldown:** Check `can_reapply_after` on new submissions. Reject with polite message if within cooldown.
8. **Nudge suppression:** Check `cvp_profile_nudges.suppressed_until` before sending any nudge email. Never send the same nudge type within 30 days.
9. **AI fallback:** If any AI call fails (timeout, parse error, API error), fall back to `staff_review` status — never block the pipeline.
10. **Payout details:** Never log `payout_details` column in any console output or error message.

---

*End of CVP-CLAUDE-CODE-INSTRUCTIONS.md*
