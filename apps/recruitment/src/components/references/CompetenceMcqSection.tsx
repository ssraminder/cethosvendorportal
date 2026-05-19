/**
 * CompetenceMcqSection
 *
 * Anchored MCQ section on the reference feedback form. Renders one
 * question per ISO 17100 §6.1.2 competence, a "would you work with
 * them again?" Likert, and an optional domain-specialty picker tied to
 * the domain-competence answer.
 *
 * Shared shape: emits a `CompetenceResponses` object on change. Parent
 * decides when to submit; this component is just the form.
 */

import {
  REFERENCE_MCQS,
  WOULD_WORK_AGAIN_OPTIONS,
  DOMAIN_SPECIALTY_OPTIONS,
  REFERENCE_YEAR_MIN,
  referenceYearMax,
  referenceYearOptions,
  type CompetenceResponses,
  type McqAnswer,
  type ReferenceYearAnswer,
  type YearMatchChoice,
} from "../../data/referenceMcqs";

interface Props {
  vendorFirstName: string;
  value: Partial<CompetenceResponses>;
  onChange: (next: Partial<CompetenceResponses>) => void;
  /** Applicant-stated start year passed through from the reference-feedback
   *  validateOnly call. When null OR applicantYearUnknown=true, the year-
   *  verification block is hidden. */
  applicantStatedYear: number | null;
  applicantYearUnknown: boolean;
  yearAnswer: ReferenceYearAnswer;
  onYearAnswerChange: (next: ReferenceYearAnswer) => void;
}

export function CompetenceMcqSection({
  vendorFirstName,
  value,
  onChange,
  applicantStatedYear,
  applicantYearUnknown,
  yearAnswer,
  onYearAnswerChange,
}: Props) {
  const setAnswer = (slug: keyof CompetenceResponses, v: McqAnswer | string | null) => {
    onChange({ ...value, [slug]: v });
  };

  const setYearChoice = (choice: YearMatchChoice) => {
    if (choice === "actually_different") {
      onYearAnswerChange({ choice, correctedYear: yearAnswer.correctedYear ?? null });
    } else {
      onYearAnswerChange({ choice, correctedYear: null });
    }
  };

  const showYearBlock = !applicantYearUnknown && applicantStatedYear != null;

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-700">
        <p>
          Please answer the next questions about <strong>{vendorFirstName}</strong>'s work. Pick the option that best matches what you actually saw — if a question doesn't apply, choose <em>"Can't speak to this"</em>.
        </p>
      </div>

      {showYearBlock && (
        <fieldset className="border border-gray-200 rounded-lg p-4 bg-amber-50/40">
          <legend className="px-1 text-sm font-medium text-gray-900">
            {vendorFirstName} said you started working together around{" "}
            <span className="font-mono">{applicantStatedYear}</span>. Does that match your recollection?
          </legend>
          <div className="space-y-1.5 mt-2">
            <label
              className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                yearAnswer.choice === "yes_matches"
                  ? "bg-teal-50 border border-teal-200"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="year_match"
                checked={yearAnswer.choice === "yes_matches"}
                onChange={() => setYearChoice("yes_matches")}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">Yes, roughly that year</span>
            </label>
            <label
              className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                yearAnswer.choice === "actually_different"
                  ? "bg-teal-50 border border-teal-200"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="year_match"
                checked={yearAnswer.choice === "actually_different"}
                onChange={() => setYearChoice("actually_different")}
                className="mt-0.5"
              />
              <div className="text-sm text-gray-800 flex-1">
                <div className="mb-1">Actually, it was more like…</div>
                {yearAnswer.choice === "actually_different" && (
                  <select
                    value={yearAnswer.correctedYear == null ? "" : String(yearAnswer.correctedYear)}
                    onChange={(e) => {
                      const y = e.target.value ? Number.parseInt(e.target.value, 10) : null;
                      onYearAnswerChange({ choice: "actually_different", correctedYear: y });
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">Select year…</option>
                    {referenceYearOptions().map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                )}
              </div>
            </label>
            <label
              className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                yearAnswer.choice === "cant_recall"
                  ? "bg-teal-50 border border-teal-200"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="year_match"
                checked={yearAnswer.choice === "cant_recall"}
                onChange={() => setYearChoice("cant_recall")}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">I can't recall the exact year</span>
            </label>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Range accepted: {REFERENCE_YEAR_MIN}–{referenceYearMax()}. Approximate is fine.
          </div>
        </fieldset>
      )}

      {REFERENCE_MCQS.map((q) => {
        const prompt = q.prompt.replace(/\{\{name\}\}/g, vendorFirstName);
        const current = value[q.slug] as McqAnswer | undefined;
        return (
          <fieldset key={q.slug} className="border border-gray-200 rounded-lg p-4">
            <legend className="px-1 text-sm font-medium text-gray-900">{prompt}</legend>
            <div className="space-y-1.5 mt-2">
              {q.options.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                    current === opt.value ? "bg-teal-50 border border-teal-200" : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.slug}
                    value={opt.value}
                    checked={current === opt.value}
                    onChange={() => setAnswer(q.slug, opt.value)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-gray-800">{opt.label}</span>
                </label>
              ))}
            </div>

            {/* Inline specialty picker once domain-competence is answered with anything other than (e). */}
            {q.slug === "domain_competence" && current && current !== "e" && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Which domain did you primarily work with {vendorFirstName} in?
                </label>
                <select
                  value={value.domain_specialty ?? ""}
                  onChange={(e) => setAnswer("domain_specialty", e.target.value || null)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select a domain…</option>
                  {DOMAIN_SPECIALTY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>
        );
      })}

      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="px-1 text-sm font-medium text-gray-900">
          Would you work with {vendorFirstName} again on a similar project?
        </legend>
        <div className="flex flex-wrap gap-2 mt-2">
          {WOULD_WORK_AGAIN_OPTIONS.map((opt) => {
            const selected = value.would_work_again === opt.value;
            return (
              <label
                key={opt.value}
                className={`px-3 py-1.5 rounded-full text-sm cursor-pointer ${
                  selected ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="would_work_again"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setAnswer("would_work_again", opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
