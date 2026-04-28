# Cethos Vendor Portal — Training Guide

This guide walks through every screen of the vendor portal, the flow
from application to active translator, and how Cethos CAT (the editor)
slots in once you have a job. Read top to bottom on day one.

> **Audience:** vendor applicants and active vendors (translators &
> reviewers). Staff/PM/admin users have a separate guide in the admin
> portal.

## Contents

1. [Logging in](#1-logging-in)
2. [Application flow (first-time vendors)](#2-application-flow)
3. [Vendor dashboard](#3-vendor-dashboard)
4. [Profile and rates](#4-profile-and-rates)
5. [Jobs queue](#5-jobs-queue)
6. [Opening a job — handoff to Cethos CAT](#6-opening-a-job)
7. [Working on a job (high level)](#7-working-on-a-job)
8. [Delivering a job — what QA does](#8-delivering-a-job)
9. [Invoices](#9-invoices)
10. [Common workflows](#10-common-workflows)

---

## 1. Logging in

![Vendor portal sign-in](/training/vendor/01-login.png)

The vendor portal lives at `https://vendor.cethos.com`. Sign-in is
**OTP-only** — there are no passwords.

1. Enter the email address you applied with (or that an admin issued
   your account against).
2. Click **Send code**. Within a few seconds you'll receive a 6-digit
   one-time code via email (sent through Mailgun, sender
   `noreply@reply.cethos.com`).
3. ![OTP entry](/training/vendor/02-login-otp.png)

   Type the 6 digits and click **Verify**.
4. You land on the [vendor dashboard](#3-vendor-dashboard).

The OTP expires in 10 minutes. If you don't receive it, check spam,
then click **Resend**. Still nothing? Email
`vendor-support@cethos.com` and we'll issue you a known code.

### Magic-link sign-in

When Cethos sends you something time-sensitive (a recruitment test
email, a job assignment), the email contains a **magic link** of the
form `https://tm.cethos.com/t/<token>` or
`https://vendor.cethos.com/?token=<token>`. Clicking it signs you in
automatically without needing the OTP. Tokens are single-use and
expire in 48 hours.

---

## 2. Application flow

If you're brand new, you start at the public application page and walk
through three steps before you can sign in:

![Application step 1 — basic info](/training/vendor/03-application-step1.png)

**Step 1 — Basic info.** Name, email, country, phone (optional), and
the **language pairs + domains** you can work in. We use this to scope
the recruitment tests we send you.

![Application step 2 — CV](/training/vendor/04-application-step2.png)

**Step 2 — CV upload.** PDF or DOCX, up to 5 MB. We OCR it and run an
AI prescreen that scores fit (0–100). Applicants scoring **40+** are
auto-approved for the General translation test.

![Application step 3 — review](/training/vendor/05-application-step3.png)

**Step 3 — Review and submit.** You'll see a summary of your
application. Click **Submit** and you'll get an email confirmation. We
auto-fire your General translation test within minutes for any
language pair where you scored well enough.

### Recruitment tests

When you receive a test email, click the link inside. It signs you in
and drops you straight into Cethos CAT with the test job loaded:

![Test email](/training/vendor/06-test-email.png)

The test is a real translation job (250 words or fewer). Translate it
to the best of your ability and click **Submit test** when done. You
have **48 hours** from when the test was sent. We grade tests with a
mix of automated scoring and human review (typically within 2 business
days).

Pass the General test and you're auto-approved for **Certified
Translation** in your domain pairs. To unlock additional domains
(Legal, Medical, Technical, etc.) you can request more tests from your
profile page.

---

## 3. Vendor dashboard

![Vendor dashboard](/training/vendor/07-dashboard.png)

The home screen after sign-in. Three cards across the top:

- **Active jobs** — count of jobs assigned to you and not yet delivered
- **In QA review** — jobs where you've clicked Deliver and are now
  resolving findings
- **Words this month** — billable word count in the current month

Below, a feed of recent activity (jobs assigned, tests graded, payments
processed) and links into the major sections.

---

## 4. Profile and rates

![Profile](/training/vendor/08-profile.png)

`/profile`

Your contact details, language pairs, certified domains, hourly /
per-word rates, and bank/PayPal payout info. Most of this is editable
inline; rates are subject to admin approval before they take effect.

Under **Domain certifications** you can request additional domain
tests if your account already has at least one certified domain.

Under **Documents** you can upload a refreshed CV or sworn-translator
certificate; admins are notified.

---

## 5. Jobs queue

![Jobs queue](/training/vendor/09-jobs-queue.png)

`/jobs`

Every job you've been assigned that isn't yet delivered. Columns:

- **Reference** — human-readable job ID
- **Pair** — source → target
- **Words** — billable count
- **Status** — `assigned` (untouched), `in_progress` (you've started),
  `qa_running`, `qa_review` (Cethos CAT findings awaiting your
  triage), `delivered` (final)
- **Deadline** — local time, urgent on top
- **Open editor →** — opens the job in Cethos CAT

Filter pills above the table narrow by status.

---

## 6. Opening a job

![Open in Cethos CAT](/training/vendor/10-open-editor.png)

Click **Open editor →** on any job. You're handed off to Cethos CAT at
`https://tm.cethos.com/translator/editor/<jobId>`. The handoff is
seamless — you don't need to sign in again; the same OTP session is
used.

If you ever lose the link, just go back to the vendor portal jobs
queue and click again — the editor URL is stable for the lifetime of
the job.

---

## 7. Working on a job

![Cethos CAT segment editor](/training/vendor/11-editor.png)

Inside Cethos CAT you have an XTM-style horizontal split:

- **Left column** — segment grid with source on the left and target on
  the right. Each row has a **Copy source** button and Save / Confirm
  buttons.
- **Right pane (tabbed)** — Matches (TM hits for the active row),
  Termbase (term hits), TM search (concordance), Glossary (term
  lookup).

Confirm each segment as you finish it. **100% TM matches are
auto-inserted** for you — review and confirm. Once every segment is
confirmed, the **Deliver** button in the top bar lights up.

For the full editor walkthrough (TM matches, terminology, machine
translation, keyboard shortcuts), read the **Translator Training
Guide** — it covers the editor in depth.

---

## 8. Delivering a job

![Deliver confirm dialog](/training/vendor/12-deliver-confirm.png)

When all segments are confirmed, click **Deliver**. We show you the
estimated QA cost (~$0.08 per 1,000 words for production jobs that
pass through Opus QA). Confirm to proceed.

The pipeline runs in two phases:

### Phase 1 — Deterministic QA

Pure-rule checks run instantly:

- Empty target / placeholder integrity / inline tag balance
- Number, date, URL, and email carry-through
- Length ratio and double-space sanity
- Forbidden-term hits from the job's glossary

### Phase 2 — Opus QA (AI review)

Claude Opus reviews every confirmed segment in batches with a cached
system prompt covering the language pair, glossary, style guide, and
**target-language punctuation conventions** (CJK full-width, French
NBSP before `: ; ? !`, Spanish opening `¡`/`¿`, Thai/Lao no terminal
period, Arabic `، ؛ ؟`, etc.).

Opus checks for:

- Accuracy, omissions, additions, mistranslations
- Terminology consistency across the job
- Register / tone match against the style guide
- Fluency — natural target-language phrasing
- Grammar, agreement, tense
- Locale conventions — number/date/currency formatting
- Punctuation conventions for the **target** language

### QA review pane

![QA review pane](/training/vendor/13-qa-review.png)

When the run finishes, the job status flips to `qa_review` and a
panel appears between the filter bar and the segment grid. For each
finding you can:

- **Accept** — applies Opus's suggested target. The TM is updated
  with the corrected version.
- **Edit & save** — type your own fix; same TM bump.
- **Reject** — keep your original. Optional note explaining why.

The **Confirm delivery** button is disabled until every **critical**
finding is resolved (accept / edit / reject). Major and minor
findings don't gate delivery.

When you click **Confirm delivery**, the job flips to `delivered` and
goes back to the PM. Done.

### Test jobs skip QA

Recruitment tests have a **Test** pill in the editor's top bar. The
Deliver button reads **Submit test** instead, and QA is skipped — the
recruitment grader handles your submission directly.

---

## 9. Invoices

![Invoices](/training/vendor/14-invoices.png)

`/invoices`

Cethos auto-generates a draft invoice the first day of each month
covering jobs you delivered in the prior month. Review the line items,
adjust any descriptions, and click **Submit invoice** to send it to
accounts payable.

Past invoices live in the same table with their payment status
(`pending`, `paid`, `disputed`).

If a job's word count looks off, contact the PM listed on the job
detail before submitting the invoice — they can fix it at the source.

---

## 10. Common workflows

### A. From application to first paid job

1. Submit your application at `https://vendor.cethos.com/apply`
2. Wait for the General test email (typically within minutes if your
   prescreen score is 40+)
3. Click the magic link in the test email → translate the test in
   Cethos CAT → **Submit test**
4. Wait for grading (usually within 2 business days)
5. If you pass, you're auto-approved for Certified Translation in
   your domains
6. Real jobs start arriving in your jobs queue
7. Open editor → translate → Deliver → resolve QA findings →
   Confirm delivery
8. Submit your monthly invoice on the 1st

### B. Recover a magic link you accidentally deleted

1. Go to `https://vendor.cethos.com/sign-in`
2. Enter your email → **Send code**
3. Use the OTP to sign in (no need for the magic link)
4. Open the relevant job from your jobs queue

### C. Request additional domain certification

1. Profile → **Domain certifications** → **Request test**
2. Pick the domain you want certified
3. The test email arrives within minutes
4. Take the test the same way as the General test
5. Pass → the domain is added to your certifications

### D. Resolve a critical QA finding you disagree with

1. In the QA review pane, click **Reject** on the finding
2. Type a note explaining your reasoning (e.g. "client style guide
   from this morning explicitly approves this term")
3. The finding is marked resolved with action `reject` — your
   original target is kept

---

## Need help?

- Stuck at OTP step: contact `vendor-support@cethos.com`
- Magic link expired: sign in normally with OTP and re-open from your
  jobs queue
- Can't find a job in your queue: it may have been reassigned;
  contact the PM listed in the original assignment email
- QA finding seems wrong: use **Reject** with a note rather than
  forcing accept — admins review reject notes before final delivery
