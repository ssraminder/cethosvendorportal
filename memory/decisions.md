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

### 2026-05-05 — Vendor display of internal project numbers (incoming work)
- **Decision:** Vendors will see Cethos-generated `PRJ-YYYY-NNNNN` numbers grouping related tasks for the same client. The client-supplied `client_project_number` stays internal-only and never reaches vendor-facing surfaces.
- **Rationale:** Continuity context for recurring business work without exposing client-supplied identifiers.
- **Status:** schema + order-creation hooks deployed in the portal app (full decision logged in `cethos_app_figma_design_v1/memory/decisions.md`). Vendor portal display work pending — needs job detail to show `PRJ-YYYY-NNNNN`, prior tasks count, and project assets (glossary, style guide, vendor notes).
- **Affects:** vendor job detail view, messaging templates, file naming visible to vendors.
