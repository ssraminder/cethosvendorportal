# CVP — Go-Live Checklist

**Project:** CETHOS Vendor Portal — Recruitment intake
**Audience:** the person deploying + first staff reviewer
**Scope:** everything an applicant needs to touch, from landing on `join.cethos.com` to being onboarded as an active vendor.

---

## 1. Infrastructure that must exist before the first applicant clicks "Submit"

### Supabase (already set — verified via env probe)
- [x] Project `lmzoyezvsjgsxveoakdr`
- [x] Secrets set: `ANTHROPIC_API_KEY`, `BREVO_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- [x] Auto-injected: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] Storage bucket `cvp-applicant-cvs` (private, 10MB, PDF/DOC/DOCX only)
- [x] `cvp_*` tables migrated (applications, test combinations, test submissions, translators, test library, profile nudges, jobs, payments)
- [x] pg_cron jobs active: `cvp-send-queued-rejections-hourly` (@:07), `cvp-check-test-followups-hourly` (@:17)
- [ ] **To delete from Netlify (security hygiene):** `ANTHROPIC_API_KEY`, `BREVO_API_KEY`, `BREVO_SMS_SENDER`, `SUPABASE_SERVICE_ROLE_KEY`. They belong in Supabase, not Netlify.

### Brevo
- [x] Sender `Vendor Manager - CETHOS <recruiting@vendors.cethos.com>` verified (DKIM + DMARC configured)
- [x] 17 templates uploaded (IDs 21–37 mapped in `supabase/functions/_shared/brevo.ts`)
- [ ] **To do:** open each template in Brevo dashboard and send a test email to yourself to confirm rendering

### Netlify — recruitment app (`join.cethos.com`)
- [ ] Netlify site created, pointed at `apps/recruitment/` build
- [ ] Build command: `npm --prefix apps/recruitment run build`
- [ ] Publish dir: `apps/recruitment/dist`
- [ ] Env vars (Netlify → Site settings → Environment variables):
  - `VITE_SUPABASE_URL=https://lmzoyezvsjgsxveoakdr.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>`
  - `VITE_APP_URL=https://join.cethos.com`
  - `VITE_VENDOR_URL=https://vendor.cethos.com`
- [ ] Custom domain `join.cethos.com` mapped; DNS A/CNAME record pointed at Netlify
- [ ] SSL certificate issued

### Netlify — vendor portal (`vendor.cethos.com`) — *Phase 2, not blocking recruitment intake*
- [ ] Same pattern, `apps/vendor/`, `VITE_*` vars from [apps/vendor/.env.example](apps/vendor/.env.example)

### CETHOS portal (`portal.cethos.com`) — admin reviewer UI
- [x] `RecruitmentList.tsx` + `RecruitmentDetail.tsx` wired to new edge functions (`cvp-approve-application`, `cvp-request-info`, portal-side rejection queuing)
- [ ] Staff account with access to `/admin/recruitment` exists and can log in

---

## 2. Content that must be seeded before real applicants stop stalling

- [x] `cvp_test_library` has 2 placeholder rows (`is_active=false`): Farsi→EN Immigration, EN→ES Medical
- [ ] **Replace placeholder source text with real content** written by a qualified linguist, then flip `is_active=true`. Without this, every translator applicant lands at `no_test_available` and staff must manually review
- [ ] Seed additional language-pair × domain tests as volume demands. Priority order per [CVP-PROGRESS-LOG](docs/CVP-PROGRESS-LOG.md): FA/AR/PA/ZH/ES/UK/RU/TL/UR/VI → EN (certified translation), and EN → ES/FR-CA/DE/IT/PT-BR/JA/ZH/PL (medical translation + LQA)

---

## 3. End-to-end smoke test before flipping DNS

Run this with a throwaway email address you control:

1. [ ] Open `https://join.cethos.com/apply`
2. [ ] Fill the Translator form: name, email, country, 5+ years, Master's, language pair Farsi→English, domain Immigration, service Certified Translation with rate `0.18 per_page CAD`, upload a test CV, accept privacy
3. [ ] Submit. Expected:
   - Redirect to `/apply/confirmation` with an application number `APP-YY-NNNN`
   - V1 "We've received your application" email arrives within ~1 minute
   - Row in `cvp_applications` with `status='submitted'`
   - Row in `cvp_test_combinations` with `status='pending'`
   - CV file visible in Storage → `cvp-applicant-cvs/<uuid>/`
   - Within ~2 minutes: `ai_prescreening_result` populated, status advances (usually to `staff_review` or `prescreened`)
   - V2 (passed) or V8 (under review) email arrives
