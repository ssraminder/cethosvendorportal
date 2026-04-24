-- Seed: Vendor Management training (11 lessons)
-- Idempotent: upsert by (training.slug, lesson.slug)
-- Source of truth: docs/TRAINING-VENDOR-MANAGEMENT-CURRICULUM.md
-- Date: 2026-04-22

INSERT INTO cvp_trainings (slug, title, description, category, is_active)
VALUES (
  'vendor-management',
  'Vendor Management',
  'Run the applicant-to-active-vendor pipeline end-to-end: recruitment queue, application review, testing, assessment, negotiation, approval, vendor directory, messaging, and profile health.',
  'vendor-management',
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Upsert lessons via a single VALUES list joined to the training id.
WITH t AS (SELECT id FROM cvp_trainings WHERE slug = 'vendor-management')
INSERT INTO cvp_training_lessons (training_id, order_index, slug, title, body_markdown, screenshot_paths, key_rules, route_reference, estimated_minutes)
SELECT t.id, v.order_index, v.slug, v.title, v.body_markdown, v.screenshot_paths, v.key_rules, v.route_reference, v.estimated_minutes
FROM t, (VALUES
  (
    1,
    'orientation',
    'Orientation: the Vendor Management pipeline',
    E'Welcome. This training walks you through every feature a **Vendor Manager** uses day-to-day.\n\nYou''ll learn the full applicant-to-active-vendor pipeline plus the three surface areas you manage:\n\n- **Recruitment** — applicants enter here, flow through pre-screen → testing → assessment → negotiation → staff decision.\n- **Vendor Directory** — once approved, vendors live here. You maintain profile health, rates, payout info, and deactivation.\n- **Messaging & Tasks** — inbound vendor messages and the unassigned-step queue of work items.\n\nThroughout, remember:\n- AI decisions are **drafts**; staff always has override authority.\n- If an AI call fails, the item routes to `staff_review` automatically. Never block the pipeline.\n- Several timers run in the background (test token expiry, rejection send, nudge suppression) — see the cheat sheet in the final lesson.\n\nWhen you''re ready, click **I''ve read this** and move to Lesson 2.',
    ARRAY['/training/vendor-management/01-orientation.png'],
    '[{"rule":"Never query CETHOS core tables (quotes/orders/customers) directly.","reason":"All cross-system access goes through edge functions only — this isolates the vendor portal from the main app."},{"rule":"AI is advisory; staff decision is final.","reason":"All AI scoring can be overridden. The 48-hour rejection intercept exists precisely so staff can catch and correct AI errors."}]'::jsonb,
    NULL,
    5
  ),
  (
    2,
    'recruitment-queue',
    'Recruitment queue',
    E'Open **`/admin/recruitment`**. This is your home base.\n\n## The 4 tabs\n\n- **Needs Attention** — action required from you today:\n  - AI-flagged borderline scores (65–79)\n  - Rejections still inside the 48-hour intercept window\n  - Out-of-band counter-offers (more than 15% above initial offer)\n- **In Progress** — applications in test or negotiation, waiting on the applicant.\n- **Decided** — approved, rejected, waitlisted, archived.\n- **Waitlist** — grouped by language pair; bulk-invite when you have supply gaps.\n\n## Filters & search\n\nSearch matches **name**, **email**, or **application number** (e.g. `APP-26-0047`). You can sort by date, name, or pre-screen score.\n\n## Per-row columns\n\nName · Role · Language pairs · Pre-screen score · AI recommendation · Status · Days since last activity · Action.',
    ARRAY['/training/vendor-management/02-recruitment-queue.png'],
    '[{"rule":"Clear Needs Attention first, every day.","reason":"Items in this tab have a ticking clock — rejection intercepts expire and out-of-band counter-offers block the applicant."}]'::jsonb,
    '/admin/recruitment',
    7
  ),
  (
    3,
    'application-detail-applicant-prescreen',
    'Application detail: Applicant panel & AI pre-screen',
    E'Click any row in the queue to open `/admin/recruitment/:id`. Layout is **3 panels**.\n\n## Left panel — Applicant\n\nIdentity, education, certifications (with expiry dates), years of experience, CAT tools, rate expectation, LinkedIn URL. Work samples render inline (PDF/DOCX viewer). For translator role, you''ll also see an **AI-assigned tier** dropdown with override.\n\n## Centre panel — AI pre-screen (when status is `prescreened`)\n\n- Score breakdown by dimension (demand match, cert quality, experience, sample quality, rate assessment).\n- Red flags list.\n- Routing decision with override button.\n- If AI failed: yellow **AI fallback — staff review** banner. Proceed manually.\n\n## Tier override\n\nTranslator-only. Writes `tier_override_by` and `tier_override_at` — permanent audit. Cognitive-debriefing, interpreter, transcriber, and clinician-reviewer roles don''t have tiers.',
    ARRAY['/training/vendor-management/03-application-detail-left.png','/training/vendor-management/03-application-detail-prescreen.png'],
    '[{"rule":"Tier override is translator-only.","reason":"Other roles do not have a tier structure — the column is null for them."},{"rule":"When you see AI-fallback, do not wait — decide manually.","reason":"The pipeline timer keeps running. A stalled application will hit reminder emails and look unresponsive to the applicant."}]'::jsonb,
    '/admin/recruitment',
    8
  ),
  (
    4,
    'test-stage',
    'Test stage: sending tests & monitoring tokens',
    E'When status advances to `test_pending` or `test_sent`, the centre panel shows **per-combination status cards**. Each card = one row in `cvp_test_combinations` = one language pair × domain × service.\n\nCard shows: **token status** (not sent / sent / in progress / submitted / assessed), **expiry countdown**, and a **Send test now** button when missing.\n\n## Rules that matter\n\n- **Token expires 48 hours after issuance** (`cvp_test_submissions.token_expires_at`).\n- **One submission per token.** Expired? Issue a new one — this creates a new `cvp_test_submissions` row; the old row stays for audit.\n- Reminders at day 2, day 3, day 7 fire automatically via the `cvp-check-test-followups` cron (runs hourly at :17).\n\nIf an applicant emails you saying "the link doesn''t work," 90% of the time the token expired. Issue a new one from this panel.',
    ARRAY['/training/vendor-management/04-test-stage-cards.png'],
    '[{"rule":"Token expiry = 48h from creation.","reason":"Hard cutoff to keep test data fresh; measured from token issuance, not from email send."},{"rule":"One submission per token.","reason":"Audit integrity — we want one submission = one token. Resending creates a new submission row and a new token."}]'::jsonb,
    '/admin/recruitment',
    6
  ),
  (
    5,
    'assessment-viewer',
    'Assessment viewer & MQM scoring',
    E'When a test is submitted and assessed, the centre panel switches to the **assessment viewer** — 3 columns side-by-side:\n\n1. **Source** (what the applicant was given)\n2. **Submission** (what they sent back)\n3. **Reference** (our gold translation)\n\nBelow it, the **MQM error table** covers 5 dimensions: accuracy, fluency, style, terminology, locale. Each row: severity · weight · Claude''s comment. AI summary lists strengths and errors.\n\n## Scoring bands\n\n| AI score | Auto-route |\n|----------|-----------|\n| ≥ 80 | `approved` (pending staff ack) |\n| 65–79 | `staff_review` (Needs Attention) |\n| < 65 | `rejection_queued` (48h intercept) |\n\nYou can **adjust any dimension score** — your save overrides the AI value. The AI score is retained for audit.',
    ARRAY['/training/vendor-management/05-assessment-viewer.png'],
    '[{"rule":"Staff score overrides AI score but AI score is retained.","reason":"Audit trail — we want to see how often staff disagreed with AI to tune the rubric."},{"rule":"Only LQA tests use the MQM table.","reason":"Translation tests use the 3-column viewer + rubric scoring; MQM applies to Linguistic Quality Assurance tests specifically."}]'::jsonb,
    '/admin/recruitment',
    8
  ),
  (
    6,
    'negotiation',
    'Negotiation flow',
    E'When a test is approved but the applicant''s rate is outside our band, status becomes `negotiation`. The centre panel renders a **turn-by-turn timeline**:\n\n1. Our initial offer (AI-generated based on tier + pair + domain).\n2. Applicant''s counter (if any).\n3. Our response.\n\nData source: `cvp_applications.negotiation_log` (JSONB array). Each turn has `{ actor, rate, message, at }`.\n\n## Rules\n\n- **Applicant may counter exactly ONCE.** The `negotiate_token` is invalidated the moment they submit. A second attempt returns a "token used" error.\n- If their counter is **>15% above our offer**, the application surfaces in Needs Attention for your decision.\n- `final_agreed_rate` is what we write into `cvp_translators.approved_combinations` when we approve. Double-check before clicking Approve.',
    ARRAY['/training/vendor-management/06-negotiation-timeline.png'],
    '[{"rule":"One counter-offer per applicant.","reason":"Protects the pipeline from endless back-and-forth; signals a hard boundary."},{"rule":"Check final_agreed_rate before approving.","reason":"This is the rate the vendor will actually get paid at — typos here become invoicing disputes later."}]'::jsonb,
    '/admin/recruitment',
    6
  ),
  (
    7,
    'staff-decisions',
    'Staff decisions: Approve / Reject / Waitlist / Request Info',
    E'The **right panel** holds your action buttons:\n\n- **Approve** → runs `cvp-approve-application` edge function. Creates `cvp_translators` row (if first approved combination), writes per-combination rate, fires invite email.\n- **Reject** → queues an AI-drafted rejection email. Sets `rejection_email_queued_at` = now. 48 hours later, `cvp-send-queued-rejections` cron sends it.\n- **Waitlist** → sets `waitlist_language_pair`; moves application to Waitlist tab.\n- **Request More Info** → runs `cvp-request-info`; sends a templated follow-up.\n\n## The rejection editor\n\nInside the 48-hour window you can:\n- Edit the draft body.\n- **Cancel Send** (un-queues the email entirely — status returns to review).\n\nA countdown timer is always visible — once it hits zero, the email goes out automatically.\n\n## Approval is per-combination\n\nEach `cvp_test_combinations` row is approved independently. A vendor account is created the moment the **first** combination flips to approved.\n\n## Reapplication cooldown\n\nIf the applicant''s email already has a `can_reapply_after` date in the future, they are auto-rejected with a polite reminder. Check this when setting a cooldown on a fresh rejection.\n\n## Waitlist bulk invite\n\nUnder the Waitlist tab, select everyone waiting on, say, en→fr, and bulk-invite when demand opens up.',
    ARRAY['/training/vendor-management/07-staff-actions.png','/training/vendor-management/07-rejection-editor.png','/training/vendor-management/07-waitlist.png'],
    '[{"rule":"The 48-hour intercept starts at rejection_email_queued_at, not at created_at.","reason":"This is the column the cron checks. Measuring from created_at would send stale rejections for applications that sat in review for weeks."},{"rule":"Approval is per-combination.","reason":"A vendor can be qualified for es→en legal but still in review for fr→en medical — they get one account the moment ONE combo is approved."},{"rule":"Reapplication cooldown blocks resubmissions.","reason":"Prevents serial reapplications from overwhelming the queue after a rejection."}]'::jsonb,
    '/admin/recruitment',
    10
  ),
  (
    8,
    'vendor-directory',
    'Vendor Directory',
    E'Open **`/admin/vendors`**. This is the roster of everyone who''s been approved.\n\n## Columns & filters\n\nName · email · phone · status (`active` / `inactive` / `pending_review` / `suspended` / `applicant`) · vendor_type · language pairs · rating · total projects · last project date.\n\nSearch filters across the list; the status dropdown narrows by status. Pagination: 25 per page.\n\n## Status flags (icons on the row)\n\n- 🔴 **Payout missing** — `payout_details` is null.\n- 🟡 **Profile <80%** — `profile_completeness` below threshold.\n- 🟠 **Cert expiring** — a certification expiry is within 30 days.\n- ⚪ **Inactive 90+ days** — no activity, internal flag only (not shown to the vendor).\n\n## + New Vendor\n\nRare — most vendors come through the recruitment pipeline. Use this only when onboarding someone manually (e.g. you signed them offline).',
    ARRAY['/training/vendor-management/08-vendor-list.png','/training/vendor-management/08-vendor-new.png'],
    '[{"rule":"Never log payout_details anywhere.","reason":"Console, error messages, Sentry — it is PII. If a flow breaks while touching payout, redact the column."},{"rule":"Prefer the recruitment pipeline over manual vendor creation.","reason":"Manual creation bypasses AI pre-screening and testing — only use it for edge cases."}]'::jsonb,
    '/admin/vendors',
    7
  ),
  (
    9,
    'vendor-detail-tabs',
    'Vendor Detail tabs',
    E'Click a row in the directory to open `/admin/vendors/:vendorId`. Six tabs across the top.\n\n1. **Profile** — name, email, phone, country, city, status, internal notes.\n2. **Languages** — source/target pairs and proficiency.\n3. **Rates** — per-pair / per-service pricing.\n4. **Payment** — bank/payout info, invoice history.\n5. **Auth** — invitation sent at, last reminder sent at, reminder count, acceptance timestamp. This is where you **resend an invite** if the vendor hasn''t activated their account.\n6. **Jobs** — history of assigned jobs with statuses.\n\n## Rules\n\n- **Payout details are PII.** Never log them. If something breaks, redact.\n- **Don''t resend invites more than once per 24h.** Check `last_reminder_sent_at` on the Auth tab first — spamming reminders is a good way to get your emails flagged.',
    ARRAY['/training/vendor-management/09-profile.png','/training/vendor-management/09-languages.png','/training/vendor-management/09-rates.png','/training/vendor-management/09-payment.png','/training/vendor-management/09-auth.png','/training/vendor-management/09-jobs.png'],
    '[{"rule":"Payout details redacted in all logs.","reason":"Banking info is PII; leakage in Sentry or console is a compliance incident."},{"rule":"Max 1 invite resend per 24h.","reason":"Protects email sender reputation and avoids annoying the vendor."}]'::jsonb,
    '/admin/vendors',
    10
  ),
  (
    10,
    'messaging-tasks-nudges',
    'Messaging, Tasks & Profile Nudges',
    E'Two more surfaces you''ll use daily.\n\n## Messages (`/admin/messages`)\n\nInbound/outbound vendor messages. Red badge in sidebar = unread count. Same interface as a simple mailbox.\n\n## Tasks (`/admin/tasks`)\n\nThe **unassigned-step queue**: work items from the order workflow that need a staff member to pick them up. If something has your fingerprint, claim it. Don''t double-claim — a task belongs to one staff member at a time.\n\n## Profile Nudges (read-only background system)\n\nThe `cvp_profile_nudges` table logs every auto-nudge sent to a vendor:\n- `payout_missing`\n- `profile_incomplete`\n- `certification_expiry`\n- `languages_stale`\n- `inactive_internal`\n\nNudges are sent by the `cvp-send-profile-nudges` cron. **Suppression rule:** the same nudge type is never sent to the same vendor within 30 days (`suppressed_until`). If you manually nudge a vendor, the same rule applies — check the history on their profile first.\n\nRepeated, unresolved nudges (escalation_level 2 or 3) should get a personal email or call from you.',
    ARRAY['/training/vendor-management/10-messages.png','/training/vendor-management/10-tasks.png'],
    '[{"rule":"Nudge suppression: 30 days per nudge type per vendor.","reason":"Prevents harassment; forces escalation to a human when auto-nudges aren''t working."},{"rule":"Tasks belong to one staff member at a time.","reason":"Avoids duplicate work and conflicting updates on the same item."}]'::jsonb,
    '/admin/messages',
    8
  ),
  (
    11,
    'cheat-sheet',
    'Business rules cheat sheet & handoff',
    E'## The 11 rules, on one page\n\n| # | Rule | Enforced by |\n|---|------|-------------|\n| 1 | All new tables use the `cvp_` prefix | code convention + review |\n| 2 | Never query CETHOS core tables directly | code review |\n| 3 | Test token expiry = 48h from creation | `cvp_test_submissions.token_expires_at` |\n| 4 | One submission per token | `UNIQUE (token)` + single-use check |\n| 5 | Rejection window = 48h from `rejection_email_queued_at` | `cvp-send-queued-rejections` hourly cron |\n| 6 | Approval is per-combination; vendor created on first approved combo | `cvp-approve-application` edge function |\n| 7 | One counter-offer per applicant | `negotiate_token` invalidated on use |\n| 8 | Reapplication cooldown via `can_reapply_after` | submission handler |\n| 9 | Nudge suppression: 30 days per nudge type | `cvp_profile_nudges.suppressed_until` |\n| 10 | AI failure → `staff_review` | fallback logic in every AI call |\n| 11 | Never log `payout_details` | code review + runtime redaction |\n\n## Who does what (staff roles)\n\n- **super_admin** — full access; only role that can flip other staff roles.\n- **admin** — full recruitment + vendor flows; can assign trainings like this one.\n- **senior_reviewer** — recruitment decisions, tier overrides, approvals.\n- **reviewer** — recruitment review up to staff_review hand-off; cannot approve alone.\n- **accountant** — read-only on vendor payout + invoices, no recruitment access.\n\n## What to do next\n\n1. Keep this tab open when you''re working your first real queue — glance back at rules you''re unsure about.\n2. If anything in your real workflow contradicts these rules, flag it before acting. The rules are load-bearing.\n\nClick **I''ve read this** to complete the training.',
    ARRAY['/training/vendor-management/11-cheat-sheet.png'],
    '[{"rule":"If reality contradicts the cheat sheet, flag it before acting.","reason":"The rules are enforced in code and cron jobs — if something feels off, the safer move is to pause and escalate rather than work around it."}]'::jsonb,
    NULL,
    6
  )
) AS v(order_index, slug, title, body_markdown, screenshot_paths, key_rules, route_reference, estimated_minutes)
ON CONFLICT (training_id, slug) DO UPDATE SET
  order_index = EXCLUDED.order_index,
  title = EXCLUDED.title,
  body_markdown = EXCLUDED.body_markdown,
  screenshot_paths = EXCLUDED.screenshot_paths,
  key_rules = EXCLUDED.key_rules,
  route_reference = EXCLUDED.route_reference,
  estimated_minutes = EXCLUDED.estimated_minutes;
