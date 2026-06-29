// Plain-English description of the Cethos Vendor Portal.
//
// This text powers the in-app "About this Software" page. Written for a
// non-technical reader (e.g. an auditor or a new vendor/linguist).

export interface DescriptionSection {
  heading: string;
  body: string[];
}

export const PORTAL_SHORT_DESCRIPTION =
  "The Cethos Vendor Portal is the secure web application freelance linguists " +
  "use to work with Cethos — completing onboarding, getting qualified, accepting " +
  "assignments, and submitting invoices. It runs in a normal web browser, with " +
  "nothing to install.";

export const PORTAL_DESCRIPTION: DescriptionSection[] = [
  {
    heading: "What it is",
    body: [
      "The Cethos Vendor Portal is the website that Cethos' freelance linguists (vendors) log into to do business with Cethos.",
      "It is the vendor-facing part of the wider Cethos Portal, which also has a staff (admin) area and a client area.",
    ],
  },
  {
    heading: "What it does",
    body: [
      "Onboarding: new vendors complete their profile, sign the required agreements (NDA / vendor services agreement), and upload supporting documents.",
      "Qualification: vendors record the language pairs and subject areas they work in and provide the evidence Cethos needs to qualify them. Tests and quizzes are graded by people, never automatically.",
      "Work: qualified vendors see job offers, accept assignments, deliver completed files, and complete required training.",
      "Payments: vendors enter their payment details and view and submit invoices.",
    ],
  },
  {
    heading: "How it keeps records (quality & compliance)",
    body: [
      "The portal supports ISO 17100 (translation services) practices. Key events — agreements signed, documents uploaded, qualifications, assignments, and deliveries — are recorded with who did what and when.",
      "Vendors can only be assigned work in the language pairs and subject areas they have been formally qualified for, and qualification is always confirmed by a person.",
    ],
  },
  {
    heading: "How it is built and run",
    body: [
      "The portal is a modern web application. The part you see runs in your browser; the data and business rules run on a secure cloud backend (Supabase / PostgreSQL) hosted for Cethos.",
      "Access requires a vendor login.",
      "Each release carries a version number (shown on the About screen and in the page footer), together with the exact build it was produced from, and a record of what changed in each version is kept in the portal.",
    ],
  },
];
