# Vendor Management — Training Curriculum

Audience: **Vendor Managers** (staff with role `admin`, `super_admin`, `senior_reviewer`, or `reviewer`).

Goal: a vendor manager who completes this training can run the entire applicant-to-active-vendor pipeline end-to-end without assistance.

Screenshot assets live at `client/public/training/vendor-management/<NN>-<slug>.png` in the portal repo.

Lessons 1–11 below map one-to-one to seed rows in `cvp_training_lessons` (seed migration: `011_seed_vendor_management_training.sql`).

---

## Lesson 1 — Orientation: the Vendor Management pipeline

**Features covered:** high-level map.
**Route:** none (overview page).
**Screenshot:** `01-orientation.png` — annotated pipeline diagram (applicant → prescreen → test → assess → negotiate → approve → active vendor).

**What it does:** introduces the 3 stages a vendor manager touches daily — **Recruitment**, **Vendor Directory**, **Messaging/Tasks** — and the business rules binding them (48-hour rejection window, reapplication cooldown, nudge suppression, AI fallback).

**Who uses it:** every vendor manager.

**Key rules:**
- Never query CETHOS core tables (quotes/orders/customers) directly from vendor management flows.
- AI decisions are drafts; staff always has override authority inside the 48-hour window.

---

## Lesson 2 — Recruitment queue (`/admin/recruitment`)

**Features covered:** #1 queue, #2 filters & search.
**Files:** `client/pages/admin/RecruitmentList.tsx`.
**Screenshot:** `02-recruitment-queue.png`.

**What it does:** 4-tab queue — **Needs Attention**, **In Progress**, **Decided**, **Waitlist**. Columns: Name, Role, Language pairs, Pre-screen score, AI recommendation, Status, Days since last activity, Action.

**Try it yourself:** `/admin/recruitment`.

**Key rules:**
- **Needs Attention** surfaces (a) AI-flagged borderline scores (65–79), (b) interceptable rejections inside the 48-hour window, (c) out-of-band counter-offers awaiting staff decision.
- Search matches name, email, or application number (e.g. `APP-26-0047`).

**Smoke test:** Load page → verify 4 tabs render, search bar present, per-tab counts visible.

---

## Lesson 3 — Application detail: Applicant panel & AI pre-screen

**Features covered:** #3 applicant info, #4 AI pre-screen, #10 tier override.
**Files:** `client/pages/admin/RecruitmentDetail.tsx`.
**Screenshot:** `03-application-detail-left.png`, `03-application-detail-prescreen.png`.

**What it does:** 3-panel detail page. Left: identity, education, certifications, experience, CAT tools, work samples (inline viewer), rate expectation, AI-assigned tier (with override dropdown — translator role only). Centre (when stage=prescreen): AI score breakdown, red flags, routing decision, override button.

**Try it yourself:** `/admin/recruitment/:id` (click any row in the queue).

**Key rules:**
- **Tier override is translator-only.** Dropdown is hidden for cognitive-debriefing, interpreter, transcriber, clinician-reviewer roles.
- Override writes `tier_override_by` and `tier_override_at` — audit is permanent.
- If the AI call failed, you'll see a yellow "AI fallback — staff review" banner. Don't block the pipeline; make a manual decision.

**Smoke test:** Open one application with status `prescreened` → confirm left panel populates, AI score breakdown renders, red flags list appears.

---

## Lesson 4 — Test stage: sending tests & monitoring tokens

**Features covered:** #5 test stage cards.
**Screenshot:** `04-test-stage-cards.png`.

**What it does:** per-combination status cards. Each card shows `cvp_test_combinations` row with: source → target → domain → service, test token status (not sent / sent / in progress / submitted / assessed), expiry countdown, and a **Send test now** button when missing.

**Try it yourself:** `/admin/recruitment/:id` where status is `test_pending` or `test_sent`.

**Key rules:**
- **Token expiry is 48 hours from issuance** (`cvp_test_submissions.token_expires_at`). Expired tokens cannot be reused — issue a new one.
- **One submission per token.** Re-sends create a new `cvp_test_submissions` row; the old one stays for audit.
- Reminder emails fire automatically at day 2, day 3, day 7 via `cvp-check-test-followups` cron (top of every hour).

**Smoke test:** Find an application with 2+ combinations → confirm card per combination, countdown timer matches `token_expires_at`.

---

## Lesson 5 — Assessment viewer & MQM scoring

**Features covered:** #6 assessment viewer.
**Screenshot:** `05-assessment-viewer.png`.

