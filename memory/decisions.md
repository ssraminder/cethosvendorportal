# Decisions

Architectural, product, and business decisions made in this project — with rationale, so future sessions don't relitigate settled questions.

## Format
Append new entries at the top (newest first). For each:

```
### YYYY-MM-DD — Short decision title
- **Decision:** what was chosen
- **Rationale:** why
- **Alternatives considered:** what was rejected and why
- **Status:** active | superseded by [date] | reverted
- **Affects:** which parts of the codebase or product this touches
```

If a decision is later reversed or refined, mark the old one **superseded** rather than deleting — the history matters.

## Decisions

### 2026-05-05 — Project glossary + style guide labelled in Reference Materials
- **Decision:** When `vendor-get-job-detail` returns reference files tagged with `source: "project_glossary"` or `source: "project_style_guide"` (Phase 5 in the portal app), the vendor `JobDetailModal` shows a small green source badge ("Project glossary" / "Project style guide") above the file row so the vendor can spot project-level assets vs per-quote references at a glance.
- **Status:** active — wired alongside `vendor-get-job-detail` v30.
- **Affects:** `apps/vendor/src/components/jobs/JobDetailModal.tsx` reference files section.

### 2026-05-05 — Vendor job detail surfaces internal project number
- **Decision:** Vendors see `PRJ-YYYY-NNNNN`, prior task count for the same project, and project-level vendor notes on the job detail. The client-supplied `client_project_number` stays internal-only and never reaches vendor-facing surfaces.
- **Rationale:** Continuity context for recurring business work without exposing client-supplied identifiers.
- **Implementation:** `vendor-get-job-detail` edge function (v29) fetches `internal_projects.project_number` + `vendor_notes` and counts sibling orders when the underlying order has `internal_project_id`. Returned as a top-level `project` field on the response. JobDetailModal renders a teal banner section between Order Info and Language & Rate.
- **Status:** active — deployed to `lmzoyezvsjgsxveoakdr` 2026-05-05.
- **Pending:** glossary / style guide file surfacing once portal-side asset upload exists. (Customer-name anonymization is explicitly not pursued — confirmed 2026-05-05; see `cethos_app_figma_design_v1/memory/decisions.md`.)
- **Affects:** `vendor-get-job-detail` edge function, `apps/vendor/src/api/vendorJobs.ts`, `apps/vendor/src/components/jobs/JobDetailModal.tsx`.
