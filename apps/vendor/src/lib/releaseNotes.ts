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
