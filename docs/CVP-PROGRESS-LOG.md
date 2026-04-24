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

## Session — April 24, 2026 (T0: test-per-domain rework + Life Sciences seeds)

Rework of how translator tests are assigned. Shifts the unit of work from (lang_pair × service_type) to (lang_pair × domain). Fixes a latent bug where `cvp-submit-application` stamped every combination with `domainsOffered[0]` regardless of the actual domain mix. Adds a mandatory General baseline test for every translator. Certified translation becomes a skip-test flow. Seeds real Life Sciences content with AI-drafted reference translations.

### Migrations applied (on `lmzoyezvsjgsxveoakdr`)
- `20260424200000_cvp_test_combinations_domain_unit.sql` — backfill-collapses duplicate combinations into one per (app × pair × domain) using a status-rank ROW_NUMBER, NULLs out `service_type` on survivors, flips `certified_official` combos to `status='skip_manual_review'`, swaps the 5-col UNIQUE for a 4-col UNIQUE, adds `is_baseline_general` + the `skip_manual_review` status value.
- `20260424200100_cvp_translator_domains.sql` — new durable per (translator × pair × domain) approval table with `status`, `approval_source`, `cooldown_until`, RLS service_role-only, updated_at trigger, 3 indexes.
- `20260424200200_cvp_life_sciences_seeds.sql` — 6 library rows (3 difficulties × 2 forward pairs: EN→FR, EN→FA), real English source texts (Patient Info Leaflet / Informed Consent Form / Study Protocol eligibility), domain-weighted MQM rubrics, also adds `cvp_test_library.ai_generation_error` column.

### Edge functions deployed
- `cvp-seed-library-refs` (new) — reads rows WHERE `reference_translation IS NULL AND is_active=false`, calls Opus (MODEL_QUALITY) to produce domain-appropriate references, writes them back + flips `is_active=true`. Idempotent, per-row. On failure writes `ai_generation_error` and leaves inactive (AI-fallback rule).
- `cvp-send-tests` — tiny patch: if `combo.service_type IS NULL` (new domain-unit combos), skip the service_type filter when querying the library; otherwise keep the strict match for any residual legacy rows.
- `cvp-submit-application` — rewrote combination generation (lines 235–270). Drops the per-service-type loop. Emits one row per (language_pair × domain) for every applicant-selected domain, plus a forced General row per pair. Certified rows land with `status='skip_manual_review'`.

### Seeds generated
- All 6 Life Sciences rows populated with Opus-drafted reference translations (FR + FA). Title prefix `[AI-DRAFT]` stays until staff remove it post-QA. Active and available to `cvp-send-tests`.

### Smoke-test dummy refreshed
- `scripts/smoke-seed-dummy-application.sql` rewritten for the new shape. APP-26-9900 now has 4 combinations: immigration (pending, matches existing library seed), life_sciences (pending, matches new seed), general (pending baseline), certified_official (skip_manual_review).

### Verification
- Duplicate check: `SELECT ... GROUP BY (app, pair, domain) HAVING COUNT(*)>1` → 0 rows.
- Certified status check: 0 rows remain in pending/sent/etc.
- `service_type IS NOT NULL` count: 0 rows.
- `cvp_translator_domains` table exists.
- 6 Life Sciences library rows all `is_active=true` with reference_translation set.

### Deferred (future phases)
- T1 (next session): `cvp-approve-application` writes to `cvp_translator_domains`; new `VendorDomainsTab.tsx`; admin UI certified-skip card.
- T2: Medical + General + Legal + Immigration seeds via the same pipeline; reverse-direction pairs (FR→EN, FA→EN) via an extended seed-refs that also synthesises source_text.
- T3: Vendor self-service Request Test page + `cvp-request-test` edge function.
- Dropping `cvp_translators.approved_combinations` jsonb — kept writing for backward compat; deprecation tracked for after `vendor-get-profile` migrates.

---

## Session — April 23, 2026 (Phase C.2: staff reply compose + sidebar badge + digest inbound stats)

### Backend
- `_shared/mailgun.ts`: added `inReplyTo` + `references` options so outbound staff replies thread with the applicant's reply in their mail client. Angle brackets normalised defensively.
- **NEW** `cvp-staff-reply` edge function: staff reply to an inbound email with proper threading headers. Two-step flow — `dryRun:true` returns AI draft (Opus via `MODEL_QUALITY`) + rendered HTML preview; real send posts via Mailgun, writes to `cvp_outbound_messages` (threaded back to original outbound when known), stamps `cvp_inbound_emails.acknowledged_at/by`. Accepts `useAIDraft`, `aiInstructions`, `editedSubject`, `editedBody`.
- `cvp-daily-recruitment-status`: new "📨 inbound" line in the Needs-attention section — replies in last 24h, unacknowledged count, how many are threaded to an application — plus a by-intent breakdown table. Unacked count also surfaces in the email subject.

### Admin UI (portal repo)
- `RecruitmentDetail.tsx`: added Reply button to every inbound conversation row (emerald, Mail icon). Opens the new `StaffReplyModal` — textarea for staff guidance to the AI, "Draft with AI (Opus)" button, editable subject + body, HTML preview iframe, Send. Reuses the existing `callEdgeFunction` + `session.staffId` pattern.
- `AdminLayout.tsx`: unacknowledged-inbound-count badge on the Recruitment sidebar item (amber). Poll every 60s + refresh on route change so staff see new replies without a full reload.
- **NEW** `cvp-get-application-summary` edge function (utility): returns application row + latest prescreen + flag feedback + decision history in a single call for future audit UI. Not yet consumed by the UI.

### Status
Phase C.2 complete end-to-end; Phase E (references system) is next.

---

## Session — April 22, 2026 (Go-Live push: form restructure + approval/rejection plumbing)

