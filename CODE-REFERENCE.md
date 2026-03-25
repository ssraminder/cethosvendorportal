# CETHOS Translation Platform — Claude Code Reference

> **Read this file before every task.** It contains architecture, conventions, auth patterns, and API references for the entire platform.

-----

## Project Overview

CETHOS Translation Services is a certified translation platform with four portals:

|Portal                 |URL                       |Stack             |Purpose                                                         |
|-----------------------|--------------------------|------------------|----------------------------------------------------------------|
|**Customer Quote Flow**|portal.cethos.com         |Builder.io + React|Customers submit docs, get quotes, pay                          |
|**Admin Panel**        |portal.cethos.com/admin   |Builder.io + React|Staff manages quotes, orders, vendors, workflows                |
|**Vendor Portal**      |vendor.cethos.com         |Builder.io + React|Freelance translators manage profile, accept jobs, deliver files|
|**Customer Portal**    |portal.cethos.com/customer|Builder.io + React|Customers track orders, review drafts, download files           |

**Backend:** Supabase (project `lmzoyezvsjgsxveoakdr`) — PostgreSQL, Edge Functions (Deno), Storage, Realtime
**Hosting:** Netlify (project `cethosappfigma`)
**Frontend:** Builder.io (React components with Tailwind CSS)

-----

## Auth Patterns (CRITICAL — read carefully)

### Admin Panel

- Custom OTP login via `send-staff-otp` / `verify-staff-otp` edge functions
- Session stored in `localStorage` as `sb-access-token`
- Edge functions use `authenticated` role with Bearer token from localStorage
- Server-side uses `SUPABASE_SERVICE_ROLE_KEY`
- **RLS trap:** `authenticated` role must be explicitly covered in RLS policies. `service_role` bypasses RLS only server-side.
- PostgREST silent failures: DELETE/INSERT/UPDATE blocked by RLS return 200 with no error — always verify data changed.

### Vendor Portal

- Session token auth via `vendor_sessions` table
- Token from `localStorage.getItem("vendor_session_token")`
- Passed as `Authorization: Bearer {token}` header
- Validated server-side: `vendor_sessions WHERE session_token = X AND expires_at > NOW()` → returns `vendor_id`
- All vendor edge functions use `verify_jwt: false` with manual session validation

### Customer Portal

- OTP login via `send-customer-login-otp` / `verify-customer-login-otp`
- Session stored similarly to admin

-----

## Supabase Edge Functions — Conventions

- Import pattern: `import { serve } from "https://deno.land/std@0.208.0/http/server.ts"`
- Supabase client: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"`
- Stripe: `import Stripe from "npm:stripe@14.21.0"` (Deno npm specifier)
- CORS: Always include `corsHeaders` and handle OPTIONS preflight
- All workflow/vendor functions use `verify_jwt: false`
- Functions support both GET (query params) and POST (JSON body) where noted
- Response format: `{ success: true, ...data }` or `{ success: false, error: "message" }`

-----

## Database — Key Tables

### Core Flow

|Table                  |Purpose                                      |
|-----------------------|---------------------------------------------|
|`quotes`               |Customer quote requests                      |
|`quote_files`          |Uploaded source files (bucket: `quote-files`)|
|`ai_analysis_results`  |AI classification + word/page counts per file|
|`quote_document_groups`|Grouped pricing (source of truth for pricing)|
|`orders`               |Confirmed orders (from paid quotes)          |
|`order_documents`      |Per-document tracking within an order        |

### Workflow Engine

|Table                    |Purpose                                                    |
|-------------------------|-----------------------------------------------------------|
|`workflow_templates`     |Reusable workflow definitions (9 templates, 33 steps)      |
|`workflow_template_steps`|Steps within templates                                     |
|`order_workflows`        |Workflow instance applied to a specific order              |
|`order_workflow_steps`   |Step instances with vendor assignment, status, files, rates|
|`vendor_step_offers`     |Individual offers to vendors (supports multi-offer)        |

### Vendors

|Table                  |Purpose                                                                        |
|-----------------------|-------------------------------------------------------------------------------|
|`vendors`              |1,463 vendors (744 active). Profile, location, rating, native_languages (JSONB)|
|`vendor_language_pairs`|5,186 LP records per vendor                                                    |
|`vendor_rates`         |764 rate records (service + optional LP specific)                              |
|`vendor_payment_info`  |Payment method, currency                                                       |
|`vendor_sessions`      |Auth sessions                                                                  |

### Services

|Table     |Purpose                                                                                                                                        |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------|
|`services`|45 services in 6 categories. Key: certified_translation (`2858455d`), standard_translation (`cad6e69a`), review (`7ff4045b`), mtpe (`180233a2`)|

### Settings

|Table         |Purpose                                                                                 |
|--------------|----------------------------------------------------------------------------------------|
|`app_settings`|Key-value config. Columns: `setting_key`, `setting_value`, `setting_type`, `description`|

-----

## Pricing Formula (Certified Translation)

```
billable_pages = CEIL((words / 225) × complexity_multiplier × 10) / 10   (minimum 1.0)
line_total = CEIL(billable_pages × base_rate × language_multiplier / 2.5) × 2.5
```

- `base_rate_per_page`: 65.00
- `words_per_page`: 225
- Complexity: easy=1.00, medium=1.15, hard=1.25
- `recalculate_quote_totals()` is the single entry point for syncing all pricing

**Vendor pricing model:** LSP-controlled. Staff sets the rate when assigning vendors. `vendor_rates` are reference data only. Margin = `(customer_subtotal - vendor_total) / customer_subtotal × 100`. Warning at 30% (`min_vendor_margin_percent` in app_settings), not a hard block.

-----

