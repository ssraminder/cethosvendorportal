// Anchored MCQ definitions for the reference feedback form. Each option
// describes a concrete behaviour the reference can match against what
// they actually saw — so the answer is comparable across references
// without needing the reference to invent the rubric.
//
// Letter → semantic meaning is consistent across all questions:
//   a = strong positive  (pass evidence)
//   b = solid positive   (pass evidence)
//   c = mixed / partial  (partial evidence)
//   d = negative         (fail evidence)
//   e = can't speak to this  (no signal — opt out)

export type McqAnswer = "a" | "b" | "c" | "d" | "e";

export interface McqQuestion {
  /** Maps to ISO 17100 §6.1.2 criterion slug used by the assessment. */
  slug:
    | "translation_competence"
    | "linguistic_textual_competence"
    | "research_competence"
    | "cultural_competence"
    | "technical_competence"
    | "domain_competence";
  /** Prompt shown to the reference. {{name}} is replaced with vendor first name. */
  prompt: string;
  options: { value: McqAnswer; label: string }[];
}

const OPT_E = { value: "e" as const, label: "Can't speak to this" };

export const REFERENCE_MCQS: McqQuestion[] = [
  {
    slug: "translation_competence",
    prompt: "How would you describe {{name}}'s translation quality?",
    options: [
      { value: "a", label: "Consistently publishable — needed no rework" },
      { value: "b", label: "Reliable — occasional minor edits" },
      { value: "c", label: "Acceptable but needed reviewer pass" },
      { value: "d", label: "Frequently needed substantial revision" },
      OPT_E,
    ],
  },
  {
    slug: "linguistic_textual_competence",
    prompt: "{{name}}'s mastery of the target language — does the output read like a native speaker wrote it from scratch?",
    options: [
      { value: "a", label: "Always — indistinguishable from native-written text" },
      { value: "b", label: "Usually — minor unnatural phrasing here and there" },
      { value: "c", label: "Mixed — readable but clearly translated" },
      { value: "d", label: "Often unnatural or grammatically off" },
      OPT_E,
    ],
  },
  {
    slug: "research_competence",
    prompt: "When {{name}} hit unfamiliar terminology or subject matter, how did they handle it?",
    options: [
      { value: "a", label: "Resourceful — found authoritative sources, flagged ambiguities, justified choices" },
      { value: "b", label: "Competent — generally got it right with reasonable research" },
      { value: "c", label: "Sometimes guessed instead of researching" },
      { value: "d", label: "Frequent terminology errors or unsupported guesses" },
      OPT_E,
    ],
  },
  {
    slug: "cultural_competence",
    prompt: "Did {{name}} adapt content for the target audience, or translate literally?",
    options: [
      { value: "a", label: "Strong localiser — caught cultural pitfalls without being asked" },
      { value: "b", label: "Adapted when prompted, but didn't always volunteer it" },
      { value: "c", label: "Mostly literal translations" },
      { value: "d", label: "Cultural misses required client corrections" },
      OPT_E,
    ],
  },
  {
    slug: "technical_competence",
    prompt: "How did {{name}} handle CAT tools, file formats, and project workflow?",
    options: [
      { value: "a", label: "Proactive — clean tag handling, flagged file issues early, hit deadlines" },
      { value: "b", label: "Competent — followed instructions, output was clean" },
      { value: "c", label: "Needed reminders on tool usage or workflow steps" },
      { value: "d", label: "Struggled with CAT tools, files, or deadlines" },
      { value: "e", label: "Can't speak to this — we didn't use CAT tools" },
    ],
  },
  {
    slug: "domain_competence",
    prompt: "How strong was {{name}}'s subject-matter knowledge in the area you worked in?",
    options: [
      { value: "a", label: "Expert — terminology, conventions, and context were all on-point" },
      { value: "b", label: "Solid working knowledge" },
      { value: "c", label: "Surface-level — needed help on domain specifics" },
      { value: "d", label: "Out of depth in the domain" },
      OPT_E,
    ],
  },
];

