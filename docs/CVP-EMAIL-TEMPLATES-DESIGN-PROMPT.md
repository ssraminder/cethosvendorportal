# Claude Design — CETHOS Vendor Portal Email Templates

Design **17 transactional email templates** for the CETHOS Vendor Portal. All templates are HTML emails sent via Brevo's transactional API. Each template uses Brevo's Mustache-style parameter syntax: `{{ params.paramName }}`.

Deliver each template as its own complete HTML email. They should feel like they belong to the same family — consistent structure and tone across all 17 — but each serves a distinct purpose.

## Shared structure every template must follow

1. **Header** — "CETHOS Vendor Portal" wordmark at the top, centered.
2. **Greeting** — "Hi {{ params.fullName }},"
3. **Body** — the specific content for that template (detailed below).
4. **Primary action** — one single clear call-to-action button where applicable, with the URL shown below the button as plain text fallback.
5. **Signature** — "— The CETHOS Team"
6. **Footer** — three lines, small: (a) "You're receiving this because you applied to join the CETHOS vendor network." *or* for active vendors: "You're receiving this as a member of the CETHOS vendor network.", (b) a contact line "Questions? Reply to this email or write to recruiting@cethos.com.", (c) a legal line "CETHOS Translation Services · Calgary, Canada".

Application number, when present, should appear as a small monospace reference label near the top of the body (e.g. "Application #{{ params.applicationNumber }}") — not in the subject line copy, but visible in-email.

Every template must be mobile-responsive and render correctly in plain-text fallback.

---

## Template-by-template content

### V1 — Application Received
**Purpose:** confirm a new applicant's submission was received.
**Params:** `fullName`, `applicationNumber`, `roleType` (either "Translator / Reviewer" or "Cognitive Debriefing Consultant").
**Subject line:** "We've received your application — {{ params.applicationNumber }}"
**Body content:**
- Opening line confirms we received their application for the role type shown in `{{ params.roleType }}`.
- A short "What happens next" section listing three steps: (1) AI pre-screening within 24 hours, (2) if passed, a short skills test invitation, (3) staff review and decision.
- A note that typical turnaround is 3–7 business days.
- A reassurance line that they don't need to do anything until they hear from us.
**CTA:** none. Informational only.

### V2 — Pre-Screen Passed
**Purpose:** notify applicant they cleared AI pre-screening and will receive tests shortly.
**Params:** `fullName`, `applicationNumber`, `roleType`.
**Subject line:** "Good news — you've cleared pre-screening"
**Body content:**
- Congratulate them on passing pre-screening.
- Explain that a separate email will arrive within the next few minutes containing their skills test(s).
- Note that tests are timed (48-hour window from receipt) and should be completed in one sitting where possible.
- Note that assistance of any kind (AI, MT, colleague) will disqualify the submission — the test is a true skills assessment.
**CTA:** none. Priming email; the test invitation follows separately.

### V3 — Test Invitation (Batch)
**Purpose:** deliver the actual skills tests. One email can include multiple test links if the applicant has multiple language-pair + domain combinations.
**Params:** `fullName`, `applicationNumber`, `testCount`, `testLinks` (a newline-separated list of URLs, one per test), `expiryHours` (48).
**Subject line:** "Your CETHOS skills test(s) — complete within 48 hours"
**Body content:**
- Lead line: "You've been assigned {{ params.testCount }} skills test(s)."
- A clearly delineated block that renders each line of `{{ params.testLinks }}` as a separate list item with a clickable link. Treat newlines in the param as list separators.
- A "Before you begin" section with four bullets: (1) each link opens a single-session test — no login required, (2) auto-save runs every 60 seconds while you work, (3) you have {{ params.expiryHours }} hours from now before links expire, (4) submissions are one-shot — you cannot resubmit.
- A closing line noting that all tests are assessed by our AI plus human reviewers against MQM Core criteria.
**CTA:** the list of test links is itself the CTA. No separate button.

### V4 — Test Reminder (24-Hour Warning)
**Purpose:** nudge applicants whose test links expire in 24 hours and they haven't submitted.
**Params:** `fullName`, `applicationNumber`, `testLink`, `hoursRemaining`.
**Subject line:** "Reminder: your CETHOS test expires in {{ params.hoursRemaining }} hours"
**Body content:**
- A concise reminder that their test link expires in `{{ params.hoursRemaining }}` hours.
- Reassurance that any auto-saved draft is still on the server — they'll pick up where they left off when they return.
- A short note that if they need more time, they can reply to this email before the link expires and we can extend once.
**CTA:** single prominent button labelled "Resume your test" linking to `{{ params.testLink }}`.