**What it does:** 3-column viewer (source | applicant submission | reference translation) for translation tests, plus MQM error table (accuracy, fluency, style, terminology, locale). Per-dimension scores, AI-identified strengths, AI-identified errors.

**Try it yourself:** `/admin/recruitment/:id` where a test has been assessed.

**Key rules:**
- AI scores ≥80 auto-route to `approved` (pending staff acknowledgement). Scores 65–79 route to `staff_review`. <65 route to `rejection_queued`.
- Staff can adjust dimension scores manually; the saved score overrides the AI value but AI score is retained for audit.

**Smoke test:** Open a test-assessed application → confirm 3-column layout, MQM table with 5 dimensions, AI summary visible.

---

## Lesson 6 — Negotiation flow

**Features covered:** #7 negotiation timeline.
**Screenshot:** `06-negotiation-timeline.png`.

**What it does:** timeline of rate offer → applicant counter → staff response. Reads from `cvp_applications.negotiation_log` (JSONB). Shows each turn with timestamp and actor.

**Try it yourself:** `/admin/recruitment/:id` where status is `negotiation`.

**Key rules:**
- **Applicant may submit exactly ONE counter-offer.** The `negotiate_token` becomes invalid after first use.
- Out-of-band counter-offers (>15% above the initial offer) surface under **Needs Attention** for staff decision.
- `final_agreed_rate` column is the authoritative rate that gets written to `cvp_translators.approved_combinations` on approval.

**Smoke test:** Find application in negotiation → confirm timeline renders in chronological order, rate values visible.

---

## Lesson 7 — Staff decisions: Approve / Reject / Waitlist / Request Info

**Features covered:** #8 staff actions, #9 rejection editor, #11 reapplication cooldown, #12 waitlist bulk invite.
**Screenshot:** `07-staff-actions.png`, `07-rejection-editor.png`, `07-waitlist.png`.

**What it does:** right-panel action buttons. **Approve** runs `cvp-approve-application` edge function (creates `cvp_translators` row, fires invite email). **Reject** queues an AI-drafted email. **Waitlist** sets `waitlist_language_pair`. **Request More Info** runs `cvp-request-info`.

**Try it yourself:** `/admin/recruitment/:id` action panel; `/admin/recruitment` → Waitlist tab for bulk invite.

**Key rules:**
- **The 48-hour intercept window starts at `rejection_email_queued_at`, NOT at `created_at`.** Before it expires you can edit the draft or cancel. `cvp-send-queued-rejections` cron auto-sends hourly at :07.
- **Reapplication cooldown** — set via `can_reapply_after` (DATE). New submissions from the same email inside the cooldown are auto-rejected with a polite message.
- **Approval is per-combination.** Each `cvp_test_combinations` row is approved independently. Vendor account is created once ≥1 combination is approved.
- **Waitlist invites are grouped by language pair** — send en→fr invites in one batch to everyone waiting on that pair.

**Smoke test:** Open a rejected application → confirm rejection editor shows remaining countdown, Cancel Send button present.

---

## Lesson 8 — Vendor Directory (`/admin/vendors`)

**Features covered:** #13 vendor list, #14 create vendor, #21 status flags.
**Files:** `client/pages/admin/AdminVendorsList.tsx`, `AdminVendorNew.tsx`.
**Screenshot:** `08-vendor-list.png`, `08-vendor-new.png`.

**What it does:** searchable, paginated list (25/page). Columns: Name, email, phone, status (active / inactive / pending_review / suspended / applicant), vendor_type, language pairs, rating, total projects, last project date. Flags: 🔴 payout missing, 🟡 profile <80%, 🟠 cert expiring, ⚪ inactive 90+ days. **+ New Vendor** button opens `/admin/vendors/new`.

**Try it yourself:** `/admin/vendors`.

**Key rules:**
- **Never log `payout_details` column** anywhere (console, errors, UI). It is treated as PII.
- Creating a vendor manually (vs. from approved application) is rare; prefer the applicant pipeline.

**Smoke test:** Load page → verify search filters rows, status dropdown filters, pagination works.

---

## Lesson 9 — Vendor Detail tabs

**Features covered:** #15–#20 six tabs.
**Files:** `client/pages/admin/AdminVendorDetail.tsx`, `client/pages/admin/vendor-detail/*Tab.tsx`.
**Screenshot:** one per tab — `09-profile.png`, `09-languages.png`, `09-rates.png`, `09-payment.png`, `09-auth.png`, `09-jobs.png`.