export const DOMAIN_SPECIALTY_OPTIONS = [
  "Legal",
  "Medical / Pharmaceutical",
  "Marketing / Transcreation",
  "Technical / IT",
  "Financial / Banking",
  "Literary / Publishing",
  "Government / NGO",
  "Other",
] as const;

export type WouldWorkAgain = "yes" | "probably" | "probably_not" | "no";

export const WOULD_WORK_AGAIN_OPTIONS: { value: WouldWorkAgain; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "probably", label: "Probably" },
  { value: "probably_not", label: "Probably not" },
  { value: "no", label: "No" },
];

// --- Year verification (2026-05-19) --------------------------------------
// Applicant declares an approximate start year when submitting the reference
// contact. Reference confirms or corrects on the questionnaire. Server-side
// classification (matches/close/disagrees/cant_recall) is computed in
// cvp-submit-reference-feedback — see that function for the tolerance rules.

export const REFERENCE_YEAR_MIN = 1980;
/** Acceptable upper bound = current year + 1 (end-of-year edge cases). */
export const referenceYearMax = (): number => new Date().getUTCFullYear() + 1;

/** Inclusive descending year list for the dropdown UI. */
export function referenceYearOptions(): number[] {
  const out: number[] = [];
  for (let y = referenceYearMax(); y >= REFERENCE_YEAR_MIN; y -= 1) out.push(y);
  return out;
}

export type YearMatchChoice = "yes_matches" | "actually_different" | "cant_recall";

/** Reference-side state for the year-verification block. */
export interface ReferenceYearAnswer {
  choice: YearMatchChoice | null;
  /** Required when choice = "actually_different"; ignored otherwise. */
  correctedYear: number | null;
}

export function isReferenceYearAnswerValid(
  applicantStatedYear: number | null,
  applicantYearUnknown: boolean,
  answer: ReferenceYearAnswer,
): boolean {
  // No question was shown when applicant didn't provide a year.
  if (applicantYearUnknown || applicantStatedYear == null) return true;
  if (answer.choice === "yes_matches" || answer.choice === "cant_recall") return true;
  if (answer.choice === "actually_different") {
    return (
      answer.correctedYear != null &&
      Number.isInteger(answer.correctedYear) &&
      answer.correctedYear >= REFERENCE_YEAR_MIN &&
      answer.correctedYear <= referenceYearMax()
    );
  }
  return false;
}

/** Maps reference-side UI answer to the {confirmedStartYear, yearCantRecall}
 *  shape that cvp-submit-reference-feedback expects. */
export function referenceYearAnswerToPayload(
  applicantStatedYear: number | null,
  applicantYearUnknown: boolean,
  answer: ReferenceYearAnswer,
): { confirmedStartYear: number | null; yearCantRecall: boolean } | null {
  if (applicantYearUnknown || applicantStatedYear == null) return null;
  if (answer.choice === "yes_matches") {
    return { confirmedStartYear: applicantStatedYear, yearCantRecall: false };
  }
  if (answer.choice === "actually_different") {
    return { confirmedStartYear: answer.correctedYear, yearCantRecall: false };
  }
  if (answer.choice === "cant_recall") {
    return { confirmedStartYear: null, yearCantRecall: true };
  }
  return null;
}

// --- Domain verification (2026-05-19) ------------------------------------
// Applicant picks (multi-select) the domains they worked on with each
// reference. Reference confirms by ticking matches + can add free text.
// Server (cvp-submit-reference-feedback) classifies the overlap into
// matches/partial/disjoint/cant_recall.

// Domain codes are now dynamic — the referee confirms the applicant's CLAIMED
// approval domains (cvp_applications.domains_offered, 23-code set), passed into
// the form via the validateOnly resolve. Kept as a string alias so the
// confirmed-domains flow accepts any claimed code. The legacy 8-entry
// DOMAIN_OPTIONS below remains as a fallback when an application declares none.
export type DomainCode = string;

export const DOMAIN_OPTIONS: { code: DomainCode; label: string }[] = [
  { code: "legal", label: "Legal" },
  { code: "medical_pharma", label: "Medical / Pharmaceutical" },
  { code: "marketing_transcreation", label: "Marketing / Transcreation" },
  { code: "technical_it", label: "Technical / IT" },
  { code: "financial_banking", label: "Financial / Banking" },
  { code: "literary_publishing", label: "Literary / Publishing" },
  { code: "government_ngo", label: "Government / NGO" },
  { code: "other", label: "Other" },
];

