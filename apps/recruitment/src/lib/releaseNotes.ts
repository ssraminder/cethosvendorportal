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
    version: '2026.7.4',
    date: '2026-07-30',
    summary:
      'Clinicians recruited by email can now sign the confidentiality agreement via a secure link — no account needed.',
    changes: [
      'Added a public /sign-nda/:token page. Staff can email an off-portal clinician a unique link to read and sign the Confidentiality & Non-Disclosure Agreement (typed legal name + agree). The signature is recorded on their vendor record, exactly like the in-form clickwrap.',
    ],
  },
  {
    version: '2026.7.3',
    date: '2026-07-30',
    summary:
      'Clinician registration now includes a seamless in-form confidentiality & non-disclosure agreement — sign as you apply.',
    changes: [
      'Added a dedicated Confidentiality & Non-Disclosure Agreement to the Clinician Reviewer form. Read it inline, type your full legal name, and agree — it is signed as part of submitting, with no separate step. Your acceptance carries through to your vendor record if you are approved.',
    ],
  },
  {
    version: '2026.7.2',
    date: '2026-07-30',
    summary:
      'Dedicated clinician registration links: /clinicians opens straight to the Clinician Reviewer form.',
    changes: [
      'Added /clinicians (and /apply/clinician) — a shareable link that opens directly to the Clinician Reviewer form. It still honours ?profession=, so per-profession links work too (e.g. /clinicians?profession=speech_language_therapist).',
    ],
  },
  {
    version: '2026.7.1',
    date: '2026-07-29',
    summary:
      'New dedicated registration channel for clinicians — physicians, nurses, pharmacists and allied-health professionals (speech & language, physio, occupational therapists, dietitians) can now apply directly.',
    changes: [
      'Added a "Clinician Reviewer" application type with a profession selector (physician, nurse, pharmacist, speech & language therapist, physiotherapist, occupational therapist, dietitian, or other) you can deep-link to (e.g. ?profession=nurse).',
      'Capture your qualifications as structured records: add multiple degrees (degree, field, institution, year) and, optionally, board certifications.',
      'Professional registration is now collected up front — registration/licence number, issuing body, jurisdiction, status and expiry (registration number required).',
      'Upload multiple supporting documents (licence, degree and board-certification scans) alongside your CV.',
      'No skills test for this route — consent is the privacy policy plus a truthful-declaration acknowledgement.',
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
