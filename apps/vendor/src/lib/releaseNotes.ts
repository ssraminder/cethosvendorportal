// Release notes — SINGLE SOURCE OF TRUTH for the vendor portal version.
//
// Add a new entry to the TOP of RELEASE_NOTES on every release. The version of
// the most recent entry is what the app reports everywhere (footer badge, the
// About page, and the "What's new" modal). Keep entries factual and plain — this
// history is shown to auditors as the software change record.
//
// Versioning is CalVer: YEAR.MONTH.PATCH (e.g. 2026.6.0 = first June 2026 build,
// 2026.6.1 = a later patch in the same month). Each Cethos surface (admin,
// vendor, recruitment) is deployed independently and keeps its own release
// notes, but they share this versioning scheme.

export interface ReleaseNote {
  /** CalVer string, e.g. "2026.6.0". */
  version: string;
  /** Release date, ISO yyyy-mm-dd. */
  date: string;
  /** One-line plain-English summary of the release. */
  summary: string;
  /** Bullet list of notable changes, in plain language. */
  changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "2026.7.22",
    date: "2026-07-20",
    summary:
      "You can now upload audio recordings when delivering files — useful for cognitive-debriefing interviews.",
    changes: [
      "The Deliver Files window now accepts audio formats: .m4a, .mp3, .wav, and .amr, alongside the document and CAT formats already supported.",
      "Audio files can be up to 300 MB each (other files stay at 100 MB), so full interview recordings can be delivered directly through the portal.",
    ],
  },
  {
    version: "2026.7.21",
    date: "2026-07-18",
    summary:
      "Counter-offers are only accepted instantly when they fall inside the limits the project manager set.",
    changes: [
      "Fixed a case where a counter-offer could be accepted automatically even when the project manager hadn't set any acceptable-terms limits. Now, unless your counter fits within limits the PM explicitly set, it's sent to the PM for review before anything is agreed.",
    ],
  },
  {
    version: "2026.7.20",
    date: "2026-07-16",
    summary:
      "Fixed \"Text me the code instead\" — it was failing to send. If a text still can't go out, we now email your code automatically instead of leaving you stuck.",
    changes: [
      "Sign-in codes by text were failing with a set-up error on our side. Texts now send correctly.",
      "If a text can't be sent for any reason, we send the same code to your email instead and tell you we've done so — asking for a text can no longer leave you unable to sign in.",
      "Same fix applies to the text option when verifying your phone for NDA signing.",
    ],
  },
  {
    version: "2026.7.19",
    date: "2026-07-16",
    summary:
      "You can now mark a session as in progress when you start it, and let the people still waiting know once your group is full.",
    changes: [
      "New 'Start session' button on each session: use it when you begin, after your roll call. The session then shows an 'In progress' badge so you and Cethos can both see it's under way. If you press it by mistake, 'Not started' puts it back.",
      "'Mark complete & rate' is unchanged — that stays your last step at the end of the session, where you tick who attended and rate them.",
      "New 'Notify — session full' button: once your group is settled, you can tell everyone still listed as interested that the session has filled and that Cethos will contact them for the next one. It's your choice — nothing is sent automatically.",
      "That notice is sent by Cethos in the participant's own language where known, so you never see their email address, and anyone already told is skipped if you press it again.",
    ],
  },
  {
    version: "2026.7.18",
    date: "2026-07-16",
    summary:
      "You can now set a password and sign in without a one-time code every time. On your personal devices, choose “Remember this browser” to skip the code for 30 days.",
    changes: [
      "New: set a password from Profile → Security. Once set, you sign in with your email and password, and you're only asked for a one-time code on a new browser or about once a month.",
      "“Remember this browser” on the code screen keeps that device signed in without a code for 30 days — only use it on your own devices.",
      "Manage remembered browsers in Profile → Security, and sign out of any one (or all at once). Changing your password signs out every remembered browser.",
      "Forgot your password? Use “Email me a one-time code instead”, then set a new one.",
    ],
  },
  {
    version: "2026.7.17",
    date: "2026-07-16",
    summary:
      "You can now get your sign-in code by text message. If the email doesn't arrive, choose \"Text me the code instead\" to receive the same code by SMS on the phone number we have on file.",
    changes: [
      "On the code-entry step, if we have a mobile number on your file you'll see a \"Text me the code instead\" option that sends the same 6-digit code by SMS.",
      "You can switch back to email at any time, and \"Resend code\" uses whichever channel you last chose.",
      "Entering the code and signing in works exactly the same, no matter how the code was delivered.",
    ],
  },
  {
    version: "2026.7.16",
    date: "2026-07-16",
    summary:
      "You can now finalise your own group from My Interviews — confirm the people who tell you they'll attend, and take off anyone who can't.",
    changes: [
      "New 'Manage group' button on each session: Confirm an interested candidate into a seat, or Remove someone who can't make it.",
      "Confirming sends the participant their joining details automatically — you no longer need to ask Cethos to do it.",
      "Removing a confirmed participant frees their seat, and Cethos offers it to a standby or the next person waitlisted, without you having to chase it.",
      "The panel shows how many seats the session has and how many are free, so you can see at a glance whether there's room.",
      "If the session is already full, Confirm tells you so rather than failing quietly — ask Cethos to raise the capacity.",
      "Removals ask you to confirm first, and can't be undone. Only Cethos can put someone back.",
      "Confirm and Remove are kept in their own panel, away from the Call buttons, so a stray click can't drop a participant.",
    ],
  },
  {
    version: "2026.7.15",
    date: "2026-07-15",
    summary:
      "My Interviews now shows everyone you might need to reach for a session — not just the confirmed participants, but the interested candidates and the waitlist too — and you can email, call, SMS or WhatsApp any of them.",
    changes: [
      "Sessions where nobody is confirmed yet now appear on this page. Previously they were hidden, even though those are usually the ones that need chasing.",
      "Each session lists three groups: confirmed participants, interested candidates (registered, waiting on Cethos to confirm), and the study waitlist.",
      "Email, Call, SMS and WhatsApp all reach any of the three groups — everything stays blinded, so you never see their contact details and they never see yours.",
      "'Message participants' is now simply 'Email'. Confirmed participants are pre-selected; tick the others only if you mean to contact them.",
      "Emails to people Cethos hasn't confirmed don't mention a session time, so nobody is told they have a seat they haven't been given.",
      "Interview documents can still only be attached for confirmed participants.",
      "'Mark complete & rate' appears once someone is confirmed — only confirmed participants can be marked attended and rated.",
      "Spanish, Slovak and Dutch participants now receive your relayed emails in their own language instead of English.",
    ],
  },
  {
    version: "2026.7.14",
    date: "2026-07-13",
    summary:
      "You can now text or WhatsApp your interview participants too, not just call them — all from the My Interviews page, and still without either side seeing the other's number.",
    changes: [
      "The 'Call' button is now 'Call / text': choose Call, SMS, or WhatsApp for each participant or waitlister.",
      "SMS and WhatsApp go out from the Cethos Research Panel number — the participant never sees your number, and replies come back to Cethos (not routed to you yet).",
      "Only the channels Cethos has set up are shown, so you won't see an option that can't send.",
      "Clearer errors: if a call or text can't go out because of a set-up problem on the Cethos side, it now says so instead of blaming your number.",
      "Standard call/messaging rates may apply.",
    ],
  },
  {
    version: "2026.7.13",
    date: "2026-07-13",
    summary:
      "Interview moderators can now call their participants from the My Interviews page — Cethos rings you first, then connects the participant, and neither side sees the other's number.",
    changes: [
      "New 'Call' button on each session, next to 'Message participants'.",
      "Enter the number to reach you on — we call you first, then bridge in the participant. You never see their number and they never see yours; they see the Cethos Research Panel line.",
      "Your callback number is remembered and prefilled for next time.",
      "If someone is a no-show, the study's waitlist is shown so you can call those participants to check availability.",
      "International call rates may apply.",
    ],
  },
  {
    version: "2026.7.12",
    date: "2026-07-10",
    summary:
      "If Cethos can't accept an invoice you submitted, the purchase order reopens so you can send a corrected one — with a note explaining what to fix.",
    changes: [
      "When an invoice is not accepted, its purchase order becomes available to invoice again instead of staying locked.",
      "The reopened purchase order shows why the previous invoice wasn't accepted, and you'll also receive an email with the reason and any notes.",
      "Please attach a proper invoice document (not a copy of the purchase order) when re-submitting.",
    ],
  },
  {
    version: "2026.7.11",
    date: "2026-07-10",
    summary:
      "You can now enter your years of professional experience directly on your Profile page — no need to wait for a document-request link from Cethos.",
    changes: [
      "Profile page: added a 'Years of Professional Experience' field (0–80) next to Native Language(s), so this ISO 17100 checklist item can be completed self-serve. The existing document-request link still works the same way for evidence uploads.",
    ],
  },
  {
    version: "2026.7.10",
    date: "2026-07-10",
    summary:
      "Fixes from vendor bug reports: requesting a domain test no longer wrongly says 'no active test in the library' when a matching test exists, and CV uploads that fail (e.g. file too large) now explain why instead of doing nothing.",
    changes: [
      "Request a test: the availability check now matches language variants (e.g. English (US) counts as English) and the language-agnostic seed tests, exactly like the test sender does — vendors approved for medical, life sciences, pharmaceutical and other domains were being blocked even though tests existed.",
      "CV upload (onboarding and profile): files over 10 MB are rejected up front with a clear message, and upload-service errors now surface a readable explanation instead of failing silently.",
    ],
  },
  {
    version: "2026.7.9",
    date: "2026-07-10",
    summary:
      "For 1-to-1 interview offers, you now need to propose at least as many session times as the study has participants (one session each).",
    changes: [
      "When you apply for a 1-to-1 study, the form now asks for at least one session time per participant and shows the required number; you can't submit fewer. Focus groups are unchanged (one shared session).",
      "The times list starts with enough empty rows for the required number of sessions, so it's clear how many to add.",
    ],
  },
  {
    version: "2026.7.8",
    date: "2026-07-10",
    summary:
      "New interview offers now pre-fill your saved hourly rate, so you don't have to re-enter it each time (you can still change it per offer).",
    changes: [
      "When a new interview offer arrives, the hourly-rate field is pre-populated with your saved cognitive-debriefing rate — adjust it for that offer if you like.",
    ],
  },
  {
    version: "2026.7.7",
    date: "2026-07-10",
    summary:
      "Your hourly rate is now required when you apply for an interview offer, and it's saved to your profile as your cognitive-debriefing interview rate.",
    changes: [
      "The 'Interview offers' form now requires your hourly rate (with currency) to submit — it's saved to your profile as your cognitive-debriefing interview rate and reused next time.",
      "Wording updated: the submit button now reads 'Apply and Submit times', and accepting an offer is shown as 'Applied'.",
    ],
  },
  {
    version: "2026.7.6",
    date: "2026-07-10",
    summary:
      "When you accept an interview offer and propose your times, you can now include your hourly rate and currency so Cethos sees it alongside your availability.",
    changes: [
      "The 'Interview offers' form has a new optional 'Your hourly rate' field with a currency selector, next to the timezone picker. Enter it once and it's remembered if you add more times later.",
      "Your rate is sent to the Cethos team with your proposed times — it isn't shared with participants.",
    ],
  },
  {
    version: "2026.7.5",
    date: "2026-07-10",
    summary:
      "Interview scheduling is now offer-based: when Cethos needs a moderator they send you an offer, which you accept by proposing your available times — or decline. My Interviews shows your open offers under 'Interview offers'.",
    changes: [
      "New offers arrive with a 'New offer' badge and an expiry note. Add the times that work for you and submit — that accepts the offer. Cethos may be asking a few moderators, so the offer notes that too.",
      "Decline an offer outright if it doesn't suit — Cethos then assigns another moderator; the other candidates are unaffected.",
      "Once you've accepted, the badge shows 'Accepted' and you can keep adding times until Cethos confirms.",
      "Focus groups are flagged as one shared session — offer a few options and Cethos confirms one.",
    ],
  },
  {
    version: "2026.7.4",
    date: "2026-07-09",
    summary:
      "Moderators can now propose their own session times: when Cethos requests availability for a study, it appears on My Interviews with a simple date/time picker in your timezone — approved times become your booked sessions.",
    changes: [
      "New 'Availability requested' section on My Interviews: studies Cethos offered you, with the session length, language, and any note from the team.",
      "Propose up to 10 times per submission in your own timezone (each session's length is fixed by the study); times must be at least 24 hours out and can't overlap your existing sessions or proposals.",
      "Each proposed time shows its review status — awaiting review, approved (session booked in), or not used (with Cethos's note) — and pending ones can be withdrawn.",
      "'I can't take this study' lets you decline the request with an optional reason so Cethos can assign another moderator.",
      "The My Interviews nav item now also appears when you have an open availability request (previously only with booked sessions).",
    ],
  },
  {
    version: "2026.7.3",
    date: "2026-07-09",
    summary:
      "Interview documents on My Interviews: the translated files Cethos shares for a session now appear on the session card with always-fresh download links, and can be attached to participant messages.",
    changes: [
      "Each session card lists the interview's shared documents with download links that are re-issued on every visit (no more expired email links).",
      "The message composer gains 'Attach interview documents' — selected files are delivered to each participant as fresh 7-day secure links alongside your message (a message text is optional when sending files).",
      "Only documents Cethos has shared for the interview can be attached — translated study materials, never source or internal files.",
    ],
  },
  {
    version: "2026.7.2",
    date: "2026-07-08",
    summary:
      "Interview moderators can now message their booked participants before the session — Cethos relays the message by email so no contact details change hands — and the meeting link shows right on the session card.",
    changes: [
      "New 'Message participants' on each upcoming session: write once, pick recipients, and Cethos emails it from the Research Panel address in each participant's language. You never see their contact details; replies go to the Cethos team, who forward them.",
      "Sent messages are listed on the session with delivery counts, and the Cethos team automatically receives a copy of everything relayed.",
      "The session's meeting link now appears on the card with a Join meeting button (previously it only arrived by email).",
    ],
  },
  {
    version: "2026.7.1",
    date: "2026-07-08",
    summary:
      "Interview moderators get a 'My Interviews' console to run their research-panel sessions, mark them complete, and rate each participant.",
    changes: [
      "New 'My Interviews' page (shown to vendors who moderate interviews) lists your assigned sessions.",
      "Mark a session complete, ticking who attended and flagging any no-shows.",
      "Rate each participant and add private notes; completing a session also releases the participants' payment step.",
    ],
  },
  {
    version: "2026.7.0",
    date: "2026-07-05",
    summary:
      "When Cethos requests a review on your delivered work, the job now shows the review notes plus a link to download the marked-up files and submit your corrections.",
    changes: [
      "A new 'Review requested' section appears on a job when Cethos sends back a round of corrections: it shows the reviewer's notes, a 'Download files & comments' button for that round's files, and a 'Submit corrections' button to upload your fixes.",
    ],
  },
  {
    version: "2026.6.9",
    date: "2026-07-04",
    summary:
      "Job details now show Download Files and Submit Files buttons when Cethos has prepared a file package for you.",
    changes: [
      "When a job's files are ready, the job detail view shows a 'Your files' section with a Download Files button (the files to work on) and a Submit Files button (upload your completed work). Your download link stays the same if the package is updated — just refresh.",
    ],
  },
  {
    version: "2026.6.8",
    date: "2026-07-03",
    summary:
      "More languages available when selecting your language pairs.",
    changes: [
      "Added languages that were missing from the language picker (including Sesotho, Scottish Gaelic, Tibetan, Yiddish, Hawaiian and others) so your profile and language pairs match the languages offered on the application form.",
    ],
  },
  {
    version: "2026.6.7",
    date: "2026-07-02",
    summary:
      "The knowledge-check result (your score) now stays on screen after you pass.",
    changes: [
      "After you pass a training's knowledge check, your score and the reviewed answers remain visible instead of disappearing right away.",
    ],
  },
  {
    version: "2026.6.6",
    date: "2026-07-02",
    summary:
      "Trainings can now include a graded knowledge check — pass to complete, retake if needed.",
    changes: [
      "A training assigned to you may now end with a short multiple-choice knowledge check. Work through the lessons, then take the check.",
      "You need to reach the pass mark shown on the check (for most, 80%) to complete the training. If you don't pass, you can review the questions marked as incorrect and retake it as many times as you need.",
      "Your completion and score are recorded only once you pass.",
      "New training added: \"Cognitive Debriefing: Post-CogDeb Analysis & QM Review\" — for linguists who analyse cognitive-debriefing feedback.",
    ],
  },
  {
    version: "2026.6.5",
    date: "2026-07-02",
    summary:
      "More reliable sign-in codes — login and NDA codes now go out through our most deliverable email provider first.",
    changes: [
      "Login and NDA verification codes are now sent through the email provider with the best deliverability first, with an automatic backup provider if it can't reach your mailbox — so codes stop silently going missing.",
      "This fixes cases where sign-in codes were not arriving for some vendors depending on their email provider or region.",
    ],
  },
  {
    version: "2026.6.4",
    date: "2026-06-30",
    summary:
      "New Guides section — watch how-to walkthroughs and open reference documents from Cethos.",
    changes: [
      "Added a 'Guides' page in the sidebar with how-to videos and reference documents Cethos publishes for you.",
      "Videos play inline on the page, grouped by category — no need to leave the portal.",
    ],
  },
  {
    version: "2026.6.3",
    date: "2026-06-30",
    summary:
      "Respond to quality actions (CAPA) Cethos raises to you, with a new Quality Actions page.",
    changes: [
      "Added a 'Quality Actions' page listing corrective actions Cethos has raised to you, with the request, severity, and response due date.",
      "You can acknowledge each action and submit your root cause plus corrective and preventive action, optionally attaching supporting evidence.",
      "If Cethos returns a response for revision, the reason is shown so you can update and resubmit.",
      "Your dashboard now shows a banner when you have quality actions awaiting a response.",
    ],
  },
  {
    version: "2026.6.2",
    date: "2026-06-29",
    summary:
      "Raise an invoice against each purchase order, with a required invoice document and GST.",
    changes: [
      "Added a 'Purchase Orders' page listing the purchase orders Cethos has sent you.",
      "You can raise one invoice per purchase order, attaching your own invoice document (now required) and adding GST/HST at your registered rate.",
      "Once raised, each purchase order shows its invoice status so you can see what has been received.",
    ],
  },
  {
    version: "2026.6.1",
    date: "2026-06-29",
    summary:
      "Fixes a batch of vendor-reported issues across the profile, payment, NDA, onboarding, and test-request screens.",
    changes: [
      "Profile completeness now counts your availability correctly — setting yourself to 'Available' no longer lowered your completion score.",
      "Added a Subject Specializations editor to your profile so you can complete that ISO 17100 step directly (previously there was nowhere to set it).",
      "Re-added profile photo upload — click your avatar on the profile page to add or change your picture.",
      "Payment details (PayPal email, bank details) now load back correctly when you return to the Payment page instead of appearing blank after saving.",
      "Fixed the 'Request test' buttons, which were failing with an error for every domain.",
      "Made the 'Edit' control on profile fields (including preferred currency) clearly visible so it's easy to find and save.",
      "Clarified the NDA signing screen: you verify an emailed or texted code first, which unlocks the name box, and typing your name is your signature.",
      "Uploading your CV during onboarding now marks the step complete immediately, even on slower connections.",
    ],
  },
  {
    version: "2026.6.0",
    date: "2026-06-29",
    summary:
      "First formally versioned release of the Cethos Vendor Portal, with in-app version tracking and release notes.",
    changes: [
      "Introduced a published version number for the vendor portal, visible at the bottom of every page and on the new 'About this Software' screen.",
      "Added an 'About this Software' page describing what the vendor portal does, the current version, the exact build it was made from, and the full history of changes.",
      "Added a 'What's new' notice that appears once after each update so vendors can see what changed.",
    ],
  },
];

/** The current published version of the application. */
export const CURRENT_VERSION = RELEASE_NOTES[0].version;