### Form / applicant-facing work
- Restyled recruitment app to match the main CETHOS website: Plus Jakarta Sans, cethos-navy/cethos-teal tokens, remote-hosted SVG logo, #F8FAFC canvas
- Replaced hardcoded `SERVICE_OPTIONS` with a live fetch from the portal's `services` table (48 vendor-facing services minus Rush/Urgent Handling)
- Rates moved from a vague applicant-wide field to per-language-pair × service capture with unit pickers constrained to each service's `default_calculation_units`; translation rates are required, everything else optional
- Applicant-wide Domains multi-select (22 options) via a searchable dropdown — replaces per-pair pills
- Applicant-wide Currency selector (14 currencies) drives all rate inputs
- Removed the dedicated "Rate expectation" section (translator and cog paths) — vague rates are unprofessional in this industry
- Removed the Work Samples upload section; Resume / CV remains and now actually uploads to the new `cvp-applicant-cvs` Supabase Storage bucket; path persisted as `cvp_applications.cv_storage_path`
- Cog debriefing "Native language" single-select → `RankedMultiSelect` (searchable, max 3, ranked 1st/2nd/3rd with up/down reorder). Persists to new `cog_native_languages UUID[]` column
- "Additional fluent languages" pills → existing `MultiSelect` dropdown with search
- Source/Target language pickers → `SearchableSelect` for smooth filtering across 130+ languages
- Mobile fix on Certifications row (stacks vertically, full-width inputs, floating remove button)
- Rate-required error no longer fires eagerly — only after field blur or form submit attempt
- Brevo templates V1–V17 uploaded (template IDs 21–37 wired into `_shared/brevo.ts`); Mustache `{{#var}}` sections rewritten to Brevo-compatible output; all 17 templates active
- New Privacy Policy page at `/privacy` with PIPEDA/GDPR/CCPA sections + sub-processor list; consent checkbox now links to it

### Backend work
- Migration: `cvp_applications.domains_offered TEXT[]`, `rate_currency TEXT`, `rate_card JSONB`, `cog_native_languages UUID[]`, `cv_storage_path TEXT`
- Migration: extended domain CHECK constraint to 22 values on both `cvp_test_combinations` and `cvp_test_library`; dropped `service_type` CHECK (codes now owned by the `services` table)
- Renamed `services.mtpe` label to "Neural Translation Post-Editing" (code `mtpe` unchanged)
- Added "Certified Translation" to the services-offered flow
- `cvp-submit-application` (v20): accepts new payload shape, generates test combinations per (pair × service), seeds with applicant's primary domain, persists CV path, sends V1
- `cvp-approve-application` (v1): creates `vendors` + `cvp_translators`, issues `vendor_auth.password_setup_token` with 72hr expiry, sends V11
- `cvp-send-queued-rejections` (v1): sweeps queued rejections past 48hr window, sends V12 — wired to pg_cron (hourly @:07)
- `cvp-request-info` (v1): stores request details, sends V17
- `cvp-check-test-followups`: now triggered by pg_cron hourly (@:17)
- Supabase Storage bucket `cvp-applicant-cvs` (private, 10MB, PDF/DOC/DOCX) with anon-insert + service-role-read policies
- `vendor_auth` schema: `password_hash` + `password_set_at` nullable; added `password_setup_token UUID UNIQUE`, `password_setup_expires_at TIMESTAMPTZ`
- Seeded 2 placeholder tests in `cvp_test_library` (is_active=false) for FA→EN Immigration and EN→ES Medical

### Admin-side (portal repo: cethos_app_figma_design_v1)
- `RecruitmentDetail.tsx` staff decision handler rewritten:
  - Approve → POST `cvp-approve-application` (creates vendor, sends V11)
  - Reject → queue rejection, cron delivers V12
  - Info Requested → prompt for details, POST `cvp-request-info` (sends V17)
  - Waitlist → status update

### Files Created
- `apps/recruitment/src/components/MultiSelect.tsx`
- `apps/recruitment/src/components/SearchableSelect.tsx`
- `apps/recruitment/src/components/RankedMultiSelect.tsx`
- `apps/recruitment/src/hooks/useServices.ts`
- `apps/recruitment/src/lib/domains.ts`
- `apps/recruitment/src/lib/currencies.ts`
- `apps/recruitment/src/pages/PrivacyPolicy.tsx`
- `supabase/email-templates/*.html` + `*.txt` (17 templates + manifest)
- `supabase/functions/cvp-approve-application/index.ts`
- `supabase/functions/cvp-send-queued-rejections/index.ts`
- `supabase/functions/cvp-request-info/index.ts`
- `scripts/bootstrap-brevo-templates.mjs`, `scripts/fix-brevo-mustache.mjs`, `scripts/upload-brevo-templates.sh`
- `docs/CVP-EMAIL-TEMPLATES-DESIGN-PROMPT.md`
- `docs/CVP-GO-LIVE-CHECKLIST.md`
- `.gitignore`

### Deferred to next session
- 5-role expansion (Interpreter, Transcriber, Clinician Reviewer forms + schemas + CHECK constraint extension)
- Twilio SMS swap (vendor portal login only)
- Per-combination approval UI
- Negotiate (V9/V10) staff UI
- Vendor portal `setup-password` page (currently V11 link goes nowhere)

---

## Session — March 24, 2026 (Login SMS switched to ClickSend)

### Completed
- Switched login OTP SMS channel from Brevo to ClickSend in `vendor-auth-otp-send` edge function
- Brevo API key check now scoped to email channel only (no longer blocks SMS requests)
- ClickSend credentials (`CLICKSEND_USERNAME`, `CLICKSEND_API_KEY`) used for SMS, matching `vendor-verify-phone` implementation
- Deployed updated `vendor-auth-otp-send` edge function (v10)

### Files Modified
- `supabase/functions/vendor-auth-otp-send/index.ts` — replaced Brevo transactional SMS with ClickSend REST API

**Note (2026-04-22):** ClickSend has since been superseded — Twilio is now the canonical SMS provider for CVP. See entry further up.

---

## Session — March 25, 2026 (Auto-Accept Tab Switch + T&C service_id Fix)

### Completed
- **Fix 1 — Auto-Accept Tab Switch (V4):** NegotiateModal now passes `autoAssigned` flag through `onSuccess` callback. JobBoard's `handleActionSuccess` detects it and calls `setTab("active")` + `fetchTab("active")` so vendor sees their new assignment immediately. Also threaded through JobDetailModal's `onAction` prop.
- **Fix 2 — T&C service_id (V5):** `checkTermsForOffer()` now accepts and forwards `service_id` to the `get_terms` request. TermsModal accepts `serviceId` prop and includes it in the `accept_terms` request. Both JobBoard and JobDetailModal pass `step.service_id` through the terms flow.