### V5 — Test Expired
**Purpose:** notify an applicant that their test window has closed with no submission.
**Params:** `fullName`, `applicationNumber`.
**Subject line:** "Your CETHOS test window has closed"
**Body content:**
- State plainly that the 48-hour test window has ended without a submission.
- Explain that we understand timing doesn't always work — they have one final chance to request a reissued link (covered in V6) if they reply within the next few days.
- A line noting that if we don't hear back, the application will be archived in 7 days.
**CTA:** none. This is an acknowledgement; the reply-to-request path is handled via V6.

### V6 — Final Chance (Day 7)
**Purpose:** last outreach to applicants whose test expired and who haven't responded.
**Params:** `fullName`, `applicationNumber`.
**Subject line:** "Last chance to complete your CETHOS application"
**Body content:**
- Acknowledge that life happens and timelines slip.
- Offer a final path: reply to this email within 3 days and we'll reissue a fresh test link with a new 48-hour window.
- A line explaining that if we don't hear back, the application will be archived (but they can reapply after 6 months).
**CTA:** a single button labelled "Reply to request a new link" that opens the user's mail client with `mailto:recruiting@cethos.com?subject=Request%20new%20test%20link%20-%20{{ params.applicationNumber }}` pre-filled.

### V7 — Test Received
**Purpose:** confirmation sent the moment an applicant submits a test.
**Params:** `fullName`, `applicationNumber`.
**Subject line:** "We've received your test submission"
**Body content:**
- Confirm the submission reached us.
- Explain that AI assessment runs within minutes, followed by human review where needed.
- Set expectation: they'll hear from us within 3–5 business days with a decision.
- A line noting that if they were assigned multiple tests and haven't completed all of them, those remaining test links are still open.
**CTA:** none. Acknowledgement email.

### V8 — Under Manual Review
**Purpose:** notify an applicant that their application requires human review instead of the standard automated path (either borderline pre-screen score, or cognitive debriefing path which is always staff-reviewed).
**Params:** `fullName`, `applicationNumber`, `roleType`.
**Subject line:** "Your application is under review"
**Body content:**
- Explain that their application is being reviewed by a member of our recruiting team.
- Reassure that this is a normal part of the process for their role type and doesn't signal a problem.
- Set expectation: a decision will come within 5–7 business days.
- A line noting we'll reach out if we need anything further from them.
**CTA:** none.

### V9 — Negotiation Offer (Admin → Applicant)
**Purpose:** staff have reviewed the applicant's test and want to propose a rate or tier that differs from what the applicant originally requested. This is one-shot — the applicant may counter once.
**Params:** `fullName`, `applicationNumber`, `proposedTier` (e.g. "Standard", "Senior", "Expert"), `proposedRate`, `rateUnit` (e.g. "per word", "per hour", "per page"), `currency` (e.g. "CAD", "USD"), `languagePair` (e.g. "English → French"), `serviceType` (e.g. "Translation", "Translation + Review", "LQA Review"), `rationale` (staff-provided plain-text note), `respondLink`, `expiryHours` (typically 72).
**Subject line:** "Rate proposal from CETHOS — please review"
**Body content:**
- Open with: "We've completed review of your test for `{{ params.languagePair }} — {{ params.serviceType }}` and would like to propose the following."
- A clearly delineated offer block showing: Tier, Rate, Unit, Currency, Language Pair, Service Type — each as its own labeled line.
- A "Why we're proposing this" section that renders `{{ params.rationale }}` as-is (staff writes this).
- A note that the applicant has one opportunity to counter, and counters must be submitted within `{{ params.expiryHours }}` hours.
- A line explaining that accepting finalizes the engagement terms for this combination; declining ends the application for this combination only (other combinations may still move forward).
**CTA:** a single prominent button labelled "Review and respond" linking to `{{ params.respondLink }}`.

