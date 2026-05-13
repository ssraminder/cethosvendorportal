// Per-slug detailed instructions + concrete examples surfaced on the
// /iso-evidence/:token page. Vendors get a clear "what counts" picture
// for each item the admin asked for, with 3-5 concrete examples and a
// few practical tips. Reduces back-and-forth and lifts upload rate.
//
// Keep tone direct and practical. No hedging. Examples should be things
// a working translator would already have or can plausibly obtain.

export interface ItemGuide {
  /** One-paragraph plain-language description of what this item is. */
  description: string;
  /** Concrete examples — what the document/value looks like in practice. */
  examples: string[];
  /** Optional practical tips for getting it or formatting it. */
  tips?: string[];
}

export const ISO_EVIDENCE_GUIDE: Record<string, ItemGuide> = {
  // ── File items ────────────────────────────────────────────────────────
  degree_translation_studies: {
    description:
      "Your graduate-level diploma in translation, interpretation, or linguistics from an accredited university. This is the cleanest qualifying route under ISO 17100 §3.1.4(a).",
    examples: [
      "Bachelor of Arts in Translation Studies from University of Ottawa",
      "Master in Conference Interpreting from ISIT Paris",
      "Licenciatura en Traducción e Interpretación from Universidad de Granada",
      "Postgraduate diploma in Translation Studies from a recognised distance program (e.g. New York University SCPS)",
    ],
    tips: [
      "A high-resolution scan or photo of the diploma is fine — both sides if there's text on the back.",
      "If the original is not in English or French, attach it as-is — we'll arrange translation if needed.",
      "Most universities email a digital copy free; ask the registrar.",
    ],
  },
  degree_transcript: {
    description:
      "Official academic transcript listing the courses you completed during your translation/linguistics degree. Supports the diploma.",
    examples: [
      "Official sealed transcript from your university registrar",
      "Digital verified transcript via Parchment, MyCreds, or equivalent",
      "Transcript paired with a course catalogue if course titles aren't self-explanatory",
    ],
    tips: [
      "Order online if your university offers it — usually under $20 and arrives as a verifiable PDF.",
      "If you have an old paper transcript, a clear photo works; we'll request a verified copy only if needed.",
    ],
  },
  degree_other_field: {
    description:
      "A graduate qualification in any field other than translation — paired with two years of professional translation experience, this is the §3.1.4(b) route.",
    examples: [
      "B.Sc. in Mechanical Engineering, working as a technical translator for 2+ years",
      "LL.B. in Law, working as a legal translator for 2+ years",
      "B.A. in History, M.A. in any humanities, with 2+ years translation experience",
    ],
    tips: [
      "Pair this submission with evidence of your 2-year translation experience below.",
      "The degree subject doesn't need to relate to your translation specialisation — but it helps if it does.",
    ],
  },
  experience_evidence_2y: {
    description:
      "Documentation showing you've worked as a professional translator for at least 2 years. Combined with a non-translation degree, this completes the §3.1.4(b) qualifying route.",
    examples: [
      "Five+ client invoices spanning at least 24 months",
      "A signed reference letter from a former agency or direct client confirming dates and scope",
      "A portfolio export listing 20+ dated translation jobs",
      "A LinkedIn-export PDF showing translation roles with dates",
      "Tax returns (with personal financial info redacted) showing translation income across 2+ years",
    ],
    tips: [
      "Mix sources is fine — a couple of invoices plus one reference letter is more than enough.",
      "Redact client names if your contracts require it; we just need to see the dates and that it was translation work.",
    ],
  },
  experience_evidence_5y: {
    description:
      "Documentation showing 5+ years as a professional translator — the §3.1.4(c) qualifying route on its own (no degree required).",
    examples: [
      "Tax returns (redacted) spanning 5+ years showing translation income",
      "Portfolio listing 50+ dated jobs across the 5-year window",
      "Reference letters from 2-3 clients confirming a multi-year working relationship",
      "Agency-issued vendor-history reports (e.g. XTRF, MemoQ Server, Smartcat exports)",
      "LinkedIn export plus invoice samples covering the 5 years",
    ],
    tips: [
      "Continuity matters: show that 5 years was a continuous working career, not a one-off project plus a long gap.",
      "If you switched specialisations during the 5 years, that's fine — it's still translation experience.",
    ],
  },
  professional_translation_cert: {
    description:
      "A recognised professional translator certification. Not required by ISO 17100, but it strengthens your competence file substantially and unlocks higher-tier client work.",
    examples: [
      "ATA Certification (American Translators Association)",
      "CTTIC / OTTIAQ certification (Canada)",
      "ITI Qualified Member (UK)",
      "NAATI Certified Translator (Australia)",
      "DipTrans IoLET (UK)",
      "Active candidate status / exam-pending letter from any of the above",
    ],
    tips: [
      "Membership-only (without certification) doesn't count, but candidate-with-passed-modules does.",
      "If your association issues digital badges (Credly, etc.), screenshot the badge page including the verification URL.",
    ],
  },
  language_proficiency: {
    description:
      "Proof that you can produce target-language text at native-speaker level. Critical for ISO 17100 §6.1.2 linguistic-textual competence.",
    examples: [
      "A CEFR C2 certificate in your target language (DELE, DALF, Goethe-Zertifikat, IELTS 8+, TOEFL 110+)",
      "A university diploma earned in the target-language country, in the target language",
      "A notarised self-declaration of native fluency (acceptable when you grew up speaking the language and have no formal certificate)",
      "Past employer / school documentation confirming the target language as a working/teaching language",
    ],
    tips: [
      "Native speakers without a formal certificate: the notarised self-declaration is the standard route. Most notaries do this for under $50.",
      "If you're translating into multiple targets, supply one item per language.",
    ],
  },
  subject_specialization_proof: {
    description:
      "Evidence that you have genuine domain knowledge for each specialisation you claim (legal, medical, marketing, technical, etc.). Required by ISO 17100 §6.1.6 — a declared specialisation must be evidenced.",
    examples: [
      "A relevant degree (e.g. law degree for legal translation, life sciences degree for medical)",
      "A subject-matter certification (e.g. SDL Trados Specialist, Society of Authors membership for literary)",
      "Two-to-five published translations in the domain (URLs or PDFs)",
      "A current or past role in the domain (e.g. paralegal, nurse, marketing manager) with translation responsibilities",
      "Continuing-development certificates specific to the domain (Coursera courses, conference attendance)",
      "A redacted client list demonstrating sustained work in the domain",
    ],
    tips: [
      "Submit one per claimed specialisation. If you claim three (Legal, Medical, Marketing), supply three pieces of evidence.",
      "A portfolio with three solid samples per domain often satisfies this — quality beats quantity.",
      "If you're early-career and don't have formal credentials in the domain, a CPD certificate plus 2-3 sample translations is acceptable.",
    ],
  },
  sworn_translator_accreditation: {
    description:
      "Government or court-issued accreditation that lets you produce legally-recognised certified translations. Only required if you'll handle certified-translation work; otherwise reply with \"not applicable\".",
    examples: [
      "Sworn Translator certificate from a Spanish autonomous community (Traductor Jurado)",
      "Court-appointed sworn translator decree (France, Germany, Italy)",
      "ATIO certified-translator stamp (Ontario)",
      "Notary-certified translator listing (US state-level)",
      "NAATI Certified Specialist Legal Translator (Australia)",
    ],
    tips: [
      "Include both the certificate AND a sample of your sworn-translator stamp/seal if you have one.",
      "If you don't take certified work, click \"I don't have this\" and note that you opt out of certified jobs — we'll exclude you from that work without affecting your overall eligibility.",
    ],
  },
  business_registration: {
    description:
      "Proof that you're legally registered to invoice for translation services in your jurisdiction. Needed for invoicing and tax compliance.",
    examples: [
      "Sole-proprietorship registration certificate / business-name registration letter",
      "Tax-ID printout (US EIN letter, Canadian GST/HST registration, EU VAT number certificate, UTR letter UK)",
      "Limited-company incorporation certificate (Companies House UK, SIRET FR, etc.)",
      "Self-employed registration confirmation from your country's tax authority",
    ],
    tips: [
      "Even sole proprietors operating under their own name need some form of tax registration — your country's tax-ID number page works.",
      "Redact home address if the document shows it; we just need the name, registration number, and date.",
    ],
  },
  insurance_certificate: {
    description:
      "Professional indemnity (errors & omissions) insurance certificate. Mitigates risk of translation errors and is increasingly required by end clients.",
    examples: [
      "Hiscox / Tinubu / ARAG freelancer professional indemnity policy certificate",
      "Local broker-issued certificate of insurance with effective dates",
      "An employer's group policy that covers your translation work (with a letter confirming you're covered)",
    ],
    tips: [
      "Freelancer-grade policies typically cost €100-300/year and cover the standard €1M / €1.5M limits.",
      "If you don't currently have insurance, a current quote pending purchase is acceptable while you finalise the policy. Note the start date in the explain box.",
    ],
  },
  cpd_certificate: {
    description:
      "Recent continuing-professional-development evidence — training, conferences, or courses you've taken in the last 2 years.",
    examples: [
      "Coursera, SDL/Trados, MemoQ, Smartcat course-completion certificates",
      "Conference attendance proof (ATA Annual, ITI Conference, Localization World, regional translator-association events)",
      "CPD-tracker export from your professional association (ATA, ITI, etc.)",
      "Webinar certificates (ProZ, GALA, Translators Without Borders training)",
    ],
    tips: [
      "ISO 17100 doesn't specify hours — any documented learning in the last 24 months counts.",
      "Multiple small items (3 webinar certificates) is fine; you don't need one big diploma.",
    ],
  },

  // ── Profile-field items ───────────────────────────────────────────────
  profile_native_languages: {
    description:
      "The language(s) you grew up speaking and produce at native-speaker level. Up to three — most professional translators have one or two.",
    examples: [
      "English (you grew up in Canada, USA, UK, Australia, etc.)",
      "Spanish (you grew up in Spain, Mexico, Argentina, etc.)",
      "Punjabi + English (you grew up bilingual)",
      "Mandarin + Cantonese (you grew up in a household using both)",
    ],
    tips: [
      "Pick languages you'd be comfortable translating INTO at publishable quality. CEFR C2 is the bar.",
      "If you're truly trilingual native, add up to three. Don't add a fourth unless you genuinely produce at native level.",
    ],
  },
  profile_years_experience: {
    description:
      "Total years of paid translation experience, full-time-equivalent. Your best honest estimate.",
    examples: [
      "1.5 — about 18 months as a freelancer",
      "5 — five years full-time as an in-house translator",
      "12 — twelve years freelancing, occasional gaps",
      "20+ — two decades in the industry",
    ],
    tips: [
      "Count part-time years pro-rata (e.g. half-time for 4 years = 2 years FTE).",
      "Don't pad — the ISO assessment cross-references this against your CV and references.",
    ],
  },
  profile_specializations: {
    description:
      "Subject domains you accept work in. Comma-separated list of the areas where you can deliver expert-quality translation.",
    examples: [
      "Legal, Corporate",
      "Medical, Pharmaceutical, Life Sciences",
      "Marketing, Transcreation, E-commerce",
      "Technical, IT, Software Localization",
      "Financial, Banking, Insurance",
      "Literary, Publishing",
    ],
    tips: [
      "Be honest — picking domains you don't actually know hurts you in the long run.",
      "You'll need to supply specialisation evidence (above) for each claim. Two-three solid domains beats six shallow ones.",
      "You can update this list later in your profile as you grow into new domains.",
    ],
  },
};

export function guideFor(slug: string): ItemGuide | null {
  return ISO_EVIDENCE_GUIDE[slug] ?? null;
}