### Files Changed
- `apps/vendor/src/components/jobs/NegotiateModal.tsx` — `onSuccess` callback now includes optional `autoAssigned` boolean
- `apps/vendor/src/components/jobs/JobBoard.tsx` — `handleActionSuccess` supports `switchToActive`, termsModal state includes `serviceId`, passes `service_id` to `checkTermsForOffer` and TermsModal
- `apps/vendor/src/components/jobs/JobDetailModal.tsx` — `onAction` prop updated to pass message+switchToActive, termsModal state includes `serviceId`, passes `service_id` through terms flow
- `apps/vendor/src/components/jobs/TermsModal.tsx` — `checkTermsForOffer` accepts `serviceId` param, TermsModal accepts `serviceId` prop, both `get_terms` and `accept_terms` include `service_id`
- `docs/CVP-PROGRESS-LOG.md` — This entry

---

## Session — March 25, 2026 (Vendor Portal Pending Features Audit)

### Completed
- **Investigative audit** of 5 vendor portal features (V1–V5): Negotiate button + modal, conditional negotiate + auto-accept, modal fix (units/picker), auto-assign response handling, T&C gate modal.
- **V1 Negotiate Button + Modal:** ✅ Fully implemented — button on cards + detail modal, NegotiateModal with counter rate/total/deadline/note, calls vendor-counter-offer API.
- **V2 Conditional + Auto-Accept:** ✅ Fully implemented — button gated by negotiation_allowed, disabled when counter_status=proposed, distinct messages for auto-accept vs queued.
- **V3 Modal Fix (units/picker):** ✅ Fully implemented — original offer summary box, rate unit inherited, date+time picker with 30-min increments, deadline pre-filled.
- **V4 Auto-Assign Handling:** ⚠️ Partial — toast + refetch work, but tab does NOT auto-switch to "active" after auto-accept. Vendor must manually navigate.
- **V5 T&C Gate Modal:** ⚠️ Partial — gates both Accept and Negotiate flows, distinguishes immediate/conditional, but service_id not passed in get_terms call. Both vendor-counter-offer and vendor-accept-terms edge functions not yet deployed.

### Gaps Identified
- V4: `handleActionSuccess` in JobBoard.tsx needs to detect auto-accept and call `setTab("active")` (small fix)
- V5: `checkTermsForOffer` in TermsModal.tsx needs `service_id` parameter (small fix)
- V5: `vendor-accept-terms` edge function needs to be built (medium complexity)
- V5: `vendor-counter-offer` edge function needs to be built (medium complexity)

### Files Reviewed (no code changes)
- `apps/vendor/src/components/jobs/JobBoard.tsx`
- `apps/vendor/src/components/jobs/JobDetailModal.tsx`
- `apps/vendor/src/components/jobs/NegotiateModal.tsx`
- `apps/vendor/src/components/jobs/TermsModal.tsx`
- `apps/vendor/src/components/jobs/JobActionModals.tsx`
- `apps/vendor/src/api/vendorJobs.ts`
- `docs/CVP-PROGRESS-LOG.md` — This entry

---

## Session — March 25, 2026 (Terms & Conditions Gate)

### Completed
- **TermsModal component:** Created `TermsModal.tsx` with scrollable T&C content, version display, action-specific checkbox text (immediate for Accept, conditional for Negotiate), conditional notice banner, and `accept_terms` API call.
- **checkTermsForOffer helper:** Exported helper that calls `vendor-accept-terms` with `get_terms` action; returns early (no modal) if no terms configured or already accepted for this offer+version.
- **JobBoard integration:** Accept and Negotiate buttons on job cards now call `checkTermsAndProceed()` before opening their respective modals. If T&C required, TermsModal opens first; after acceptance the original action proceeds.
- **JobDetailModal integration:** Same terms gate applied to Accept and Negotiate buttons in the detail modal footer.
- **Graceful fallback:** On terms-check failure (network error, API error), vendor proceeds without blocking — terms check is non-blocking.

### Files Changed
- `apps/vendor/src/components/jobs/TermsModal.tsx` — New component + `checkTermsForOffer` helper
- `apps/vendor/src/components/jobs/JobBoard.tsx` — Import TermsModal, add terms state + `checkTermsAndProceed`, gate Accept/Negotiate buttons, render TermsModal
- `apps/vendor/src/components/jobs/JobDetailModal.tsx` — Import TermsModal, add terms state + `checkTermsAndProceed`, gate Accept/Negotiate buttons, render TermsModal
- `docs/CVP-PROGRESS-LOG.md` — This entry

---

## Session — March 25, 2026 (Counter-Offer Auto-Assign Handling)

### Completed
- **Auto-assign toast:** Updated NegotiateModal success handling for backend v3 counter-offer response. When `auto_accepted && auto_assigned` is true, shows "You are now assigned to this job" instead of the old "You can now accept the revised offer" message. Job moves to Active tab on refetch.
- **Edge case fallback:** Added separate branch for `auto_accepted` without `auto_assigned` (shows generic acceptance message).

### Files Changed
- `apps/vendor/src/components/jobs/NegotiateModal.tsx` — Updated success toast logic to handle auto-assigned counter-offers

---

## Session — March 25, 2026 (Fix Negotiate Modal)

### Completed
- **Auto-calculated total:** Removed editable Rate Unit dropdown and Proposed Total input. Units are now derived from the original offer (total / rate). Total auto-calculates as proposed rate × units (read-only display).
- **Current Offer summary box:** Added a prominent gray box at the top of the modal showing the original rate × units = total and deadline.
- **Deadline time picker:** Replaced date-only input with date + time picker. Time dropdown shows 30-minute increments (12:00 AM through 11:30 PM). Pre-fills from original offer deadline.
- **Note field required:** Changed note from optional to required. Submit button disabled until note is provided.
- **Unit display:** Shows unit label from original offer (e.g., "/ page × 3 pages") as read-only text next to rate input.

### Files Changed
- `apps/vendor/src/components/jobs/NegotiateModal.tsx` — Rewrote modal: removed rate unit dropdown and editable total, added auto-calculation, current offer box, date+time deadline picker