4. [ ] Log into `portal.cethos.com` → Admin → Recruitment → find the test application
5. [ ] Click **Approve** → expect:
   - `cvp-approve-application` returns `{ success: true }`
   - Row appears in `vendors` and `cvp_translators`
   - `cvp_applications.status = 'approved'` and `translator_id` set
   - V11 "Welcome to CETHOS" email arrives with a password-setup link
6. [ ] Repeat with another test submission, click **Reject** instead → expect:
   - Application moves to rejected, `rejection_email_status='queued'`
   - Visible 48hr intercept banner in admin detail view
   - After 48hr pg_cron runs, V12 rejection email arrives and status flips to `sent`
7. [ ] Repeat once more, click **Request More Info** → expect:
   - Prompt for details
   - V17 email arrives with details verbatim, including mailto reply link
   - `cvp_applications.status = 'info_requested'`, `staff_review_notes` populated

---

## 4. Known gaps at launch (can be fixed post-launch)

1. **Role selector still shows 2 options (Translator + Cognitive Debriefing).** The 3 planned additional roles (Interpreter, Transcriber, Clinician Reviewer) are scoped and ready to build but not yet shipped. If an interpreter applies today they have to pick "Translator" and note their actual role in the Notes field.
2. **Vendor portal password-setup page (`vendor.cethos.com/setup-password?token=…`) is not yet built.** `cvp-approve-application` issues the token, but the consuming page needs work on the vendor side. Until then, approved vendors get the welcome email but clicking the link 404s. **Mitigation for today:** only send the welcome email once the setup page is live, OR manually reset passwords via Supabase dashboard and share them out-of-band.
3. **Per-combination approval UI.** Staff can currently only approve/reject the whole application; per-combo approval is still pending.
4. **Negotiation UI.** V9/V10 templates are uploaded but there's no admin UI to propose rate counter-offers. Handle via email for now.
5. **Test library is 2 placeholders, both inactive.** Every translator applicant who passes pre-screen will be marked `no_test_available` until real tests are seeded.
6. **SMS (Twilio) swap from legacy ClickSend is deferred.** Vendor portal login still uses ClickSend; not a recruitment blocker.
7. **Workflow for past rejections**: the pg_cron only runs every hour, so V12 send is on-hour, not immediate at 48h + 0min. Acceptable.

---

## 5. Rollback / kill-switch

If something goes wrong post-launch:

- **Stop emails**: in Supabase dashboard, disable `cvp-send-queued-rejections-hourly` via `SELECT cron.unschedule('cvp-send-queued-rejections-hourly');`
- **Stop new applications**: toggle the recruitment Netlify site to Maintenance mode or redeploy the form page with a simple "Applications paused" message
- **Revert an edge function**: Supabase dashboard → Edge Functions → select function → Version history → Rollback
- **Undo an approval**: direct SQL — set `cvp_applications.status='staff_review'`, set `translator_id=null`, delete the `vendors` + `cvp_translators` + `vendor_auth` rows

---

## 6. Minimum success criteria for "we went live today"

- [ ] Real applicant submits an application at `join.cethos.com`
- [ ] They receive V1 confirmation within 2 minutes
- [ ] Application appears in `portal.cethos.com/admin/recruitment` for review
- [ ] Staff can approve, reject (with 48hr queue), or request info — each sends the right email
- [ ] No public-facing error messages leak stack traces or internal details

If all 5 boxes tick, recruitment intake is live.

---

## 7. Owner assignments for the remaining open items

| Item | Owner | Blocker? |
|---|---|---|
| Delete secrets from Netlify | You | No (hygiene) |
| Brevo test-send each template | You | Yes — validate rendering before any real applicant gets email |
| Netlify site for `join.cethos.com` + DNS | You | Yes — no URL, no launch |
| Netlify site for `vendor.cethos.com` + DNS | You | No (Phase 2) |
| Replace placeholder test content + activate | Linguist + you | Yes for translator approval path |
| Vendor portal `setup-password` page | Frontend dev | Yes once you send your first V11 |
| Interpreter / Transcriber / Clinician Reviewer forms | Me, next session | No — Translator + Cog are live |
| SMS Twilio swap | Me, next session | No |
| Per-combination approval UI | Me, next session | No |
| Negotiation UI | Me, next session | No |
