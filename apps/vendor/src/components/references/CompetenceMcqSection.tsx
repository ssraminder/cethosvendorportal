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
  type CompetenceResponses,
  type McqAnswer,
} from "../../data/referenceMcqs";

interface Props {
  vendorFirstName: string;
  value: Partial<CompetenceResponses>;
  onChange: (next: Partial<CompetenceResponses>) => void;
}

export function CompetenceMcqSection({ vendorFirstName, value, onChange }: Props) {
  const setAnswer = (slug: keyof CompetenceResponses, v: McqAnswer | string | null) => {
    onChange({ ...value, [slug]: v });
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-700">
        <p>
          Please answer the next questions about <strong>{vendorFirstName}</strong>'s work. Pick the option that best matches what you actually saw — if a question doesn't apply, choose <em>"Can't speak to this"</em>.
        </p>
      </div>

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
