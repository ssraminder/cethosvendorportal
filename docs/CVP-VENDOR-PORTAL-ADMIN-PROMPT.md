# CVP Vendor Portal — Admin Panel Integration Prompt

**Purpose:** Self-contained prompt for building admin-side vendor management features in the CETHOS portal (`portal.cethos.com`) codebase.

**Context:** The vendor portal (`vendor.cethos.com`) is now built with full frontend + edge functions. The admin panel needs pages to manage vendors, assign jobs, process payments, review rate changes, and monitor profile health.

---

## What Exists (Backend — shared Supabase project `lmzoyezvsjgsxveoakdr`)

### Database Tables Available

**Vendor tables (no prefix — CETHOS core):**
- `vendors` — id, full_name, email, phone, status, vendor_type, country, province_state, city, availability_status, certifications (JSONB), years_experience, rate_per_page, specializations, rating, total_projects, last_project_date, minimum_rate
- `vendor_language_pairs` — id, vendor_id, source_language (text), target_language (text), is_active, notes
- `vendor_rates` — id, vendor_id, service_id, language_pair_id, calculation_unit, rate, currency, rate_cad, minimum_charge, source, is_active, notes (contains [RATE_CHANGE_REQUEST] JSON markers when vendors request changes)
- `vendor_payment_info` — id, vendor_id, preferred_currency, payment_method, payment_details (JSONB — NEVER display raw), tax_id, tax_rate, invoice_notes
- `vendor_auth` — password hashes (vendor_id, password_hash, must_reset)
- `vendor_sessions` — session tokens
- `services` — id, code, name, name_fr, category, is_active

**CVP tables (cvp_ prefix):**
- `cvp_applications` — Full application pipeline with status tracking, AI scores, negotiation, rejection
- `cvp_test_combinations` — Per-combination test assignments with per-row approval
- `cvp_test_submissions` — Test tokens, submissions, AI assessments
- `cvp_test_library` — Staff-managed test documents
- `cvp_translators` — Created on approval, links to vendors table
- `cvp_profile_nudges` — Nudge suppression and tracking
- `cvp_jobs` — Job assignments (offered → accepted → delivered → completed)
- `cvp_payments` — Invoices and payment tracking

### Edge Functions Available (vendor-facing)
All use Bearer token auth via vendor_sessions:
- `vendor-get-profile` — full profile with language pairs, rates, payment info
- `vendor-update-availability` — toggle availability status
- `vendor-update-payment-info` — upsert payment details
- `vendor-update-language-pairs` — add/remove/toggle language pairs
- `vendor-update-rates` — submit rate change request (flagged for admin)
- `vendor-upload-certification` — upload cert docs to storage
- `vendor-get-jobs` — list jobs with language names
- `vendor-accept-job` / `vendor-decline-job` — respond to offers
- `vendor-upload-delivery` — upload translated files
- `vendor-get-source-files` — signed URLs for source docs
- `vendor-get-invoices` — list invoices with summary stats
- `vendor-get-invoice-pdf` — signed URL for PDF download

---

## Admin Pages to Build

### 1. Vendor Management Dashboard
**Route:** `/admin/vendors`

**Features:**
- List all vendors with search (name, email) and filters (status, vendor_type, country, availability)
- Columns: Name, Email, Status badge, Vendor Type, Country, Availability, Language Pairs count, Total Projects, Rating, Last Active
- Click row → Vendor Detail page
- Bulk actions: Activate, Deactivate, Send Nudge Email
- Summary stats at top: Total active, Total onboarding, Total inactive

**Query pattern:**
```sql
SELECT v.*,
  COUNT(DISTINCT vlp.id) FILTER (WHERE vlp.is_active) as active_lp_count,
  ct.tier, ct.profile_completeness
FROM vendors v
LEFT JOIN vendor_language_pairs vlp ON vlp.vendor_id = v.id
LEFT JOIN cvp_translators ct ON ct.email = v.email
GROUP BY v.id, ct.tier, ct.profile_completeness
ORDER BY v.created_at DESC
```

### 2. Vendor Detail Page
**Route:** `/admin/vendors/:id`

**Sections:**
- **Header:** Name, email, status badge, availability, tier, edit button
- **Profile tab:** All personal info, bio, certifications (with verified/unverified badges), years experience
- **Language Pairs tab:** Table of all pairs with active/inactive status, add/remove capability
- **Rates tab:** Table of all rates with service name, rate, unit, currency, source badge. Rate change requests highlighted in amber with approve/reject buttons
- **Payment tab:** Payment method, preferred currency, tax ID (mask payment_details — show method + last 4 digits only). NEVER display full payout_details
- **Jobs tab:** List of all jobs for this vendor with status, deadline, quality score
- **Invoices tab:** List of invoices with status, amount, payment date
- **Nudges tab:** History of profile nudges with resolved/unresolved status

**Admin Actions:**
- Edit vendor status (active/onboarding/suspended/inactive)
- Edit availability
- Override tier (standard/senior/expert)
- Deactivate vendor (with reason)
- Reactivate vendor
- Send custom nudge email
- Approve/reject rate change requests

