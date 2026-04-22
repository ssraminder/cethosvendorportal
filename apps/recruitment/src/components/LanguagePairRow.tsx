import { X, Plus, Trash2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import type { UseFormSetValue, FieldErrors, UseFormWatch } from 'react-hook-form'
import type { Language } from '../types/application'
import type { TranslatorFormData, PairServiceRate } from '../lib/schemas'
import { useServices, CATEGORY_LABELS, UNIT_LABELS, serviceIsRateRequired, type ServiceOption } from '../hooks/useServices'
import { SearchableSelect } from './SearchableSelect'

interface LanguagePairRowProps {
  index: number
  languages: Language[]
  setValue: UseFormSetValue<TranslatorFormData>
  watch: UseFormWatch<TranslatorFormData>
  errors: FieldErrors<TranslatorFormData>
  onRemove: () => void
  canRemove: boolean
  currencyCode: string
  submitAttempted?: boolean
}

export function LanguagePairRow({
  index,
  languages,
  setValue,
  watch,
  errors,
  onRemove,
  canRemove,
  currencyCode,
  submitAttempted = false,
}: LanguagePairRowProps) {
  const pairErrors = errors.languagePairs?.[index]
  const { services, loading: servicesLoading } = useServices()
  const [addingService, setAddingService] = useState(false)
  const [selectedNewCode, setSelectedNewCode] = useState('')
  const [rateTouched, setRateTouched] = useState<Record<string, boolean>>({})

  const languageOptions = useMemo(
    () => languages.map((l) => ({ value: l.id, label: l.name })),
    [languages]
  )

  const pairServices: PairServiceRate[] = watch(`languagePairs.${index}.services`) ?? []

  // Group services by category for the picker.
  const servicesByCategory = services.reduce<Record<string, ServiceOption[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  const addService = () => {
    if (!selectedNewCode) return
    const svc = services.find((s) => s.code === selectedNewCode)
    if (!svc) return
    if (pairServices.some((p) => p.serviceCode === selectedNewCode)) {
      setSelectedNewCode('')
      setAddingService(false)
      return
    }
    const defaultUnit = svc.default_calculation_units[0] ?? 'per_word'
    const next: PairServiceRate[] = [
      ...pairServices,
      { serviceCode: svc.code, unit: defaultUnit, rate: '', minimumCharge: '' },
    ]
    setValue(`languagePairs.${index}.services`, next, { shouldDirty: true, shouldValidate: true })
    setSelectedNewCode('')
    setAddingService(false)
  }

  const removeService = (serviceCode: string) => {
    setValue(
      `languagePairs.${index}.services`,
      pairServices.filter((p) => p.serviceCode !== serviceCode),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  const updatePairServiceField = (
    serviceCode: string,
    field: 'unit' | 'rate' | 'minimumCharge',
    value: string
  ) => {
    setValue(
      `languagePairs.${index}.services`,
      pairServices.map((p) => (p.serviceCode === serviceCode ? { ...p, [field]: value } : p)),
      { shouldDirty: true, shouldValidate: field === 'rate' }
    )
  }

  // Services already selected elsewhere on this pair — hide from picker.
  const remainingServices = services.filter(
    (s) => !pairServices.some((ps) => ps.serviceCode === s.code)
  )

  const renderPairServiceRow = (row: PairServiceRate) => {
    const svc = services.find((s) => s.code === row.serviceCode)
    if (!svc) return null
    const units = svc.default_calculation_units
    const required = serviceIsRateRequired(svc.code)
    const showRateError = (submitAttempted || rateTouched[svc.code]) && required && !row.rate
    const rateFieldError = showRateError ? 'Rate required' : null

    return (
      <div
        key={row.serviceCode}
        className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-800 truncate">{svc.name}</div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">
              {CATEGORY_LABELS[svc.category]}
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeService(svc.code)}
            className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
            aria-label={`Remove ${svc.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-12 gap-2 items-end">
          <div className="col-span-5">
            <label className="block text-[11px] text-gray-500 mb-1">
              Rate {required ? <span className="text-red-600">*</span> : <span className="text-gray-400">(optional)</span>}
            </label>
            <div className="flex items-stretch">
              <span className="inline-flex items-center px-2 text-xs text-gray-600 bg-white border border-r-0 border-gray-300 rounded-l-md">
                {currencyCode || '—'}
              </span>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={row.rate ?? ''}
                onChange={(e) => updatePairServiceField(svc.code, 'rate', e.target.value)}
                onBlur={() => setRateTouched((s) => ({ ...s, [svc.code]: true }))}
                className="w-full rounded-r-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal"
                placeholder={required ? '0.18' : '—'}
              />
            </div>
            {rateFieldError && (
              <p className="mt-1 text-[11px] text-red-600">{rateFieldError}</p>
            )}
          </div>
          <div className="col-span-4">
            <label className="block text-[11px] text-gray-500 mb-1">Unit</label>
            <select
              value={row.unit}
              onChange={(e) => updatePairServiceField(svc.code, 'unit', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal"
            >
              {units.map((u) => (
                <option key={u} value={u}>{UNIT_LABELS[u] ?? u}</option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-[11px] text-gray-500 mb-1">Min. charge</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={row.minimumCharge ?? ''}
              onChange={(e) => updatePairServiceField(svc.code, 'minimumCharge', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal"
              placeholder="—"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-cethos-navy">
          Language Pair {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Remove language pair"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Source language *</label>
          <SearchableSelect
            options={languageOptions}
            value={watch(`languagePairs.${index}.sourceLanguageId`) ?? ''}
            onChange={(v) => setValue(
              `languagePairs.${index}.sourceLanguageId`,
              v,
              { shouldValidate: true, shouldDirty: true }
            )}
            placeholder="Select source…"
            clearable
          />
          {pairErrors?.sourceLanguageId && (
            <p className="mt-1 text-xs text-red-600">{pairErrors.sourceLanguageId.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Target language *</label>
          <SearchableSelect
            options={languageOptions}
            value={watch(`languagePairs.${index}.targetLanguageId`) ?? ''}
            onChange={(v) => setValue(
              `languagePairs.${index}.targetLanguageId`,
              v,
              { shouldValidate: true, shouldDirty: true }
            )}
            placeholder="Select target…"
            clearable
          />
          {pairErrors?.targetLanguageId && (
            <p className="mt-1 text-xs text-red-600">{pairErrors.targetLanguageId.message}</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs text-gray-500">Services & rates for this pair *</label>
          {!addingService && remainingServices.length > 0 && (
            <button
              type="button"
              onClick={() => setAddingService(true)}
              className="inline-flex items-center gap-1 text-xs text-cethos-teal hover:text-cethos-teal"
            >
              <Plus className="w-3.5 h-3.5" /> Add service
            </button>
          )}
        </div>

        {addingService && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-cethos-bg-blue border border-cethos-teal rounded-md">
            <select
              value={selectedNewCode}
              onChange={(e) => setSelectedNewCode(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal"
            >
              <option value="">Select a service...</option>
              {Object.entries(servicesByCategory).map(([cat, list]) => {
                const remaining = list.filter(
                  (s) => !pairServices.some((ps) => ps.serviceCode === s.code)
                )
                if (remaining.length === 0) return null
                return (
                  <optgroup key={cat} label={CATEGORY_LABELS[cat as ServiceOption['category']] ?? cat}>
                    {remaining.map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            <button
              type="button"
              onClick={addService}
              disabled={!selectedNewCode}
              className="rounded-md bg-cethos-teal px-3 py-1.5 text-xs text-white font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingService(false)
                setSelectedNewCode('')
              }}
              className="rounded-md bg-white px-3 py-1.5 text-xs text-cethos-navy border border-gray-300"
            >
              Cancel
            </button>
          </div>
        )}

        {servicesLoading && pairServices.length === 0 && (
          <p className="text-xs text-gray-400">Loading services…</p>
        )}

        {pairServices.length === 0 && !servicesLoading && !addingService && (
          <p className="text-xs text-gray-500 italic">
            No services added yet. Click <span className="font-medium">Add service</span> to list what you offer for this language pair.
          </p>
        )}

        <div className="space-y-2">
          {pairServices.map(renderPairServiceRow)}
        </div>

        {pairErrors?.services && (
          <p className="mt-1 text-xs text-red-600">{(pairErrors.services as { message?: string })?.message}</p>
        )}
      </div>
    </div>
  )
}
