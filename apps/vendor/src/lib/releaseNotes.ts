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