---

## Session — March 25, 2026 (Vendor Negotiation Policy Awareness)

### Completed
- **Negotiation types:** Added `negotiation_allowed` and `counter_status` fields to `VendorStep` and `JobDetailJob` interfaces.
- **Counter-offer API:** Added `submitCounterOffer` function, `CounterOfferPayload` and `CounterOfferResponse` types to `vendorJobs.ts`. Calls `vendor-counter-offer` v2 edge function.
- **NegotiateModal component:** New modal for submitting counter-proposals. Pre-populates rate/total/deadline from current offer. Handles HTTP 403 (not allowed), 410 (expired), 409 (already pending). Shows different success toast for auto-accepted vs queued proposals.
- **Conditional Negotiate button (JobBoard):** Only shows on offered jobs when `negotiation_allowed === true`. Disabled when `counter_status === 'proposed'` (pending review). Re-enabled when rejected.
- **Negotiation indicators (JobBoard cards):** Shows "Open to negotiation" for negotiable offers with no counter. Shows counter status badges (pending/accepted/rejected) when applicable.
- **Negotiation indicators (JobDetailModal):** Shows "This offer is open to negotiation" or "Fixed terms — accept or decline" in Language & Rate section. Negotiate button in footer actions when allowed.

### Files Changed
- `apps/vendor/src/api/vendorJobs.ts` — Added negotiation fields to types, added `submitCounterOffer` API function
- `apps/vendor/src/components/jobs/NegotiateModal.tsx` — New file: counter-offer modal component
- `apps/vendor/src/components/jobs/JobBoard.tsx` — Added conditional Negotiate button, negotiation indicators, counter status badges, NegotiateModal rendering
- `apps/vendor/src/components/jobs/JobDetailModal.tsx` — Added negotiation indicators in rate section, Negotiate button in footer, NegotiateModal rendering

---

## Session — March 25, 2026 (Vendor Portal Audit Fixes)

### Completed
- **FIX 1 (Critical):** `acceptStep` now sends `offer_id` in request body alongside `step_id`. AcceptConfirmModal passes `step.offer_id` to the call.
- **FIX 2 (Critical):** `declineStep` now sends `offer_id` in request body alongside `step_id` and `reason`. DeclineModal passes `step.offer_id` to the call.
- **FIX 3 (Minor):** Removed dead `getSourceFiles` function and its `SourceFilesResponse` type from `vendorJobs.ts`. No callers existed.
- **FIX 4 (Minor):** Deleted 4 old stub edge function directories: `vendor-accept-job`, `vendor-decline-job`, `vendor-upload-delivery`, `vendor-get-source-files`.
- **FIX 5 (Minor):** AcceptConfirmModal now handles HTTP 410 (expired offer) with a specific "This offer has expired" error message and refreshes the job list. `acceptStep` return type changed to `{ status, data }` to expose HTTP status code.

### Files Changed
- `apps/vendor/src/api/vendorJobs.ts` — Added `offer_id` param to `acceptStep`/`declineStep`, removed `getSourceFiles`, changed `acceptStep` return type for 410 handling
- `apps/vendor/src/components/jobs/JobActionModals.tsx` — Pass `offer_id` in accept/decline calls, handle 410 expired offer
- `supabase/functions/vendor-accept-job/` — Deleted (dead stub)
- `supabase/functions/vendor-decline-job/` — Deleted (dead stub)
- `supabase/functions/vendor-upload-delivery/` — Deleted (dead stub)
- `supabase/functions/vendor-get-source-files/` — Deleted (dead stub)

---

## Session — March 25, 2026 (Job Detail Modal Phase 2 — Rich Detail)

### Completed
- **Inline PDF Preview:** Source, reference, and delivered PDF files can be previewed inline via iframe toggle (Preview/Hide button). Non-PDF files show Download only.
- **Per-File Document Details (Expandable):** Volume section shows collapsed summary ("3 documents · 2,450 words · 8 pages") with click-to-expand per-file details showing word count, page count, file type, file size, and Preview/Download buttons. Documents matched to source files by filename.
- **Previous Step Deliverables:** Step 2+ jobs show a distinct blue-tinted section ("Files from Previous Step") with explanatory text, filtering source_files by `source === "previous_step"`. Step 1 jobs show "Source Files" only.
- **Reference Files Section:** Green-tinted section with reference materials, shown only when reference_files exist. Same preview/download behavior.
- **Enhanced Revision Context:** Amber section with revision number, PM feedback in highlighted block, previous delivery files, original source files, compare guidance text, and "Deliver Revision" CTA. Positioned prominently after Deadline section.
- **Customer First Name Display:** Shows customer first name in Order Info section (extracted from `customer_name` field). Hidden when null.
- **FileRowWithPreview component:** New reusable component replacing FileRow, supports PDF preview toggle and color tinting for different sections (default/blue/green).
- Added `customer_name` to `JobDetailJob` interface.

### Files Changed
- `apps/vendor/src/api/vendorJobs.ts` — Added `customer_name` to `JobDetailJob`
- `apps/vendor/src/components/jobs/JobDetailModal.tsx` — Complete rewrite with Phase 2 features

---

## Session — March 25, 2026 (Enhanced Job Detail Modal)

### Completed
- **Job Detail Modal — Full enrichment (Phase 1):**
  - Modal now fetches from `vendor-get-job-detail` edge function on open with loading spinner
  - New sections: Order Info (order number, service, rush badge), Language & Rate (LP, rate, total, currency), Deadline & Timing (deadline with relative time, estimated delivery, offer expiry countdown), Volume (doc count, word count, page count + per-file breakdown), Source Files (with individual download buttons via signed URLs), Reference Files (conditional), Instructions (gray box), Revision Context (amber box with reason + previous delivery files), full Timeline (Offered → Approved with dates or dashes)
  - Expired offers show red "Expired" badge and disabled Accept button
  - Footer actions vary by status: Accept/Decline for offered, Deliver for active, Deliver Revision for revision_requested
  - Added `getJobDetail` API function and full TypeScript types (`JobDetailJob`, `JobDetailVolume`, `JobDetailFile`, `JobDetailResponse`)
  - Added `offer_id`, `expires_at`, `is_rush` fields to `VendorStep` interface

