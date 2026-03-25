# Vendor Portal Audit Report — 2026-03-25

## Summary
- 5 issues found (2 critical, 3 minor)

## Critical Issues

### Issue 1: `acceptStep` does not pass `offer_id` — `apps/vendor/src/api/vendorJobs.ts:154`
**Current:**
```ts
export async function acceptStep(token: string, stepId: string): Promise<StepActionResponse> {
  // ...
  body: JSON.stringify({ step_id: stepId }),
```
**Should be:**
```ts
export async function acceptStep(token: string, stepId: string, offerId?: string | null): Promise<StepActionResponse> {
  // ...
  body: JSON.stringify({ step_id: stepId, offer_id: offerId ?? undefined }),
```
Callers (`AcceptConfirmModal` at `JobActionModals.tsx:37` and `JobDetailModal.tsx:606`) must also pass `step.offer_id`.

The edge function `vendor-accept-step` accepts `offer_id` as an optional parameter. Without it, the backend may accept the wrong offer if a vendor has multiple outstanding offers for the same step (unlikely but possible after re-offers).

### Issue 2: `declineStep` does not pass `offer_id` — `apps/vendor/src/api/vendorJobs.ts:169`
**Current:**
```ts
export async function declineStep(token: string, stepId: string, reason?: string): Promise<StepActionResponse> {
  // ...
  body: JSON.stringify({ step_id: stepId, reason: reason || null }),
```
**Should be:**
```ts
export async function declineStep(token: string, stepId: string, reason?: string, offerId?: string | null): Promise<StepActionResponse> {
  // ...
  body: JSON.stringify({ step_id: stepId, reason: reason || null, offer_id: offerId ?? undefined }),
```
Callers (`DeclineModal` at `JobActionModals.tsx:137` and `JobDetailModal.tsx:609`) must also pass `step.offer_id`.

Same reasoning as Issue 1 — the backend expects `offer_id` for precise targeting.

## Minor Issues

### Issue 3: Dead API function `getSourceFiles` calls old stub `vendor-get-source-files` — `apps/vendor/src/api/vendorJobs.ts:209-222`
**Current:** The function `getSourceFiles` calls edge function `vendor-get-source-files`, which is listed as a dead stub that must NOT be called.
**Impact:** The function is exported but never imported in any component. It is dead code. However, it references an old stub edge function and could be accidentally called.
**Should be:** Remove `getSourceFiles` from `vendorJobs.ts` entirely. Source files are now provided via `vendor-get-job-detail` in the `source_files[]` array.

### Issue 4: Old stub edge functions still deployed — `supabase/functions/`
The following old stub edge function directories still exist:
- `supabase/functions/vendor-accept-job/`
- `supabase/functions/vendor-decline-job/`
- `supabase/functions/vendor-upload-delivery/`
- `supabase/functions/vendor-get-source-files/`

These are dead stubs from the initial scaffold. While the frontend only calls `vendor-get-source-files` via the dead `getSourceFiles` API function (Issue 3), having these deployed creates confusion and a risk that future code accidentally targets them.
**Should be:** Delete these edge function directories and undeploy them from Supabase.

### Issue 5: No specific handling for HTTP 410 (Gone) when accepting expired offers — `apps/vendor/src/components/jobs/JobActionModals.tsx:37-47`
**Current:** The `AcceptConfirmModal` catches errors generically. If the backend returns 410 (Gone) for an expired offer, the user sees a generic "Failed to accept job" message.
**Should be:** Check for 410 status and show a specific message like "This offer has expired" with a prompt to refresh the job list. The modal does disable the accept button when `expired` is detected client-side (in `JobDetailModal.tsx:581`), but the expiry check is client-only and may be stale if the modal has been open for a while.

## Feature Completeness

- [x] Job board with 3 tabs (offered, active, completed)
- [x] Accept flow (confirmation dialog, refetch after success)
- [x] Decline flow (modal with reason textarea, refetch after success)
- [x] Deliver flow (drag-and-drop, multi-file, notes, file type/size validation)
- [x] Job detail modal with rich data (calls `vendor-get-job-detail`)
- [x] File download with signed URLs (download + PDF preview)
- [x] Rate and language pair display (on cards and detail modal)
- [x] Offer expiry handling (badge on cards, countdown in detail, accept disabled when expired)
- [x] Empty states (meaningful messages for all 3 tabs)
- [x] Error handling (API errors shown as inline alerts and toasts)
- [x] Badge counts (shown on tab labels, offered tab has colored indicator, update after actions)
- [x] Rush badge displayed on cards and detail modal
- [x] Revision flow (rejection reason shown, "Deliver Revision" button, previous delivery files)
- [x] Workflow position displayed in detail modal
- [x] Timeline displayed in detail modal (offered, accepted, started, delivered, approved)
- [x] Volume summary with expandable per-file breakdown
- [x] Reference files section in detail modal
- [x] Previous step files section (blue-tinted, for multi-step workflows)
- [x] Auth uses `vendor_session_token` from localStorage (not `sb-access-token`)
- [x] Bearer token passed in headers for all API calls
- [x] Multipart deliver does NOT set Content-Type manually (correct)
- [x] File type restrictions enforced (`.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.txt`, `.html`, `.rtf`, `.jpg`, `.png`, `.tiff`, `.zip`, `.xliff`)
- [x] File size indicator shown per file in deliver modal
- [x] Dashboard shows offered jobs preview, stats, profile completeness, availability toggle

## Fix Priority

1. **Critical:** Pass `offer_id` in `acceptStep` and `declineStep` API calls and update all callers
2. **Critical:** Pass `offer_id` from `DeclineModal` and `AcceptConfirmModal` components
3. **Minor:** Remove dead `getSourceFiles` function from `vendorJobs.ts`
4. **Minor:** Delete old stub edge functions from `supabase/functions/`
5. **Minor:** Add specific 410 (Gone) error handling in `AcceptConfirmModal`
