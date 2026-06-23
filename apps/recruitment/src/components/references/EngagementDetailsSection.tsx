/**
 * EngagementDetailsSection
 *
 * Referee-form block (2026-06-23) capturing the engagement context the referee
 * can attest to, for ISO 17100 §3.1.4 evidence:
 *   - how they worked with the applicant (relationship type + their own role)
 *   - full-time vs part-time + approximate annual volume
 *   - period end / still ongoing
 *   - independence attestation (not a relative / no financial stake)
 *
 * Emits an EngagementAnswer on change; the parent submits it.
 */

import {
  EMPLOYMENT_TYPE_OPTIONS,
  ANNUAL_VOLUME_OPTIONS,
  RELATIONSHIP_TYPE_OPTIONS,
  REFERENCE_YEAR_MIN,
  referenceYearMax,
  referenceYearOptions,
  type EngagementAnswer,
  type EmploymentType,
  type AnnualVolume,
  type RelationshipType,
} from "../../data/referenceMcqs";

interface Props {
  vendorFirstName: string;
  value: EngagementAnswer;
  onChange: (next: EngagementAnswer) => void;
}

const radioRow = (selected: boolean) =>
  `flex items-start gap-2 p-2 rounded cursor-pointer ${
    selected ? "bg-teal-50 border border-teal-200" : "hover:bg-gray-50 border border-transparent"
  }`;

export function EngagementDetailsSection({ vendorFirstName, value, onChange }: Props) {
  const set = (patch: Partial<EngagementAnswer>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-6">
      {/* Relationship type + role */}
      <fieldset className="border border-gray-200 rounded-lg p-4 bg-amber-50/40">
        <legend className="px-1 text-sm font-medium text-gray-900">
          How did you work with {vendorFirstName}?
        </legend>
        <div className="space-y-1.5 mt-2">
          {RELATIONSHIP_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className={radioRow(value.relationshipType === opt.value)}>
              <input
                type="radio"
                name="relationship_type"
                checked={value.relationshipType === opt.value}
                onChange={() => set({ relationshipType: opt.value as RelationshipType })}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">{opt.label}</span>
            </label>
          ))}
        </div>
        {value.relationshipType === "other" && (
          <input
            type="text"
            value={value.relationshipOther}
            onChange={(e) => set({ relationshipOther: e.target.value.slice(0, 200) })}
            placeholder="Describe how you worked together"
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        )}
        <input
          type="text"
          value={value.roleTitle}
          onChange={(e) => set({ roleTitle: e.target.value.slice(0, 200) })}
          placeholder="Your job title / role (e.g. Senior Project Manager) — optional"
          className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </fieldset>

      {/* Full-time / part-time */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="px-1 text-sm font-medium text-gray-900">
          As far as you know, did {vendorFirstName} work as a full-time or part-time translator?
        </legend>
        <div className="space-y-1.5 mt-2">
          {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className={radioRow(value.employmentType === opt.value)}>
              <input
                type="radio"
                name="employment_type"
                checked={value.employmentType === opt.value}
                onChange={() => set({ employmentType: opt.value as EmploymentType })}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Annual volume */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="px-1 text-sm font-medium text-gray-900">
          Roughly how much translation did {vendorFirstName} do per year, in your experience?{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </legend>
        <div className="space-y-1.5 mt-2">
          {ANNUAL_VOLUME_OPTIONS.map((opt) => (
            <label key={opt.value} className={radioRow(value.annualVolume === opt.value)}>
              <input
                type="radio"
                name="annual_volume"
                checked={value.annualVolume === opt.value}
                onChange={() => set({ annualVolume: opt.value as AnnualVolume })}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Period end / ongoing */}
      <fieldset className="border border-gray-200 rounded-lg p-4 bg-amber-50/40">
        <legend className="px-1 text-sm font-medium text-gray-900">
          Are you still working with {vendorFirstName}?
        </legend>
        <div className="space-y-1.5 mt-2">
          <label className={radioRow(value.relationshipOngoing)}>
            <input
              type="radio"
              name="relationship_ongoing"
              checked={value.relationshipOngoing}
              onChange={() => set({ relationshipOngoing: true, endYear: null })}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-800">Yes — still ongoing</span>
          </label>
          <label className={radioRow(!value.relationshipOngoing)}>
            <input
              type="radio"
              name="relationship_ongoing"
              checked={!value.relationshipOngoing}
              onChange={() => set({ relationshipOngoing: false })}
              className="mt-0.5"
            />
            <div className="text-sm text-gray-800 flex-1">
              <div className="mb-1">No — we last worked together around…</div>
              {!value.relationshipOngoing && (
                <select
                  value={value.endYear == null ? "" : String(value.endYear)}
                  onChange={(e) =>
                    set({ endYear: e.target.value ? Number.parseInt(e.target.value, 10) : null })
                  }
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Select year… (optional)</option>
                  {referenceYearOptions().map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              )}
            </div>
          </label>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Range accepted: {REFERENCE_YEAR_MIN}–{referenceYearMax()}.
        </div>
      </fieldset>

      {/* Independence attestation */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="px-1 text-sm font-medium text-gray-900">
          Are you independent of {vendorFirstName}?
        </legend>
        <div className="space-y-1.5 mt-2">
          <label className={radioRow(value.independent === true)}>
            <input
              type="radio"
              name="independent"
              checked={value.independent === true}
              onChange={() => set({ independent: true, independenceNote: "" })}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-800">
              Yes — I'm not a relative and have no financial stake in their application.
            </span>
          </label>
          <label className={radioRow(value.independent === false)}>
            <input
              type="radio"
              name="independent"
              checked={value.independent === false}
              onChange={() => set({ independent: false })}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-800">
              No / not entirely (e.g. a relative, business partner, or financial interest).
            </span>
          </label>
        </div>
        {value.independent === false && (
          <input
            type="text"
            value={value.independenceNote}
            onChange={(e) => set({ independenceNote: e.target.value.slice(0, 500) })}
            placeholder="Briefly describe the relationship (optional)"
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        )}
      </fieldset>
    </div>
  );
}