- **Job Board Cards — Enhanced info:**
  - Cards now clickable (entire card opens detail modal)
  - Added RUSH badge on cards for rush orders
  - Added offer expiry countdown badge on offered jobs
  - Rate and total displayed inline on cards
  - Action buttons use `stopPropagation` to prevent double-opening modal

### Files Changed
- `apps/vendor/src/api/vendorJobs.ts` — Added job detail types and `getJobDetail` function
- `apps/vendor/src/components/jobs/JobDetailModal.tsx` — Complete rewrite with enhanced layout
- `apps/vendor/src/components/jobs/JobBoard.tsx` — Enhanced cards with rush/expiry badges, clickable cards

---

## Session — March 24, 2026 (Profile Enhancements + Services & Rates Page)

### Completed
- **Profile page — Province & Tax auto-lookup:**
  - Added province dropdown (visible only when country = Canada), sourced from `tax_rates` DB table
  - Province selection auto-populates `tax_name` and `tax_rate` (both READ-ONLY)
  - Tax ID label changes dynamically based on tax type (HST Number / GST Number / GST/QST Number / etc.)
  - When country != Canada: province hidden, tax_name = "N/A", tax_rate = 0%
  - Created `lookup-tax-rate` edge function (GET, public, returns provinces list or single province tax info)

- **Services & Rates page (NEW — replaces old read-only rates view):**
  - Full rate card management: add, edit, remove service rates
  - Services grouped by category (Translation, Review & QA, Interpretation, Multimedia, Technology, Other)
  - Add Service modal: searchable service dropdown (grouped by category), rate, unit, currency, minimum charge, notes
  - Edit Rate modal: pre-filled, service/unit locked, editable rate/min charge/notes
  - Remove Rate: confirmation dialog, soft-deactivate (is_active = false)
  - Duplicate detection: 409 error when adding same service+unit combo
  - Created `vendor-manage-rates` edge function (POST with actions: get/add/update/remove)

- **Edge function updates:**
  - `vendor-update-profile`: added province_state, tax_name handling; auto-clears tax when country changes from Canada
  - `vendor-get-profile`: added tax_name to vendor select query

- **API layer:**
  - Added `lookupProvinces()`, `lookupTaxRate()`, `manageRates()` functions
  - Added types: Province, ManagedRate, ServiceOption, ManageRatesResponse
  - Updated VendorProfile and VendorFullProfile types with tax_name field

- **Navigation:** Renamed sidebar "Rates" to "Services & Rates"

### Files Changed
- `supabase/functions/lookup-tax-rate/index.ts` (NEW)
- `supabase/functions/vendor-manage-rates/index.ts` (NEW)
- `supabase/functions/vendor-update-profile/index.ts` (modified)
- `supabase/functions/vendor-get-profile/index.ts` (modified)
- `apps/vendor/src/api/vendorProfile.ts` (modified)
- `apps/vendor/src/api/vendorAuth.ts` (modified)
- `apps/vendor/src/components/profile/VendorProfile.tsx` (modified)
- `apps/vendor/src/components/profile/VendorRates.tsx` (rewritten)
- `apps/vendor/src/components/layout/VendorSidebar.tsx` (modified)

### Edge Functions to Deploy
```
supabase functions deploy lookup-tax-rate
supabase functions deploy vendor-manage-rates
supabase functions deploy vendor-update-profile
supabase functions deploy vendor-get-profile
```

---

## Session — March 24, 2026 (Vendor Portal Audit & Fixes)

### Completed
- **Full audit** of vendor portal (vendor.cethos.com) against feature checklist — identified 17 gaps
- **Database migration 010**: Move tax_id and tax_rate from vendor_payment_info to vendors table, add preferred_rate_currency, rename preferred_currency to payment_currency
- **Profile page overhaul** (`VendorProfile.tsx`):
  - Added editable Full Name field
  - Added editable City field
  - Added editable Country field (searchable dropdown with 100+ countries)
  - Added Preferred Rate Currency field (searchable dropdown with 76 currencies)
  - Added Tax ID (GST/HST/VAT) field — moved from Payment page
  - Added Tax Rate (%) field — moved from Payment page
  - New "Financial Details" section on profile page
- **Payment page fixes** (`PaymentInfo.tsx`):
  - Removed tax_id and tax_rate fields (moved to profile)
  - Added **Wise** payment method (6th option)
  - Added cheque **mailing address** fields
  - Added wire transfer **SWIFT/routing code** and **bank address** fields
  - Replaced hardcoded 4-currency dropdown with full **76-currency searchable dropdown**
  - Renamed "Preferred Currency" to "Payment Currency" with explanation
- **Language Pairs page** (`LanguagePairs.tsx`):
  - Replaced free-text inputs with **searchable dropdowns** (type-ahead, grouped by base language)
  - Added comprehensive **ISO 639-1 + BCP 47 language list** (~170 entries with regional variants)
  - Added **same-language validation** — blocks identical source/target (EN-US → EN-US)
  - Allows **locale variants** (EN-US → EN-CA is valid)
  - Display both language name and code
- **Dashboard** (`VendorDashboard.tsx`):
  - Added interactive **availability toggle** (dropdown: Available/Busy/Unavailable/Vacation/On Leave)
- **Shared components** created:
  - `SearchableSelect` — reusable combobox with type-ahead search, grouped options, clear button
  - `CurrencySelect` — currency-specific dropdown using SearchableSelect, format "CAD - Canadian Dollar (C$)"
- **Data files** created:
  - `data/languages.ts` — 170+ languages with ISO codes and regional variants
  - `data/currencies.ts` — 76 currencies with codes, names, symbols
  - `data/countries.ts` — 100+ countries matching recruitment app
- **Edge function updates**:
  - `vendor-update-profile` — now handles full_name, city, country, tax_id, tax_rate, preferred_rate_currency
  - `vendor-get-profile` — returns new vendor fields, updated payment_info select
  - `vendor-update-payment-info` — removed tax fields, added Wise method, renamed to payment_currency
- **New notification edge functions**:
  - `notify-vendor-job-offer` — email vendor when a job is assigned
  - `notify-vendor-deadline-reminder` — cron-compatible: finds jobs due in 24hrs, sends reminders
  - `notify-vendor-job-approved` — email vendor when delivery is approved
