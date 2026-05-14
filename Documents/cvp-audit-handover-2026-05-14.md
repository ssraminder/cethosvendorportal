# Handover: CVP security audit + functional E2E verification

You are starting fresh on the **CETHOS Vendor Portal (CVP)** repo. Your job is to produce one report that answers two questions:

1. **What's currently working vs. broken** across every vendor-portal user flow (recruitment + active vendor).
2. **Are there any RLS / auth / data-exposure vulnerabilities** in the same class as the one a researcher just reported against `cethos.com`.

You will not change code or config in this task. **Findings only.**

---

## Context this session won't have

- **Repos:**
  - This repo (`D:\cethos-vendor`) — Vite + React + TS monorepo with `apps/vendor` (vendor.cethos.com, the active-vendor portal) and `apps/recruitment` (join.cethos.com, the recruitment/onboarding flow), plus Supabase edge functions in `supabase/functions/cvp-*`. **In scope.**
  - `D:\cethos\main_web` — Next.js, deploys to cethos.com. **Out of scope — separate audit.**
  - `D:\cethos\cethosappfigma`-equivalent — portal.cethos.com (admin/customer portal). **Out of scope.**
- **Supabase project:** `lmzoyezvsjgsxveoakdr`. Hosts both `cvp_*` tables and shared CETHOS core tables (`quotes`, `orders`, `customers`, `quote_files`, etc.). Vendor portal must only touch `cvp_*` and `qms.*` directly; CETHOS core access is via edge functions.
- **Sentry:** org `cethos-solutions-inc`, project `cethos-vendor-portal` (vendor portal — instrumentation just shipped today, smoke-test issue `CETHOS-VENDOR-PORTAL-1` can be ignored). Project `cethos-main` is for cethos.com.
- **Netlify sites:**
  - `cethos-vendor` → vendor.cethos.com (site ID `9da179be-b32b-4168-afb1-ee89d806b1a7`)
  - `cethosvendorportal` → join.cethos.com (site ID `fb2de923-3f92-437c-953b-415c8f7e4370`)
- **Why now:** On 2026-05-14, `gimli-sonofgloin@protonmail.com` reported that cethos.com's Supabase had RLS misconfigured: the anon key could read `customers`, `orders`, `payments`, and `quote_files` (including ~2000 internal docs containing birth certificates and driver's licenses). The cethos.com side is being remediated separately. This audit verifies the same class of issue is not present in CVP.

## Mandatory reading before you start (5 min)

- `D:\cethos-vendor\CLAUDE.md` — project rules. Critical: `cvp_` table prefix, never query CETHOS core tables directly, edge functions prefixed `cvp-`, `payout_details` never logged, 48-hour test-token expiry, 48-hour rejection auto-send window, one counter-offer per applicant, nudge suppression, AI fallback to `staff_review`.
- `memory/decisions.md`, `memory/preferences.md`, `memory/people.md`, `memory/user.md` — project-local memory. The 2026-05-14 entry in decisions.md documents the Sentry env-var convention; the 2026-05-11 entry documents the `qms` schema (already in prod, not in repo migrations for a long time — be aware before touching schema).
- `docs/CVP-MASTER-PLAN.md`, `docs/CVP-DATABASE-SCHEMA.md`, `docs/CVP-PROGRESS-LOG.md` — system design + what's shipped.

## Tools you have

- **Supabase MCP** (project `lmzoyezvsjgsxveoakdr`) — `list_tables`, `execute_sql` (read-only), `list_edge_functions`, `get_advisors` (run both `security` and `performance`), `get_logs`, `list_migrations`.
- **Sentry MCP** (org `cethos-solutions-inc`) — `search_issues`, `search_events` for the `cethos-vendor-portal` project.
- **Netlify MCP** — read-only project + deploy info.
- **Grep / Read / Glob / Bash** — codebase exploration.
- **gh CLI** — repo `ssraminder/cethosvendorportal`.
- Direct Sentry ingest POST (with the public DSN extracted from the live bundle) is acceptable for smoke testing — precedent already set in earlier sessions (issue `CETHOS-VENDOR-PORTAL-1`).

---

## Part 1 — Security audit

For every check below: query, record the result, mark **PASS / FAIL / UNKNOWN**, attach evidence (table name, file path + line, or query output).

### A. RLS coverage

1. List every table in `public` (and `qms`) with its `rowsecurity` flag.
   `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname IN ('public','qms') ORDER BY 1,2;`
2. For each RLS-enabled table, list policies.
   `SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check FROM pg_policies;`