## Workflow Engine — Key Concepts

### Step Status Flow

```
pending → offered (via offer_vendor/offer_multiple)
pending → in_progress (via direct_assign)
offered → accepted (vendor accepts) → in_progress → delivered → approved
delivered → revision_requested → in_progress (loop)
pending → skipped (optional steps)
cancelled → pending (reactivate)
```

### Vendor Offer Flow

```
sent → accepted (others retracted) | declined | expired | retracted
```

### Edge Function Actions (`update-workflow-step` v4)

|Action              |Purpose                                        |
|--------------------|-----------------------------------------------|
|`direct_assign`     |Assign vendor, skip offer → `in_progress`      |
|`offer_vendor`      |Single offer → creates `vendor_step_offers` row|
|`offer_multiple`    |Multi-offer → N rows, first accept wins        |
|`retract_offers`    |Cancel all active offers → `pending`           |
|`lookup_vendor_rate`|Read-only rate lookup for UI pre-fill          |
|`change_status`     |Status transitions                             |
|`skip_step`         |Skip optional steps                            |
|`update_config`     |Update assignment mode, instructions, etc.     |

### Step Management (`manage-order-workflow-steps` v2)

|Action                   |Purpose                              |
|-------------------------|-------------------------------------|
|`add_step`               |Insert step at position, renumber    |
|`remove_step`            |Delete pending/skipped step, renumber|
|`reorder_step`           |Move pending step                    |
|`list_available_services`|Return 45 services for UI            |

### Auto-advance + File Handoff

When a step is approved with `auto_advance = true`:

1. Copy `delivered_file_paths` → next step's `source_file_paths`
1. If next step is internal/customer → auto-start
1. If next step is vendor → stays pending
1. If no next step → workflow complete, write to `order_documents.translated_file_path`

-----

## Storage Buckets

|Bucket                 |Public|Purpose                          |
|-----------------------|------|---------------------------------|
|`quote-files`          |Yes   |Customer-uploaded source files   |
|`quote-reference-files`|No    |PM-uploaded reference materials  |
|`vendor-deliveries`    |No    |Vendor file uploads (100MB limit)|
|`vendor-certifications`|No    |Vendor credential documents      |
|`message-attachments`  |No    |Message file attachments         |
|`ocr-uploads`          |No    |OCR batch files                  |
|`invoices`             |No    |Generated invoice PDFs           |

-----

## Vendor Portal Edge Functions

|Function               |Version|Auth   |Purpose                                                            |
|-----------------------|-------|-------|-------------------------------------------------------------------|
|`vendor-get-profile`   |v5     |session|Full profile with LP, rates, payment, native_languages             |
|`vendor-update-profile`|v9     |session|Update profile fields including native_languages                   |
|`vendor-manage-rates`  |v5     |session|Vendor self-service rate CRUD with LP batch insert                 |
|`vendor-get-jobs`      |v3     |session|Job board: list by tab. Offered tab reads from `vendor_step_offers`|
|`vendor-get-job-detail`|v1     |session|Full job detail with signed file URLs, volume breakdown            |
|`vendor-accept-step`   |v2     |session|Accept offer, retract competing offers                             |
|`vendor-decline-step`  |v2     |session|Decline offer, revert step if no other offers                      |
|`vendor-deliver-step`  |v1     |session|Multipart upload to `vendor-deliveries` bucket                     |

-----

## Admin Workflow Functions

|Function                     |Version|Purpose                                                                                   |
|-----------------------------|-------|------------------------------------------------------------------------------------------|
|`get-order-workflow`         |v4     |Returns workflow + steps + offers[] + order_financials. Supports GET and POST.            |
|`update-workflow-step`       |v4     |All step actions (assign, offer, retract, status change, etc.)                            |
|`assign-order-workflow`      |v2     |Apply template to order                                                                   |
|`manage-order-workflow-steps`|v2     |Add/remove/reorder steps on an order                                                      |
|`manage-workflow-templates`  |v1     |Template CRUD                                                                             |
|`find-matching-vendors`      |v2     |Advanced vendor search with filters (LP, service, native lang, rating, rate, availability)|

-----

## Key Conventions

1. **Plan before implementing** — always investigate schema, RLS, and data before writing code
1. **Manual first, automation second** — build reliable manual workflows before adding automation
1. **Verify RLS** — PostgREST silent failures are common. Always test that operations actually affected data.
1. **Pricing source of truth**: `ai_analysis_results.line_total` → `quote_document_groups.line_total` → `quotes.subtotal`. Never recalculate client-side.
1. **Vendor rates are reference only** — staff controls the actual offer rate
1. **Edge functions**: use `verify_jwt: false` with manual auth for vendor/admin functions
1. **File paths**: quote files in `{quote_id}/filename.pdf`, vendor deliveries in `{order_id}/{step_id}/{timestamp}_filename.ext`
1. **Test against real data** — use actual quote/order numbers, not synthetic test data

-----

## Current Pending Items

|Item                                                              |Priority|
|------------------------------------------------------------------|--------|
|Order Summary pricing display bug (frontend double-counts)        |P1      |
|Fix `ocr-process-next` broken cron URL                            |P2      |
|Wire `screenshot_rate` into pricing pipeline                      |P3      |
|XTRF customer invoice resync for 2024 revenue                     |P2      |
|QuickBooks sync pipeline                                          |P3      |
|Retroactive XTRF invoice bulk fix (175 projects, $21,811.78)      |P2      |
|Vendor Portal Phase 2: file preview, doc details, revision context|P2      |
|Vendor Portal Phase 3: negotiate, messaging, bulk accept, calendar|P3      |
|Offer expiry cron (auto-expire past `expires_at`)                 |P3      |
