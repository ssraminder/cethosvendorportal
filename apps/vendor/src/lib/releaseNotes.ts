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