### 3. Job Assignment Page
**Route:** `/admin/jobs`

**Features:**
- Create new job: Select vendor, language pair, domain, service type, word count, deadline, rate, upload source files
- List all jobs with filters (status, vendor, language pair)
- Job detail: View instructions, source files, delivery files, quality score input
- Review delivery: Download files, enter quality score (0-100), add reviewer notes, approve/request revision
- Mark job as completed (triggers invoice generation)

**Edge functions needed (admin-side):**
- `admin-create-job` — Create cvp_jobs record, upload source files, trigger `notify-vendor-job-offer`
- `admin-review-delivery` — Update quality_score, reviewer_notes, status → approved/revision_requested
- `admin-complete-job` — Mark completed, generate cvp_payments record

### 4. Invoice/Payment Management
**Route:** `/admin/payments`

**Features:**
- List all invoices across all vendors with filters (status, vendor, date range)
- Generate invoice for completed job (auto-calculate from rate × word count)
- Upload invoice PDF
- Mark as paid (with payment reference, date)
- Batch payment processing

**Edge functions needed:**
- `admin-generate-invoice` — Create cvp_payments record with invoice number (INV-YY-NNNN format)
- `admin-mark-paid` — Update status → paid, set paid_at + payment_reference

### 5. Rate Change Review Queue
**Route:** `/admin/rate-reviews`

**Features:**
- List all vendor_rates rows with [RATE_CHANGE_REQUEST] in notes
- Show: Vendor name, service, current rate, proposed rate, requested date
- Approve (update rate to proposed amount, clear request marker)
- Reject (clear request marker, optionally notify vendor)

### 6. Profile Health Dashboard
**Route:** `/admin/profile-health`

**Features:**
- Overview of all vendors with profile issues:
  - Payout missing (no payment_info record or no payment_method)
  - Profile completeness < 80%
  - Certifications expiring within 60 days
  - Language pairs not reviewed > 6 months
  - Inactive 90+ days
- Nudge history per vendor from cvp_profile_nudges
- Send individual or batch nudge emails
- Resolve nudge (mark as resolved with notes)

**Edge functions needed:**
- `cvp-check-vendor-profiles` — Weekly cron: scan all active vendors, create nudge records
- `cvp-send-profile-nudges` — Daily cron: send pending nudge emails, respect 30-day suppression

### 7. Application Review Completion (Phase 1C)
**Route:** `/admin/recruitment/:id` (extend existing)

**Missing features to add:**
- **Approve combination:** Set cvp_test_combinations.status → approved, set approved_rate, approved_at. When ≥1 combination approved: create cvp_translators record, create vendors record, send vendor-auth-invite, send V11 welcome email
- **Reject application:** Set rejection reason + email draft, queue rejection email (48hr window). Set can_reapply_after to 6 months
- **Intercept rejection:** Within 48hrs of rejection_email_queued_at, allow edit/cancel
- **Rate negotiation:** Send V9 offer email with negotiate_token, handle counter-offer endpoint
- **Waitlist:** Set status → waitlisted with waitlist_language_pair + notes, send V13 email

**Edge functions needed:**
- `cvp-approve-combination` — Approve single combination, create vendor account if first approval
- `cvp-reject-application` — Queue rejection with 48hr window
- `cvp-send-queued-rejections` — Hourly cron: send emails past 48hr window
- `cvp-send-negotiation` — Send rate negotiation offer
- `cvp-submit-counter` — Process vendor counter-offer (one allowed)
- `cvp-waitlist-application` — Set waitlist status + send email

---

## Business Rules (must follow)

1. All new tables use `cvp_` prefix
2. Never query CETHOS core tables (quotes, orders, customers) directly
3. Test tokens: 48hr expiry, one submission per token
4. Rejection window: 48hrs from `rejection_email_queued_at` (NOT created_at)
5. Approval granularity: per cvp_test_combinations row
6. Negotiation: ONE counter-offer per applicant
7. Reapplication cooldown: check can_reapply_after
8. Nudge suppression: 30-day window per nudge type via suppressed_until
9. AI fallback: failures → staff_review, never block pipeline
10. NEVER log or display payout_details in full — show payment method + masked info only

## Email Templates (Brevo)

| ID | Template | Trigger |
|----|----------|---------|
| V9 | Rate negotiation offer | Staff sends negotiation |
| V10 | Rate agreed | Negotiation resolved |
| V11 | Approved + welcome | First combination approved |
| V12 | Rejected | 48hr window expired |
| V13 | Waitlisted | Staff action |
| V14 | Profile nudge | Weekly cron |
| V15 | Cert expiry warning | Weekly cron |
| V16 | Language pairs check | Weekly cron |
| V17 | Request more info | Staff action (cog debriefing) |

## Tech Stack

- React + TypeScript (strict mode)
- Tailwind CSS
- Supabase JS client (anon key for frontend)
- Edge functions: Deno + Supabase service_role key
- All edge functions prefixed `cvp-` for admin operations

---

*End of CVP-VENDOR-PORTAL-ADMIN-PROMPT.md*
