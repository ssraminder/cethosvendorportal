// Plain-English description of the Cethos recruitment site, for the in-app
// "About this Software" page. Written for a non-technical reader.

export interface DescriptionSection {
  heading: string
  body: string[]
}

export const PORTAL_SHORT_DESCRIPTION =
  'The Cethos recruitment site is the public web application that prospective ' +
  'linguists use to apply to work with Cethos and complete their assessments. ' +
  'It runs in a normal web browser, with nothing to install.'

export const PORTAL_DESCRIPTION: DescriptionSection[] = [
  {
    heading: 'What it is',
    body: [
      'The Cethos recruitment site is the public-facing front door for linguists who want to work with Cethos.',
      'It is part of the wider Cethos Portal, which also has a staff (admin) area, a vendor area, and a client area.',
    ],
  },
  {
    heading: 'What it does',
    body: [
      'Applications: individual linguists and translation agencies submit an application with their details and the language pairs and subject areas they work in.',
      'Assessments: applicants complete a translation test and/or a knowledge quiz through secure single-use links.',
      'References: applicants and their referees provide and confirm professional references.',
      'Tests and quizzes are graded by people, never automatically, before anyone is qualified.',
    ],
  },
  {
    heading: 'How it is built and run',
    body: [
      'The site is a modern web application. The part you see runs in your browser; the data and business rules run on a secure cloud backend (Supabase / PostgreSQL) hosted for Cethos.',
      'Each release carries a version number (shown on this page and in the footer), together with the exact build it was produced from, and a record of what changed in each version.',
    ],
  },
]
