// Release notes — SINGLE SOURCE OF TRUTH for the recruitment site version.
//
// Add a new entry to the TOP of RELEASE_NOTES on every release. The version of
// the most recent entry is what the app reports (footer badge + About page).
// CalVer: YEAR.MONTH.PATCH. Each Cethos surface keeps its own release notes but
// shares this versioning scheme.

export interface ReleaseNote {
  version: string
  date: string
  summary: string
  changes: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2026.6.0',
    date: '2026-06-29',
    summary:
      'First formally versioned release of the Cethos recruitment site, with an in-app version number and release notes.',
    changes: [
      'Introduced a published version number, visible in the footer and on a new "About this Software" page.',
      'Added an "About this Software" page describing the recruitment site, the current version, the exact build it was made from, and the history of changes.',
    ],
  },
]

export const CURRENT_VERSION = RELEASE_NOTES[0].version