**What it does:**
- **Profile:** name, email, phone, country/city, status, notes.
- **Languages:** source/target pairs + proficiency.
- **Rates:** per-pair / per-service pricing.
- **Payment:** bank/payout info, invoice history.
- **Auth:** invitation sent at, last reminder sent, reminder count, acceptance timestamp.
- **Jobs:** history of assigned jobs with status.

**Try it yourself:** click any vendor row → tabs across top.

**Key rules:**
- **Payout details never appear in logs or error messages.** If a flow fails, redact.
- **Auth tab** is where you resend an invite. Don't resend more than once per 24h — check `last_reminder_sent_at` first.

**Smoke test:** Open vendor detail → click each of 6 tabs → confirm each renders without errors.

---

## Lesson 10 — Messaging, Tasks & Profile Nudges

**Features covered:** #22 messaging, #23 tasks, plus `cvp_profile_nudges` awareness.
**Files:** `client/pages/admin/AdminMessages.tsx`, `StaffTasks.tsx`.
**Screenshot:** `10-messages.png`, `10-tasks.png`.

**What it does:**
- **Messages:** inbound/outbound vendor messages, unread badge in sidebar.
- **Tasks:** unassigned-step queue — work items that need a staff member to pick up.
- **Nudges (read-only visibility):** `cvp_profile_nudges` tracks auto-nudges sent to vendors (payout_missing, profile_incomplete, certification_expiry, languages_stale, inactive_internal). Vendor managers escalate resolution manually when a nudge repeats.

**Try it yourself:** `/admin/messages`, `/admin/tasks`.

**Key rules:**
- **Nudge suppression:** never send the same nudge type to the same vendor within 30 days (`cvp_profile_nudges.suppressed_until`). The cron enforces this automatically — manual nudges from vendor managers must also check.
- **Tasks belong to one staff member at a time.** Don't double-claim.

**Smoke test:** Load /admin/messages → confirm inbox renders; load /admin/tasks → confirm task list.

---

## Lesson 11 — Business rules cheat sheet & handoff

**Features covered:** recap + role boundary (#24 staff roles).
**Screenshot:** `11-cheat-sheet.png` — printable one-pager.

**What it does:** consolidates every business rule the vendor manager must know. Ends with a "who does what" by role:
- `super_admin` — full access incl. role changes, tier overrides beyond guidance.
- `admin` — full recruitment + vendor flows, can assign trainings.
- `senior_reviewer` — recruitment decisions, tier overrides, approvals.
- `reviewer` — recruitment review up to staff_review hand-off; cannot approve alone.
- `accountant` — read-only on vendor payout + invoices, no recruitment.

**Key rules — all in one place:**

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | All new tables use `cvp_` prefix | convention |
| 2 | Never query CETHOS core tables directly | code review |
| 3 | Test token expiry = 48h from creation | `cvp_test_submissions.token_expires_at` |
| 4 | One submission per token | `UNIQUE (token)` + single-use check |
| 5 | Rejection window = 48h from `rejection_email_queued_at` | `cvp-send-queued-rejections` cron |
| 6 | Approval is per-combination | vendor created when ≥1 approved |
| 7 | One counter-offer per applicant | `negotiate_token` invalidated on use |
| 8 | Reapplication cooldown | `can_reapply_after` check on submission |
| 9 | Nudge suppression 30d per type | `suppressed_until` check |
| 10 | AI failure → `staff_review` | never block pipeline |
| 11 | Never log `payout_details` | redact everywhere |

---

## Smoke-test log (filled during Phase 2)

| Lesson | Route | Status | Screenshot | Notes |
|--------|-------|--------|------------|-------|
| 1 | n/a | pending | 01-orientation.png | overview diagram, no live route |
| 2 | /admin/recruitment | pending | 02-recruitment-queue.png |  |
| 3 | /admin/recruitment/:id | pending | 03-application-detail-*.png |  |
| 4 | /admin/recruitment/:id | pending | 04-test-stage-cards.png |  |
| 5 | /admin/recruitment/:id | pending | 05-assessment-viewer.png |  |
| 6 | /admin/recruitment/:id | pending | 06-negotiation-timeline.png |  |
| 7 | /admin/recruitment/:id | pending | 07-*.png |  |
| 8 | /admin/vendors | pending | 08-*.png |  |
| 9 | /admin/vendors/:id | pending | 09-*.png |  |
| 10 | /admin/messages, /admin/tasks | pending | 10-*.png |  |
| 11 | n/a | pending | 11-cheat-sheet.png | printable |