export const DOMAIN_LABEL: Record<DomainCode, string> = Object.fromEntries(
  DOMAIN_OPTIONS.map((o) => [o.code, o.label]),
) as Record<DomainCode, string>;

/** Reference-side state for the domain-verification block. */
export interface ReferenceDomainAnswer {
  /** Domain codes the reference ticked (subset of applicant's stated list). */
  confirmedDomains: DomainCode[];
  /** Free text for the "Other" entry when the applicant included `other`,
   *  OR when the reference adds a new "actually we worked on..." entry. */
  otherDomainText: string;
  /** True when reference picked "I can't recall the domains". */
  cantRecall: boolean;
}

export function emptyReferenceDomainAnswer(): ReferenceDomainAnswer {
  return { confirmedDomains: [], otherDomainText: "", cantRecall: false };
}

export function isReferenceDomainAnswerValid(
  _applicantStatedDomains: DomainCode[] | null,
  _applicantDomainsUnknown: boolean,
  answer: ReferenceDomainAnswer,
): boolean {
  // Multi-select is always shown to the reference now (PR #188): either
  // anchored to applicant's declared list, or as a free pick across all 8
  // options when applicant skipped. Either way, the reference must pick at
  // least one OR explicitly opt out. Params kept for call-site symmetry
  // with the pre-#188 signature.
  if (answer.cantRecall) return true;
  return answer.confirmedDomains.length > 0;
}

/** Maps reference-side answer to the payload cvp-submit-reference-feedback
 *  expects. Always returns a payload (even when applicant didn't anchor) so
 *  the reference's declared domains get recorded — server marks
 *  domain_verification=NULL when there's no applicant anchor to compare. */
export function referenceDomainAnswerToPayload(
  _applicantStatedDomains: DomainCode[] | null,
  _applicantDomainsUnknown: boolean,
  answer: ReferenceDomainAnswer,
): {
  confirmedDomains: DomainCode[];
  confirmedOtherDomainText: string | null;
  domainsCantRecall: boolean;
} {
  if (answer.cantRecall) {
    return { confirmedDomains: [], confirmedOtherDomainText: null, domainsCantRecall: true };
  }
  return {
    confirmedDomains: answer.confirmedDomains,
    confirmedOtherDomainText:
      answer.confirmedDomains.includes("other") && answer.otherDomainText.trim().length > 0
        ? answer.otherDomainText.trim().slice(0, 200)
        : null,
    domainsCantRecall: false,
  };
}

export interface CompetenceResponses {
  translation_competence: McqAnswer;
  linguistic_textual_competence: McqAnswer;
  research_competence: McqAnswer;
  cultural_competence: McqAnswer;
  technical_competence: McqAnswer;
  domain_competence: McqAnswer;
  domain_specialty: string | null;
  would_work_again: WouldWorkAgain;
}

/** One full 6-MCQ answer set (without the global would_work_again /
 *  domain_specialty fields). Used by per-domain mode. */
export type McqSet = Partial<Pick<
  CompetenceResponses,
  | "translation_competence"
  | "linguistic_textual_competence"
  | "research_competence"
  | "cultural_competence"
  | "technical_competence"
  | "domain_competence"
>>;

export const MCQ_SLUGS = [
  "translation_competence",
  "linguistic_textual_competence",
  "research_competence",
  "cultural_competence",
  "technical_competence",
  "domain_competence",
] as const;

export function isMcqSetComplete(set: McqSet | undefined): boolean {
  if (!set) return false;
  return MCQ_SLUGS.every((slug) =>
    ["a", "b", "c", "d", "e"].includes((set[slug] as string) ?? ""),
  );
}

/**
 * Validates a candidate competence_responses object. Returns the
 * normalised payload if valid, else an error string.
 */