### V10 — Rate Agreed
**Purpose:** confirmation that both sides agreed on terms and approval will follow.
**Params:** `fullName`, `applicationNumber`, `agreedTier`, `agreedRate`, `rateUnit`, `currency`, `languagePair`, `serviceType`.
**Subject line:** "Terms confirmed — welcome to the next step"
**Body content:**
- Confirm the agreed terms in a compact block: Tier, Rate, Unit, Currency, Language Pair, Service Type.
- Explain that the approval will be finalized shortly and they'll receive a welcome email (V11) with access instructions to the vendor portal.
- A line noting that these terms apply to this language-pair + service combination only — if they applied for additional combinations, each will be finalized separately.
**CTA:** none. V11 follows with the portal link.

### V11 — Approved Welcome
**Purpose:** the moment a vendor account is created after approval. Delivers portal access and a password-setup link.
**Params:** `fullName`, `applicationNumber`, `vendorPortalUrl` (e.g. `https://vendor.cethos.com`), `passwordSetupLink`, `passwordSetupExpiryHours` (typically 72), `approvedCombinationsList` (a newline-separated list like "English → French — Translation — Senior tier — 0.18 CAD/word"), `supportEmail` ("support@cethos.com").
**Subject line:** "Welcome to CETHOS — your vendor account is ready"
**Body content:**
- Open with a warm welcome and confirmation that their application was approved.
- A "Your approved engagements" section that renders each line of `{{ params.approvedCombinationsList }}` as its own item.
- A "Getting started" section with three numbered items: (1) set your password using the link below — valid for `{{ params.passwordSetupExpiryHours }}` hours, (2) complete your vendor profile (payment details, tax info, availability), (3) watch for your first job offer in the portal.
- A "Where to log in" line noting `{{ params.vendorPortalUrl }}` as the portal URL.
- A support line pointing to `{{ params.supportEmail }}`.
**CTA:** single prominent button labelled "Set your password" linking to `{{ params.passwordSetupLink }}`. Show the URL as plain text fallback below.

### V12 — Rejected
**Purpose:** the final rejection notification, sent after the 48-hour staff intercept window on an AI-flagged or staff-decided rejection.
**Params:** `fullName`, `applicationNumber`, `reasonSummary` (a staff-reviewed plain-text summary), `reapplyAfterDate` (formatted date string, 6 months out).
**Subject line:** "Update on your CETHOS application"
**Body content:**
- Thank them for their time and interest.
- State that after careful review, we're unable to move forward with their application at this time.
- Render `{{ params.reasonSummary }}` as the substantive explanation (one short paragraph).
- A note that they're welcome to reapply on or after `{{ params.reapplyAfterDate }}` — we keep growing our network and roles open up regularly.
- Close warmly without being dismissive.
**CTA:** none.

### V13 — Waitlisted
**Purpose:** notify an applicant their application is strong but no current demand for their specific combination.
**Params:** `fullName`, `applicationNumber`, `languagePairsWaitlisted` (newline-separated list), `estimatedReviewMonths` (e.g. "3", "6"), `reason` (staff-provided short note).
**Subject line:** "Your CETHOS application is on our waitlist"
**Body content:**
- Explain that their application is strong but we don't currently have sufficient demand for the language pair(s) / service(s) they applied for.
- Render `{{ params.languagePairsWaitlisted }}` as a list of the specific waitlisted combinations.
- Render `{{ params.reason }}` as the staff explanation (plain text).
- Set expectation: we'll revisit the waitlist in approximately `{{ params.estimatedReviewMonths }}` months, or sooner if demand changes.
- Close by noting that no action is required — we'll reach out when the timing is right.
**CTA:** none.

### V14 — Profile Nudge (Active Vendor)
**Purpose:** gentle reminder to an already-onboarded vendor that something in their profile needs attention (availability status stale, payment info missing, language pairs not confirmed recently, etc.). Dynamic content varies.
**Params:** `fullName`, `nudgeType` (machine-readable code — do not render), `nudgeHeadline` (human-readable short title, e.g. "Your availability hasn't been updated in 30 days"), `nudgeDetails` (one-paragraph explanation), `portalActionUrl`, `portalActionLabel` (e.g. "Update availability", "Add payment method").
**Subject line:** "Quick check-in — {{ params.nudgeHeadline }}"
**Body content:**
- Open with a light, friendly acknowledgement that we want to make sure their profile stays active and accurate.
- Render `{{ params.nudgeHeadline }}` as a prominent heading inside the body.
- Render `{{ params.nudgeDetails }}` as the supporting paragraph.
- A short line noting they can take care of it in under a minute.
**CTA:** single button labelled with `{{ params.portalActionLabel }}` linking to `{{ params.portalActionUrl }}`.