- **API type updates**:
  - `vendorProfile.ts` — PaymentInfo uses payment_currency, VendorFullProfile has tax_id/tax_rate/preferred_rate_currency
  - `vendorAuth.ts` — updateProfile accepts full_name, city, country, tax_id, tax_rate, preferred_rate_currency
- TypeScript strict mode passes with zero errors
- Vite production build succeeds

### Files Created
- `supabase/migrations/010_vendor_schema_updates.sql`
- `apps/vendor/src/components/shared/SearchableSelect.tsx`
- `apps/vendor/src/components/shared/CurrencySelect.tsx`
- `apps/vendor/src/data/languages.ts`
- `apps/vendor/src/data/currencies.ts`
- `apps/vendor/src/data/countries.ts`
- `supabase/functions/notify-vendor-job-offer/index.ts`
- `supabase/functions/notify-vendor-deadline-reminder/index.ts`
- `supabase/functions/notify-vendor-job-approved/index.ts`

### Files Modified
- `apps/vendor/src/components/profile/VendorProfile.tsx` — full rewrite with new fields
- `apps/vendor/src/components/profile/PaymentInfo.tsx` — tax removal, Wise, cheque/wire fixes, CurrencySelect
- `apps/vendor/src/components/profile/LanguagePairs.tsx` — searchable dropdowns, validation
- `apps/vendor/src/components/dashboard/VendorDashboard.tsx` — availability toggle
- `apps/vendor/src/api/vendorProfile.ts` — updated types
- `apps/vendor/src/api/vendorAuth.ts` — expanded updateProfile params
- `supabase/functions/vendor-update-profile/index.ts` — new fields
- `supabase/functions/vendor-get-profile/index.ts` — new fields, renamed payment column
- `supabase/functions/vendor-update-payment-info/index.ts` — removed tax, added Wise, renamed column

### Remaining Gaps (Not in Scope for This Session)
- Certification upload UI on profile page (edge function exists, no frontend)
- Vendor registration/application form (by design — handled at join.cethos.com)
- pg_cron setup for deadline-reminder-checker (SQL cron job needs to be registered in Supabase dashboard)
- Brevo email templates for new notification functions (IDs 20, 21, 22 are placeholders)

---

## Session — March 24, 2026 (Phase 2 — Full Vendor Portal Build)

### Completed
- Audited entire vendor portal codebase — mapped all built vs missing features
- Built 13 new Supabase edge functions for vendor portal:
  - `vendor-get-profile` — full profile with language pairs, rates, payment info, profile completeness
  - `vendor-update-availability` — toggle availability status (available/busy/vacation/unavailable)
  - `vendor-update-payment-info` — upsert payment method, bank details, tax info
  - `vendor-update-language-pairs` — add/remove/toggle language pairs with dedup
  - `vendor-update-rates` — submit rate change requests (flagged for admin review)
  - `vendor-upload-certification` — upload cert documents to Supabase Storage
  - `vendor-get-jobs` — list jobs with language name enrichment, pagination, status filter
  - `vendor-accept-job` — accept offered job (validates status)
  - `vendor-decline-job` — decline offered job with optional reason
  - `vendor-upload-delivery` — upload translated files to vendor-deliveries bucket
  - `vendor-get-source-files` — signed URLs for source documents (1hr expiry)
  - `vendor-get-invoices` — list invoices with job references and summary stats
  - `vendor-get-invoice-pdf` — signed URL for invoice PDF download
- Created 2 new database tables via migration:
  - `cvp_jobs` — job assignments with full lifecycle (offered → accepted → delivered → completed)
  - `cvp_payments` — invoice and payment tracking
- Created 2 Supabase Storage buckets: `vendor-deliveries`, `vendor-certifications`
- Built complete frontend for all missing vendor portal features:
  - **Language Pairs page** (`/languages`) — list active/inactive pairs, add new, toggle, remove
  - **Rates page** (`/rates`) — table view with service names, request rate change with inline form
  - **Payment Info page** (`/payment`) — method selector, dynamic bank/PayPal/e-Transfer fields, tax info
  - **Job Board page** (`/jobs`) — three-tab view (Offered/Active/Completed), accept/decline actions, deadline countdown
  - **Job Detail page** (`/jobs/:id`) — full job info, instructions, source file download, delivery upload, reviewer feedback
  - **Invoices page** (`/invoices`) — summary cards (total earned, pending, count), filterable table
  - **Invoice Detail page** (`/invoices/:id`) — full invoice breakdown, PDF download
- Enhanced **Dashboard** with:
  - Quick stats: language pairs count, active jobs, completed jobs, pending payments
  - Profile completeness progress bar
  - Offered jobs section (shows up to 3 pending offers)
  - Quick action cards for Profile, Security, Jobs
- Updated **Sidebar navigation** with 8 nav items: Dashboard, Profile, Languages, Rates, Payment, Jobs, Invoices, Security
- Created 3 new API modules:
  - `vendorProfile.ts` — getFullProfile, updateAvailability, updatePaymentInfo, updateLanguagePairs, updateRates, uploadCertification
  - `vendorJobs.ts` — getJobs, acceptJob, declineJob, uploadDelivery, getSourceFiles
  - `vendorInvoices.ts` — getInvoices, getInvoicePdf
- All edge functions deployed to Supabase via MCP
- Created `docs/CVP-VENDOR-PORTAL-ADMIN-PROMPT.md` — self-contained prompt for building admin-side vendor management in the CETHOS portal, covering:
  - Vendor management dashboard + detail page
  - Job assignment + delivery review workflow
  - Invoice/payment management
  - Rate change review queue
  - Profile health dashboard
  - Application review completion (Phase 1C)
- TypeScript strict mode passes with zero errors
- Vite production build succeeds