3. **For every `cvp_*` table:** does any policy permit the `anon` role to read or write? Document each. The acceptable pattern is: anon access only via a token predicate (e.g., `applicant_token`, `negotiate_token`, signed-cookie session).
4. **For every CETHOS core table the vendor portal might touch:** confirm `anon` has zero direct read access. (Vendors should only see core-table data via edge-function projections.)
5. **`payout_details` column:** find it, confirm policies explicitly deny anon SELECT.
6. **Functions / RPCs callable by anon:** `SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE has_function_privilege('anon', p.oid, 'EXECUTE') AND n.nspname IN ('public','qms');` — for each, read the function body and confirm it doesn't bypass RLS or leak data.

### B. Storage

1. List all storage buckets. For each: public flag, MIME restrictions, allowed-mime list.
2. For each bucket, list policies. Can anon read or write?
3. Vendor-uploaded artifacts (CV uploads, signed NDAs, certified-quote source files, evidence under `qms-evidence`): confirm signed-URL TTLs are short and that direct paths aren't enumerable.
4. Try a probe with `curl` from outside: pick a sample storage path and confirm it's not anonymously listable.

### C. API keys & secrets

1. Grep the repo for hardcoded keys: `grep -rn "sb_secret\|sb_publishable\|service_role\|eyJhbGciOi" --include='*.{ts,tsx,js,jsx,json,toml,env,md}'`. None should be in source.
2. Confirm `apps/vendor/.env.example` and `apps/recruitment/.env.example` only reference publishable keys for frontend use.
3. Confirm Supabase edge functions reading `SUPABASE_SERVICE_ROLE_KEY` (`Deno.env.get`) are not exporting / returning it in any response shape.
4. Confirm the rotated legacy anon/service_role keys (per the May 2026 rotation note in cethos.com's `.env.example`) aren't still active. Use Supabase MCP to check current API keys vs. what's referenced anywhere.

### D. Edge functions (`supabase/functions/cvp-*`)

1. `list_edge_functions` — enumerate every deployed function.
2. For each function:
   - Does it accept a token (header or body)? Does it validate that token before any privileged action?
   - If it uses `SUPABASE_SERVICE_ROLE_KEY`, is the request authorized to be making that call? Specifically: is there a path where an unauthenticated caller can reach a service-role query?
   - Does it ever log `payout_details`, raw OTP codes, or full request bodies? Grep for `console.log` / `console.error` and review each.
   - Is CORS restricted to known frontend origins, not `*`?
   - Are method-based gates correct (POST-only for mutations; no GET with sensitive query params)?

### E. Frontend / Netlify

1. Grep `apps/vendor/src` and `apps/recruitment/src` for `service_role`, `sb_secret`, fetch calls bypassing the configured Supabase client.
2. Confirm `apps/vendor/src/lib/sentry.ts` `beforeSend` strips PII (currently only filters `AbortError`). Recommend adding a scrubber for emails / tokens in URL params.
3. Read `netlify.toml` (root, `apps/vendor/`, `apps/recruitment/`) for security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`. Document what's present vs. missing.
4. Check Netlify function deploys: `accept-step`, `auth-check`, `auth-logout`, `auth-otp-send`, `auth-otp-verify`, `auth-session`, `decline-step`, `get-job-detail`, `get-jobs`, `get-nda-status`, `get-profile`, `jwks`, `list-doc-requests`, `lookup-tax-rate`, `manage-rates`, `nda-otp-send`, `nda-otp-verify`, `request-contractor-upgrade`, `sign-nda`, `sso-issue`, `update-availability`, `update-language-pairs`, `update-payment-info`, `update-profile`. For each, review source and check the same items as Supabase edge functions.

### F. Auth flows

1. OTP send/verify: rate-limited? Constant-time comparison on verify? Per-vendor lockout after N failures?
2. Vendor JWT issuance: signing algorithm matches `VENDOR_JWT_PUBLIC_JWK` (ES256, kid `vendor-2026-05-12`). Expiry length sane. Audience claim present.
3. Cookie attributes on the vendor session: `Secure`, `HttpOnly`, `SameSite=Lax` or stricter, no overbroad `Domain` value.
4. Token-based flows (test token, negotiate token, unsubscribe token): one-shot semantics enforced server-side; expiry checked in DB function not just app code.

### G. Supabase advisors

Run `get_advisors` with `type: "security"` and again with `type: "performance"`. Report **every** finding with severity.

### H. Activity logs (intrusion check)

1. **Supabase logs, last 90 days.** Look for anon SELECT queries against `cvp_*` tables, especially anything with `*` or no row predicate. Was anyone other than the application client hitting those?
2. **Sentry, last 90 days for `cethos-vendor-portal`.** Patterns suggesting probing: rapid 401/403 sequences from one IP, unusual user agents, attempts at admin paths.
3. **Netlify function logs.** Sample `auth-otp-verify` for brute-force patterns. Sample `get-profile` and `update-payment-info` for anomalous activity.

---

## Part 2 — Functional E2E verification

For every flow below: verify it works end-to-end. Where possible, query DB state with Supabase MCP to confirm side effects. Where flows require live UI, document what's verifiable from the CLI and flag what isn't.

### Recruitment (apps/recruitment → join.cethos.com)

- [ ] `/apply` submit creates `cvp_applicants` row, issues token, queues recruitment email V1 (Mailgun).
- [ ] Test token (48-hour expiry) loads the test page; expired token returns clean rejection.
- [ ] Test submission → AI scoring; if AI fails (timeout, parse error, API error) → status `staff_review` (per rule #9 in CLAUDE.md).
- [ ] Counter-offer flow: applicant can submit ONE counter; `negotiate_token` invalidated after first use.
- [ ] Reapplication: `can_reapply_after` enforced; submissions inside cooldown return the polite message.
- [ ] Reject flow: 48 hours from `rejection_email_queued_at` before auto-send; that column (not `created_at`) is what's checked.
- [ ] NDA flow: only gates agencies (per recent decision); individual vendors are CV-exempt — only NDA gates them. Confirm `cvp-sign-nda` and OTP-paired `nda-otp-send` / `nda-otp-verify`.
- [ ] Approval: when ≥1 `cvp_test_combinations` row is approved, vendor account is created.

### Active vendor (apps/vendor → vendor.cethos.com)

- [ ] Login: `auth-otp-send` → `auth-otp-verify` → vendor session cookie + JWT.
- [ ] `auth-session` refresh; `auth-check` returns current identity; `auth-logout` clears cookie + invalidates session.
- [ ] Profile read/update (`get-profile`, `update-profile`).
- [ ] Availability (`update-availability`).
- [ ] Language pairs (`update-language-pairs`).
- [ ] Rate management (`manage-rates`).
- [ ] Payment info (`update-payment-info`) — confirm response never echoes `payout_details` (per rule #10).
- [ ] Tax rate lookup (`lookup-tax-rate`).
- [ ] Job list (`get-jobs`) shows active offers and counter-offer status.
- [ ] Job detail (`vendor-get-job-detail` v30) returns `project` block with `PRJ-YYYY-NNNNN`, sibling task count, and vendor notes; reference files include `source: project_glossary` / `project_style_guide` badges.
- [ ] Accept / decline (`accept-step`, `decline-step`) — confirm state transitions and notification emails.
- [ ] Contractor upgrade request (`request-contractor-upgrade`).
- [ ] Doc requests (`list-doc-requests`, `cvp-request-documents`).
- [ ] Unsubscribe: `vendor.cethos.com/unsubscribe?token=<vendor_uuid>` works as one-click; the page captures the optional reason enum; `cvp_vendor_email_opt_outs` updated; future broadcasts check this table and mark queue rows `suppressed` on hit.
- [ ] Bug-report modal: console buffer (`installConsoleCapture`) is attached but not leaking secrets — confirm there's a scrubber.
- [ ] Sentry capture on a real error: throw a test error and confirm it reaches `cethos-vendor-portal` Sentry project.

### Cron / scheduled jobs

- [ ] Nudge sends: check `cvp_profile_nudges.suppressed_until` is respected; no nudge type repeats within 30 days.
- [ ] Auto-rejection 48h after `rejection_email_queued_at`.
- [ ] Token-expiry sweeps.

---

## Deliverable

A single markdown report. Suggested path: `D:\cethos-vendor\Documents\cvp-audit-report-2026-05-14.md`.

Structure:
1. **Executive summary** — one paragraph. State whether you found anything that would warrant a privacy-commissioner notification under PIPEDA.
2. **Status table** — every check above, marked PASS / FAIL / UNKNOWN / NOT-APPLICABLE, with one-line evidence per row.
3. **Findings ranked by severity** — Critical / High / Medium / Low. For each: what's wrong, where (file:line or table/policy name), how to reproduce, recommended remediation.
4. **Functional gaps** — flows that don't work end-to-end. Same evidence format.
5. **Suspicious-activity findings from logs** — if any.
6. **Things explicitly not verifiable from CLI** — list what would need a live browser session or a human-driven test.

---

## Rules of engagement

- **No mutations.** No `apply_migration`, no `deploy_edge_function`, no `env:set`, no `gh pr create`, no commits, no Netlify deploys, no `update-*` Sentry actions. Read-only SQL only. If a check requires a write, document it as a recommendation, don't execute.
- **No `payout_details` values in your output.** Confirm the column exists and is protected; do not echo any row's value, even from a test record.
- **Time-box: 90 minutes.** If a check is taking longer, mark it UNKNOWN with what you'd need to complete it and move on. Coverage beats depth here.
- **If you find a Critical issue** (live data leak via anon, exposed service-role key, etc.), stop the audit and report it immediately as the very first line of your output so the user can triage before you finish the rest.
