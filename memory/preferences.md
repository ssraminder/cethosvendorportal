# Preferences

How the user wants you to approach work in this project. Add any time the user corrects your approach OR confirms a non-obvious approach worked. Include the *why* so you can judge edge cases.

## Format
- **Rule** — short statement
  - **Why:** reason given (incident, principle, constraint)
  - **How to apply:** when/where this kicks in

## Code & implementation
_(Naming, structure, patterns, libraries to prefer or avoid)_

- **QMS tables live in the `qms` Postgres schema, not under `cvp_` prefix.**
  - **Why:** Decision 2026-05-11. ISO 17100 / 18587 / 18841 / NSGCIS conformance is a distinct domain from the CVP pipeline; dedicated schema gives clean RLS scoping for the auditor's time-bounded read role (June 29-30, 2026 pharma sponsor audit and Dec 2026 Orion Stage 2). CLAUDE.md's "all new tables MUST use cvp_ prefix" rule scopes to CVP work.
  - **How to apply:** New tables that record ISO clause conformance, evidence verification, NDAs, audit-log entries, or anything an external auditor would query as evidence go in `qms.*`. New tables that are part of the applicant / test / vendor-portal pipeline keep the `cvp_` prefix in `public`.

- **`qms.qualification_audit_log` is append-only at the database privilege level.**
  - **Why:** Briefing §7.7 — auditor-grade tamper resistance is non-negotiable. Application-level append-only is not enough.
  - **How to apply:** Never write a migration that grants UPDATE or DELETE on this table. The REVOKE in `20260511150000_qms_schema_foundation.sql` is the canonical state. Any new role added later must also be REVOKE'd from UPDATE/DELETE on this table.

- **QMS evidence files are served only through `qms-evidence-fetch`.**
  - **Why:** Bucket is private; the function checks `qms.staff_role_assignments` or vendor self-match before issuing a signed URL.
  - **How to apply:** Never grant direct storage RLS access to the `qms-evidence` bucket. New UIs/edge functions that need to surface evidence call `qms-evidence-fetch`.

## Communication
_(Response length, format, when to ask vs. proceed, summary style)_

## Tooling & workflow
_(Git, deployments, testing, environment conventions)_

## Things to avoid
_(Patterns the user has explicitly rejected — don't relitigate)_