### Files Created
- `supabase/functions/vendor-get-profile/index.ts`
- `supabase/functions/vendor-update-availability/index.ts`
- `supabase/functions/vendor-update-payment-info/index.ts`
- `supabase/functions/vendor-update-language-pairs/index.ts`
- `supabase/functions/vendor-update-rates/index.ts`
- `supabase/functions/vendor-upload-certification/index.ts`
- `supabase/functions/vendor-get-jobs/index.ts`
- `supabase/functions/vendor-accept-job/index.ts`
- `supabase/functions/vendor-decline-job/index.ts`
- `supabase/functions/vendor-upload-delivery/index.ts`
- `supabase/functions/vendor-get-source-files/index.ts`
- `supabase/functions/vendor-get-invoices/index.ts`
- `supabase/functions/vendor-get-invoice-pdf/index.ts`
- `supabase/migrations/009_cvp_jobs_and_payments.sql`
- `apps/vendor/src/api/vendorProfile.ts`
- `apps/vendor/src/api/vendorJobs.ts`
- `apps/vendor/src/api/vendorInvoices.ts`
- `apps/vendor/src/components/profile/LanguagePairs.tsx`
- `apps/vendor/src/components/profile/VendorRates.tsx`
- `apps/vendor/src/components/profile/PaymentInfo.tsx`
- `apps/vendor/src/components/jobs/JobBoard.tsx`
- `apps/vendor/src/components/jobs/JobDetail.tsx`
- `apps/vendor/src/components/invoices/InvoiceList.tsx`
- `apps/vendor/src/components/invoices/InvoiceDetail.tsx`
- `docs/CVP-VENDOR-PORTAL-ADMIN-PROMPT.md`

### Files Modified
- `apps/vendor/src/App.tsx` — added 7 new routes (languages, rates, payment, jobs, jobs/:id, invoices, invoices/:id)
- `apps/vendor/src/components/layout/VendorSidebar.tsx` — added 5 new nav items
- `apps/vendor/src/components/dashboard/VendorDashboard.tsx` — enhanced with stats, completeness, offered jobs

### Next Steps
- Use `CVP-VENDOR-PORTAL-ADMIN-PROMPT.md` to build admin pages in the CETHOS portal repo
- Build Phase 1C edge functions (approve, reject, negotiate, waitlist) — see admin prompt
- Build Phase 1D edge functions (profile health cron jobs)
- Set up Netlify deployment for vendor.cethos.com
- End-to-end testing: login → dashboard → accept job → upload delivery → view invoice

---

## Session — March 24, 2026 (Phase 2 — Vendor Auth System + Core Shell)

### Completed
- Built vendor portal authentication system with custom auth (not Supabase Auth/GoTrue)
- Created 6 Supabase edge functions for vendor auth:
  - `vendor-auth-otp-send` — sends 6-digit OTP via Brevo email or SMS, rate limiting (60s), masking helpers
  - `vendor-auth-otp-verify` — verifies OTP code, creates 30-day session, returns vendor profile
  - `vendor-auth-password` — bcrypt password login with session creation
  - `vendor-auth-session` — validates Bearer token, updates last_seen_at, returns vendor + session data
  - `vendor-auth-logout` — deletes session from DB
  - `vendor-set-password` — set/change password with current password verification, strength validation
- Set up vendor portal frontend app (`apps/vendor/`) with React + Vite + TypeScript + Tailwind CSS
- Built complete frontend:
  - **API layer** (`src/api/vendorAuth.ts`) — typed fetch wrappers for all 6 edge functions
  - **Auth context** (`src/context/VendorAuthContext.tsx`) — session persistence via localStorage, auto-validate on mount, login/logout/refresh helpers
  - **LoginPage** — centered card with tab switcher (Email Code / Password)
  - **OtpLoginForm** — two-step flow: request code (email/SMS channel selector) → enter 6-digit code (with resend countdown)
  - **OtpInput** — 6-box digit input with auto-advance, backspace navigation, paste support
  - **PasswordLoginForm** — email + password with show/hide toggle, "forgot password" link to OTP tab
  - **VendorShell** — authenticated layout with collapsible sidebar + header + Outlet
  - **VendorSidebar** — nav links (Dashboard, Profile, Security) with active state highlighting, mobile responsive
  - **VendorHeader** — vendor name, availability status badge, logout button
  - **VendorDashboard** — placeholder welcome page
  - **VendorProfile** — display-only profile with all vendor fields
  - **SetPasswordForm** — current/new/confirm password with strength indicator (weak/good/strong)
- Protected routes redirect to `/login` when no valid session
- TypeScript strict mode passes with zero errors
- Vite production build succeeds

### Files Created
- `supabase/functions/vendor-auth-otp-send/index.ts`
- `supabase/functions/vendor-auth-otp-verify/index.ts`
- `supabase/functions/vendor-auth-password/index.ts`
- `supabase/functions/vendor-auth-session/index.ts`
- `supabase/functions/vendor-auth-logout/index.ts`
- `supabase/functions/vendor-set-password/index.ts`
- `apps/vendor/package.json`
- `apps/vendor/index.html`
- `apps/vendor/vite.config.ts`
- `apps/vendor/tsconfig.json`
- `apps/vendor/tsconfig.app.json`
- `apps/vendor/tsconfig.node.json`
- `apps/vendor/src/index.css`
- `apps/vendor/src/main.tsx`
- `apps/vendor/src/App.tsx`
- `apps/vendor/src/api/vendorAuth.ts`
- `apps/vendor/src/context/VendorAuthContext.tsx`
- `apps/vendor/src/components/auth/LoginPage.tsx`
- `apps/vendor/src/components/auth/OtpLoginForm.tsx`
- `apps/vendor/src/components/auth/PasswordLoginForm.tsx`
- `apps/vendor/src/components/auth/OtpInput.tsx`
- `apps/vendor/src/components/layout/VendorShell.tsx`
- `apps/vendor/src/components/layout/VendorSidebar.tsx`
- `apps/vendor/src/components/layout/VendorHeader.tsx`
- `apps/vendor/src/components/dashboard/VendorDashboard.tsx`
- `apps/vendor/src/components/profile/VendorProfile.tsx`
- `apps/vendor/src/components/profile/SetPasswordForm.tsx`

### Files Removed
- `apps/vendor/src/placeholder.ts` — replaced with full vendor app

