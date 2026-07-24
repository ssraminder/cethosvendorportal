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
    version: '2026.7.0',
    date: '2026-07-20',
    summary:
      'The assessment chooser no longer promises a test link that was never sent.',
    changes: [
      'After choosing an assessment, the confirmation now reflects what actually happened. When recruitment reviews the application before releasing the assessment, applicants are told their choice was recorded and that the link follows after review — instead of being told a link had already been emailed.',
      'That screen previously instructed applicants to check their spam folder and reply to the invitation if the link had not arrived, which sent a steady stream of "where is my test?" emails to the recruitment inbox for links that were never dispatched.',
      'Applicants who genuinely were sent a link straight away still see the original "check your inbox" confirmation, unchanged.',
    ],
  },
  {
    version: '2026.6.1',
    date: '2026-07-02',
    summary:
      'Translator registration now captures native language(s).',
    changes: [
      'Translator registration now captures native language(s) (up to 3).',
    ],
  },
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
