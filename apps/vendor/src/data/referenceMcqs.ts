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