### Next Steps
- Deploy 6 new edge functions to Supabase (`supabase functions deploy`)
- Create database tables: `vendors`, `vendor_auth`, `vendor_otp`, `vendor_sessions` (if not yet migrated)
- Set up Netlify site for `vendor.cethos.com` pointing to `apps/vendor/`
- Set `VITE_SUPABASE_URL` env var in Netlify
- Test OTP email flow end-to-end
- Test SMS flow (may need Brevo sender name registration)
- Build out vendor dashboard and profile management features

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
| 2 | Vendor working portal | 🟡 In progress — auth + core shell + profile + jobs + invoices built |

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

## 2026-04-22 — Trainings module (vendor-management)

Built a generic staff training engine in the CETHOS admin portal and seeded the first module, **Vendor Management**, covering every existing vendor-management feature.

**DB (`D:\cethos-vendor\supabase\migrations\`):**
- `011_cvp_trainings.sql` — 4 new tables (`cvp_trainings`, `cvp_training_lessons`, `cvp_training_assignments`, `cvp_training_lesson_progress`), RLS helpers (`cvp_is_training_admin`, `cvp_is_active_staff`, `cvp_current_staff_id`), 11 RLS policies. Applied to `lmzoyezvsjgsxveoakdr`.
- `012_seed_vendor_management_training.sql` — seeds 1 training + 11 lessons (orientation → recruitment queue → application detail → test stage → assessment → negotiation → staff decisions → vendor directory → vendor detail tabs → messaging/tasks/nudges → cheat sheet). Idempotent via `ON CONFLICT (slug)`.

**Portal UI (`D:\cethos\portal\cethos_app_figma_design_v1\`):**
- New sidebar section "Trainings" (teal badge for unfinished assignments) + child link "Vendor Management" (`client/components/admin/AdminLayout.tsx`).
- Routes added (`client/App.tsx`): `/admin/trainings`, `/admin/trainings/:slug`, `/admin/trainings/:slug/assign`, `/admin/trainings/:slug/:lessonSlug`.
- Pages (`client/pages/admin/trainings/`): `TrainingsList.tsx`, `TrainingOverview.tsx`, `TrainingLesson.tsx` (react-markdown + remark-gfm, screenshot zoom, key-rule callouts, "try it yourself" deep link, "I've read this" button), `TrainingAssign.tsx` (admin-only multi-select + due date + current-assignee list).
- Data layer: `client/lib/trainings.ts` — all Supabase queries, RLS-aware. Acknowledging the last lesson auto-stamps `completed_at` on the assignment.

**Curriculum doc:**
- `docs/TRAINING-VENDOR-MANAGEMENT-CURRICULUM.md` — canonical feature inventory (24 features grouped into 11 lessons) with rule citations and a smoke-test log table.

**Assigned for role-path testing:** `raminder@cethoscorp.com` (reviewer).

**Screenshots pending:** `client/public/training/vendor-management/` created and empty. Live screenshots were not captured in this session because admin UI login requires staff credentials. `TrainingLesson.tsx` degrades gracefully with an inline "Screenshot not yet captured" placeholder. Next step: log in as staff, walk through each lesson's `route_reference`, capture to the paths listed in each lesson's `screenshot_paths` array.

---

## 2026-04-23 — Mailgun migration (outbound + inbound Phase 1)

Migrated all CVP transactional + operational email from Brevo to **Mailgun EU**. Added inbound applicant email handling with Phase-1 scope: unsubscribe detection + AI auto-reply pointing to `vm@cethos.com`.

**Outbound:**
- New transport: `supabase/functions/_shared/mailgun.ts` with `sendMailgunEmail` (honours `do_not_contact` gate) and `sendMailgunOperationalEmail` (ungated, for admin/OTP emails).
- New template bundle: `supabase/functions/_shared/email-templates.ts` — 17 inline HTML templates V1–V17 (ship changes in code, no Mailgun dashboard drift).
- Swapped 15 call sites: `cvp-submit-application`, `cvp-prescreen-application`, `cvp-send-tests`, `cvp-submit-test`, `cvp-check-test-followups`, `cvp-approve-application`, `cvp-send-queued-rejections`, `cvp-request-info`, `cvp-daily-recruitment-status`, `vendor-auth-otp-send`, `vendor-auth-invite`, `notify-vendor-job-offer`, `notify-vendor-job-approved`, `notify-vendor-deadline-reminder`. `_shared/brevo.ts` left in place for 1-week rollback window; delete later.

**Inbound (Phase 1):**
- Migration `014_cvp_inbound_emails.sql` — new `cvp_inbound_emails` table + `do_not_contact` / `do_not_contact_at` / `do_not_contact_source` columns on `cvp_applications`, with RLS (staff read-only; inserts via service role only).
- New edge function `cvp-inbound-email` — verifies Mailgun HMAC signature, parses multipart, matches sender to an application, regex+Claude confirms unsubscribe intent, generates a polite AI auto-reply in the sender's language, logs every inbound.
- Route to configure in Mailgun dashboard: `match_recipient("recruiting@vendors.cethos.com") → forward(<fn url>) + stop()`.

**Secrets to add in Supabase** (see `docs/MAILGUN-SETUP.md` for full checklist):
```
MAILGUN_API_KEY
MAILGUN_DOMAIN=vendors.cethos.com
MAILGUN_REGION=eu
MAILGUN_FROM_EMAIL=noreply@vendors.cethos.com
MAILGUN_FROM_NAME=CETHOS Vendor Portal
MAILGUN_REPLY_TO=recruiting@vendors.cethos.com
MAILGUN_WEBHOOK_SIGNING_KEY
CVP_SUPPORT_EMAIL=vm@cethos.com
```

**Docs:**
- `docs/MAILGUN-SETUP.md` — secrets, DNS (SPF/DKIM/MX EU), route config, smoke tests, future phases.
- Full multi-phase plan at `C:/Users/RaminderShah/.claude/plans/mailgun-inbound-outbound.md`.

**Not yet done (user applies these):**
- Apply migration 014 (`supabase db push`).
- Deploy `cvp-inbound-email` + redeploy the 14 swapped functions (`supabase functions deploy <name>`).
- Add the 8 secrets above in Supabase.
- Add DNS records for `vendors.cethos.com` in Mailgun EU (MX required for inbound).
- Create the Mailgun Route.
- Run Section 5 smoke tests from `MAILGUN-SETUP.md`.

---

*End of CVP-PROGRESS-LOG.md*