export function validateCompetenceResponses(
  input: unknown,
): { ok: true; data: CompetenceResponses } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "missing" };
  const obj = input as Record<string, unknown>;
  const slugs = REFERENCE_MCQS.map((q) => q.slug);
  for (const slug of slugs) {
    if (!["a", "b", "c", "d", "e"].includes(obj[slug] as string)) {
      return { ok: false, error: `missing or invalid: ${slug}` };
    }
  }
  if (!["yes", "probably", "probably_not", "no"].includes(obj.would_work_again as string)) {
    return { ok: false, error: "missing or invalid: would_work_again" };
  }
  const specialty = obj.domain_specialty;
  if (specialty != null && typeof specialty !== "string") {
    return { ok: false, error: "domain_specialty must be string or null" };
  }
  return {
    ok: true,
    data: {
      translation_competence: obj.translation_competence as McqAnswer,
      linguistic_textual_competence: obj.linguistic_textual_competence as McqAnswer,
      research_competence: obj.research_competence as McqAnswer,
      cultural_competence: obj.cultural_competence as McqAnswer,
      technical_competence: obj.technical_competence as McqAnswer,
      domain_competence: obj.domain_competence as McqAnswer,
      domain_specialty: specialty ? String(specialty).slice(0, 200) : null,
      would_work_again: obj.would_work_again as WouldWorkAgain,
    },
  };
}

// --- Engagement details (2026-06-23) -------------------------------------
// Richer §3.1.4 context the referee attests to: full-time/part-time, annual
// volume, period end / still-ongoing, independence, and the referee's own
// role + how they worked with the applicant.

export type EmploymentType = "full_time" | "part_time" | "unsure";
export const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full-time translator" },
  { value: "part_time", label: "Part-time / occasional" },
  { value: "unsure", label: "Not sure" },
];

export type AnnualVolume = "lt_50k" | "50k_150k" | "150k_500k" | "gt_500k" | "unsure";
export const ANNUAL_VOLUME_OPTIONS: { value: AnnualVolume; label: string }[] = [
  { value: "lt_50k", label: "Under 50,000 words / year" },
  { value: "50k_150k", label: "50,000–150,000 words / year" },
  { value: "150k_500k", label: "150,000–500,000 words / year" },
  { value: "gt_500k", label: "Over 500,000 words / year" },
  { value: "unsure", label: "Not sure" },
];

export type RelationshipType =
  | "client" | "employer" | "project_manager" | "reviser_editor" | "peer_translator" | "other";
export const RELATIONSHIP_TYPE_OPTIONS: { value: RelationshipType; label: string }[] = [
  { value: "client", label: "I was their client" },
  { value: "employer", label: "I was their employer / manager" },
  { value: "project_manager", label: "I was their project manager" },
  { value: "reviser_editor", label: "I revised / edited their translations" },
  { value: "peer_translator", label: "Peer / fellow translator" },
  { value: "other", label: "Other" },
];

/** Reference-side state for the engagement-details block. */
export interface EngagementAnswer {
  employmentType: EmploymentType | null;
  annualVolume: AnnualVolume | null;
  relationshipOngoing: boolean;
  endYear: number | null;
  /** Independence attestation. true = not a relative / no financial stake. */
  independent: boolean | null;
  independenceNote: string;
  relationshipType: RelationshipType | null;
  roleTitle: string;
  relationshipOther: string;
}

export function emptyEngagementAnswer(): EngagementAnswer {
  return {
    employmentType: null,
    annualVolume: null,
    relationshipOngoing: false,
    endYear: null,
    independent: null,
    independenceNote: "",
    relationshipType: null,
    roleTitle: "",
    relationshipOther: "",
  };
}

/** Required: employment type, relationship type, independence answer. Other
 *  fields optional; end year (when not ongoing) must be in range if given. */
export function isEngagementAnswerValid(a: EngagementAnswer): boolean {
  if (!a.employmentType) return false;
  if (!a.relationshipType) return false;
  if (a.relationshipType === "other" && a.relationshipOther.trim().length === 0) return false;
  if (a.independent == null) return false;
  if (!a.relationshipOngoing && a.endYear != null) {
    if (!Number.isInteger(a.endYear) || a.endYear < REFERENCE_YEAR_MIN || a.endYear > referenceYearMax()) {
      return false;
    }
  }
  return true;
}
