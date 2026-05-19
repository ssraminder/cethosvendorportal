# Preferences

How the user wants you to approach work in this project. Add any time the user corrects your approach OR confirms a non-obvious approach worked. Include the *why* so you can judge edge cases.

## Format
- **Rule** — short statement
  - **Why:** reason given (incident, principle, constraint)
  - **How to apply:** when/where this kicks in

## Code & implementation
_(Naming, structure, patterns, libraries to prefer or avoid)_

- **Before designing a new schema or major feature, query the live database first.** The repo's `supabase/migrations/` is not always in sync with prod — migrations can be applied via MCP `apply_migration` without being back-filled into the repo (e.g., the entire `qms` schema, 10 migrations dated 2026-04-28 to 2026-04-30, was in prod but not in repo until 2026-05-11).
  - **Why:** PR #65 on 2026-05-11 designed and merged a Phase 1 vendor-qualification schema from scratch without realizing Phase 1 had already shipped two weeks earlier in a more sophisticated form. The work had to be reverted.
  - **How to apply:** First step when picking up any non-trivial schema work — `list_tables` + `list_migrations` via Supabase MCP against the project, compare against `supabase/migrations/`, ask if there's drift.

- **When applying DDL via Supabase MCP `apply_migration`, always commit the same SQL body to `supabase/migrations/<version>_<name>.sql` as part of the same PR.** Migration history and repo files are dual sources that must agree.
  - **Why:** Silent drift between prod and repo causes future sessions to design against an outdated picture of reality. Cost: one fully wasted session and a revert PR on 2026-05-11.
  - **How to apply:** Either (a) use `supabase db push` (which writes both at once), or (b) if using MCP `apply_migration` directly, include the migration file in the commit.

- **Treat planning documents dated *today* with the same skepticism as code:** when a doc describes work as "to be built," verify by querying the running system, not by trusting the doc. Documents-folder briefings can be authored without awareness of recent shipping.

- **When an applicant reports "I submitted, but I'm still getting reminders" — go to TM-Cethos's `jobs` table first.** The TM-Cethos → vendor-portal callback (`cvp-record-tm-submission`) is unreliable: many vendor-portal `cvp_test_submissions` rows are stuck because the callback never fired even though TM-side has `status='submitted'`. The `external_ref` column on TM `jobs` (format: `test_submission:<vp_uuid>`) is the linkage. Query TM (project `idzwtssftpxrsprzjael`) cross-project via Supabase MCP, then reconcile via the deployed `cvp-reconcile-tm-stuck` function — don't trust the vendor-portal status in isolation.
  - **Why:** 2026-05-19 incident — 24 of 29 TM submissions never propagated to vendor-portal. The cron correctly skipped reminders for properly-submitted rows; the bug was upstream in the callback. See `decisions.md` entry for the same date.
  - **How to apply:** Diagnose first by counting `WHERE TM.status='submitted' AND VP.status NOT IN ('submitted','assessed')`. Then pause `cvp-check-test-followups-hourly` (jobid in `cron.job`), reconcile via `cvp-reconcile-tm-stuck`, expire any duplicate stale siblings, re-enable.

## Communication
_(Response length, format, when to ask vs. proceed, summary style)_

## Tooling & workflow
_(Git, deployments, testing, environment conventions)_

## Things to avoid
_(Patterns the user has explicitly rejected — don't relitigate)_
