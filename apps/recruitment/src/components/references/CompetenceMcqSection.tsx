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
  REFERENCE_YEAR_MIN,
  referenceYearMax,
  referenceYearOptions,
  DOMAIN_OPTIONS,
  DOMAIN_LABEL,
  type CompetenceResponses,
  type McqAnswer,
  type ReferenceYearAnswer,
  type YearMatchChoice,
  type DomainCode,
  type ReferenceDomainAnswer,
  type McqSet,
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
  /** Domain-verification context. Multi-select always shown — anchored to
   *  applicant's declared list when present, free pick of all 8 options
   *  otherwise. */
  applicantStatedDomains: DomainCode[] | null;
  applicantOtherDomainText: string | null;
  applicantDomainsUnknown: boolean;
  domainAnswer: ReferenceDomainAnswer;
  onDomainAnswerChange: (next: ReferenceDomainAnswer) => void;
  /** Per-domain MCQ mode (PR #188). When false (default), the 6-MCQ block
   *  is shown once and the reference's answers apply to all confirmed
   *  domains. When true, the block repeats per confirmed domain so the
   *  reference can rate the applicant differently across domains. */
  answeredPerDomain: boolean;
  onAnsweredPerDomainChange: (v: boolean) => void;
  mcqByDomain: Partial<Record<DomainCode, McqSet>>;
  onMcqByDomainChange: (next: Partial<Record<DomainCode, McqSet>>) => void;
}