### V15 — Certification Expiry
**Purpose:** warn an active vendor that a professional certification on file is expiring or has expired.
**Params:** `fullName`, `certificationName` (e.g. "ATA Certification", "CTTIC"), `expiryDate` (formatted date string), `daysUntilExpiry` (integer; can be negative if already expired), `portalCertificationsUrl`.
**Subject line:** "{{ params.certificationName }} — action needed"
**Body content:**
- If `{{ params.daysUntilExpiry }}` is positive: "Your `{{ params.certificationName }}` is set to expire on `{{ params.expiryDate }}` — that's in `{{ params.daysUntilExpiry }}` days."
- If negative or zero: "Your `{{ params.certificationName }}` expired on `{{ params.expiryDate }}`."
- Explain why it matters: expired certifications mean we can't route you to clients who require certified vendors for their work, which reduces your job volume.
- Ask them to upload a renewed certificate in the portal, or let us know if they don't plan to renew so we can update their profile.
**CTA:** single button labelled "Upload renewed certificate" linking to `{{ params.portalCertificationsUrl }}`.

### V16 — Language Pairs Check
**Purpose:** ask an active vendor to confirm their language pairs are still accurate (periodic data-hygiene nudge).
**Params:** `fullName`, `currentLanguagePairsList` (newline-separated, one pair per line, e.g. "English → French — Active", "Spanish → English — Active"), `portalLanguagesUrl`, `lastConfirmedDate` (formatted date string or the string "never").
**Subject line:** "Confirm your language pairs on CETHOS"
**Body content:**
- Open by noting that demand and client matching rely on accurate language-pair records, and we'd like a quick confirmation.
- A "What we have on file" section rendering `{{ params.currentLanguagePairsList }}` as a list.
- A line: "Last confirmed: `{{ params.lastConfirmedDate }}`."
- Ask them to either (a) confirm as-is if still accurate, or (b) log into the portal and add/remove pairs as needed.
- A note that if they want to add a new pair we haven't tested them on, we'll send a short skills test for the new pair before activating it.
**CTA:** single button labelled "Review my language pairs" linking to `{{ params.portalLanguagesUrl }}`.

### V17 — Request More Information (Staff → Applicant)
**Purpose:** staff need something from the applicant before deciding — a clarification, a missing document, a better work sample.
**Params:** `fullName`, `applicationNumber`, `requestDetails` (staff-provided plain-text explanation of what they need), `replyEmail` (e.g. "recruiting@cethos.com"), `deadlineDate` (formatted date string, typically 7 days out).
**Subject line:** "Quick follow-up on your CETHOS application"
**Body content:**
- Open by explaining that the recruiting team has been reviewing their application and needs a small amount of additional information to move forward.
- Render `{{ params.requestDetails }}` as the substantive ask (staff writes this — render verbatim).
- A line noting the applicant can reply directly to this email or send to `{{ params.replyEmail }}`.
- Set a soft deadline of `{{ params.deadlineDate }}` — explain that if we don't hear back by then, we'll pause the application until we do.
- A closing thank-you for their patience.
**CTA:** single button labelled "Reply to CETHOS recruiting" opening `mailto:{{ params.replyEmail }}?subject=Re:%20Application%20{{ params.applicationNumber }}`.

---

## Deliverables

One standalone HTML file per template, named `v1-application-received.html` through `v17-request-more-info.html`. Each must:

- Work as a drop-in into Brevo's template editor with the `{{ params.xxx }}` placeholders intact and unescaped.
- Include a plain-text alternative inline where Brevo can extract it, or provide a matching `.txt` counterpart per template.
- Render correctly on mobile clients (iOS Mail, Gmail app) and desktop clients (Outlook, Apple Mail, Gmail web).
- Handle missing or empty params gracefully — no template should render "Hi ," or broken lists when a param is blank.

Where a param renders a newline-separated list (V3 `testLinks`, V11 `approvedCombinationsList`, V13 `languagePairsWaitlisted`, V16 `currentLanguagePairsList`), the design must convert newlines into visually distinct list items.
