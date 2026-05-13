// Mirror of the admin-side client/lib/iso17100.ts shape. Used by the
// /iso-evidence/:token landing page to render rationales + group labels
// for items that the admin sent over.

export const ISO_REQUEST_ITEM_BY_SLUG: Record<string, { label: string; rationale: string; kind: "file" | "profile_field"; profile_column?: string }> = {
  // Files
  degree_translation_studies: { label: "Translation / linguistics degree", rationale: "ISO 17100 § 3.1.4 route (a)", kind: "file" },
  degree_transcript: { label: "Academic transcript", rationale: "Supports the degree submission", kind: "file" },
  degree_other_field: { label: "Other-field degree", rationale: "ISO 17100 § 3.1.4 route (b) — paired with 2y experience", kind: "file" },
  experience_evidence_2y: { label: "Evidence of 2 years professional experience", rationale: "Required for route (b)", kind: "file" },
  experience_evidence_5y: { label: "Evidence of 5 years professional experience", rationale: "ISO 17100 § 3.1.4 route (c)", kind: "file" },
  professional_translation_cert: { label: "Professional translation certificate", rationale: "ATA / CTTIC / ITI / NAATI / etc.", kind: "file" },
  language_proficiency: { label: "Language proficiency proof", rationale: "C2 / native attestation for target language", kind: "file" },
  subject_specialization_proof: { label: "Subject specialization evidence", rationale: "ISO 17100 § 6.1.6 — per claimed domain", kind: "file" },
  sworn_translator_accreditation: { label: "Sworn / certified translator accreditation", rationale: "Required for certified-translation work in some jurisdictions", kind: "file" },
  business_registration: { label: "Business registration / tax certificate", rationale: "For invoicing & tax compliance", kind: "file" },
  insurance_certificate: { label: "Professional indemnity (E&O) insurance certificate", rationale: "Risk mitigation", kind: "file" },
  cpd_certificate: { label: "Recent CPD record", rationale: "Ongoing competence evidence", kind: "file" },
  // Profile fields
  profile_native_languages: { label: "Native language(s)", rationale: "ISO 17100 § 6.1.2 — target-language production at native level", kind: "profile_field", profile_column: "native_languages" },
  profile_years_experience: { label: "Years of professional translation experience", rationale: "Feeds qualifications route assessment", kind: "profile_field", profile_column: "years_experience" },
  profile_specializations: { label: "Subject specializations", rationale: "ISO 17100 § 6.1.6 — declare your domains", kind: "profile_field", profile_column: "specializations" },
};