export function CompetenceMcqSection({
  vendorFirstName,
  value,
  onChange,
  applicantStatedYear,
  applicantYearUnknown,
  yearAnswer,
  onYearAnswerChange,
  applicantStatedDomains,
  applicantOtherDomainText,
  applicantDomainsUnknown,
  domainAnswer,
  onDomainAnswerChange,
  answeredPerDomain,
  onAnsweredPerDomainChange,
  mcqByDomain,
  onMcqByDomainChange,
}: Props) {
  const setAnswer = (slug: keyof CompetenceResponses, v: McqAnswer | string | null) => {
    onChange({ ...value, [slug]: v });
  };

  const setPerDomainAnswer = (code: DomainCode, slug: keyof McqSet, v: McqAnswer) => {
    const prev = mcqByDomain[code] ?? {};
    onMcqByDomainChange({ ...mcqByDomain, [code]: { ...prev, [slug]: v } });
  };

  const setYearChoice = (choice: YearMatchChoice) => {
    if (choice === "actually_different") {
      onYearAnswerChange({ choice, correctedYear: yearAnswer.correctedYear ?? null });
    } else {
      onYearAnswerChange({ choice, correctedYear: null });
    }
  };

  const showYearBlock = !applicantYearUnknown && applicantStatedYear != null;
  // Domain block now ALWAYS shows (PR #188): anchored to applicant's
  // declared list when present, free pick of all 8 options when applicant
  // skipped/didn't declare.
  const hasApplicantDomainAnchor =
    !applicantDomainsUnknown && applicantStatedDomains != null && applicantStatedDomains.length > 0;
  const domainCheckboxCodes: DomainCode[] = hasApplicantDomainAnchor
    ? applicantStatedDomains!
    : DOMAIN_OPTIONS.map((o) => o.code);

  const toggleConfirmDomain = (code: DomainCode) => {
    const has = domainAnswer.confirmedDomains.includes(code);
    const nextCodes = has
      ? domainAnswer.confirmedDomains.filter((c) => c !== code)
      : [...domainAnswer.confirmedDomains, code];
    onDomainAnswerChange({
      ...domainAnswer,
      confirmedDomains: nextCodes,
      // Picking any domain clears "I can't recall".
      cantRecall: nextCodes.length > 0 ? false : domainAnswer.cantRecall,
      // Clear free text if 'other' was unticked.
      otherDomainText: nextCodes.includes("other") ? domainAnswer.otherDomainText : "",
    });
  };

  const labelForCode = (code: DomainCode): string => {
    if (code === "other" && applicantOtherDomainText) return `Other (${applicantOtherDomainText})`;
    return DOMAIN_LABEL[code] ?? code;
  };

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

      <fieldset className="border border-gray-200 rounded-lg p-4 bg-amber-50/40">
        <legend className="px-1 text-sm font-medium text-gray-900">
          {hasApplicantDomainAnchor
            ? `${vendorFirstName} said you worked together on the domain(s) below. Tick the ones that match what you actually did together.`
            : `Which domain(s) did you work with ${vendorFirstName} in?`}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
          {domainCheckboxCodes.map((code) => {
            const checked = domainAnswer.confirmedDomains.includes(code);
            return (
              <label
                key={code}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer ${
                  domainAnswer.cantRecall ? "opacity-50" : "hover:bg-gray-50"
                } ${checked ? "bg-teal-50 border border-teal-200" : "border border-transparent"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={domainAnswer.cantRecall}
                  onChange={() => toggleConfirmDomain(code)}
                />
                <span className="text-gray-800">{labelForCode(code)}</span>
              </label>
            );
          })}
        </div>
        {domainAnswer.confirmedDomains.includes("other") && !domainAnswer.cantRecall && (
          <input
            type="text"
            value={domainAnswer.otherDomainText}
            onChange={(e) =>
              onDomainAnswerChange({
                ...domainAnswer,
                otherDomainText: e.target.value.slice(0, 200),
              })
            }
            placeholder={
              hasApplicantDomainAnchor
                ? "Describe the 'Other' domain in your own words (optional)"
                : "Describe the domain (e.g. patent law)"
            }
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        )}
        <label className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={domainAnswer.cantRecall}
            onChange={(e) =>
              onDomainAnswerChange({
                confirmedDomains: e.target.checked ? [] : domainAnswer.confirmedDomains,
                otherDomainText: e.target.checked ? "" : domainAnswer.otherDomainText,
                cantRecall: e.target.checked,
              })
            }
          />
          I can't recall the domains we worked on
        </label>
      </fieldset>

      {/* Per-domain MCQ toggle — only shown when reference confirmed
          2+ domains. With one domain, "per-domain" and "single" are
          equivalent so we hide the toggle. */}
      {domainAnswer.confirmedDomains.length >= 2 && !domainAnswer.cantRecall && (
        <fieldset className="border border-gray-200 rounded-lg p-4 bg-sky-50/40">
          <legend className="px-1 text-sm font-medium text-gray-900">
            How would you like to answer the questions below?
          </legend>
          <div className="space-y-1.5 mt-2">
            <label
              className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                !answeredPerDomain
                  ? "bg-teal-50 border border-teal-200"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="answered_per_domain"
                checked={!answeredPerDomain}
                onChange={() => onAnsweredPerDomainChange(false)}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">
                <strong>Once</strong> — my answers apply to all the domains I confirmed above.
              </span>
            </label>
            <label
              className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                answeredPerDomain
                  ? "bg-teal-50 border border-teal-200"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="answered_per_domain"
                checked={answeredPerDomain}
                onChange={() => onAnsweredPerDomainChange(true)}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">
                <strong>Separately for each domain</strong> — I'll rate {vendorFirstName} differently across the domains we worked on.
              </span>
            </label>
          </div>
        </fieldset>
      )}

      {/* MCQ block(s): single set OR repeated per confirmed domain. */}
      {answeredPerDomain && domainAnswer.confirmedDomains.length >= 2 && !domainAnswer.cantRecall
        ? domainAnswer.confirmedDomains.map((code) => (
            <div key={`mcq-${code}`} className="space-y-3">
              <div className="text-sm font-semibold text-gray-900 px-1">
                Domain: <span className="text-teal-700">{labelForCode(code)}</span>
              </div>
              {REFERENCE_MCQS.map((q) => {
                const prompt = q.prompt.replace(/\{\{name\}\}/g, vendorFirstName);
                const current = (mcqByDomain[code] ?? {})[q.slug] as McqAnswer | undefined;
                return (
                  <fieldset key={`${code}-${q.slug}`} className="border border-gray-200 rounded-lg p-4">
                    <legend className="px-1 text-sm font-medium text-gray-900">{prompt}</legend>
                    <div className="space-y-1.5 mt-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                            current === opt.value
                              ? "bg-teal-50 border border-teal-200"
                              : "hover:bg-gray-50 border border-transparent"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`${code}-${q.slug}`}
                            value={opt.value}
                            checked={current === opt.value}
                            onChange={() => setPerDomainAnswer(code, q.slug, opt.value)}
                            className="mt-0.5"
                          />
                          <span className="text-sm text-gray-800">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          ))
        : REFERENCE_MCQS.map((q) => {
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
                        current === opt.value
                          ? "bg-teal-50 border border-teal-200"
                          : "hover:bg-gray-50 border border-transparent"
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
