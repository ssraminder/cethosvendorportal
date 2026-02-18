import { X } from 'lucide-react'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import { DOMAIN_OPTIONS } from '../lib/constants'
import type { Language } from '../types/application'
import type { TranslatorFormData } from '../lib/schemas'

interface LanguagePairRowProps {
  index: number
  languages: Language[]
  register: UseFormRegister<TranslatorFormData>
  errors: FieldErrors<TranslatorFormData>
  onRemove: () => void
  canRemove: boolean
  selectedDomains: string[]
  onToggleDomain: (domain: string) => void
}

export function LanguagePairRow({
  index,
  languages,
  register,
  errors,
  onRemove,
  canRemove,
  selectedDomains,
  onToggleDomain,
}: LanguagePairRowProps) {
  const pairErrors = errors.languagePairs?.[index]

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
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
          <select
            {...register(`languagePairs.${index}.sourceLanguageId`)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select...</option>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          {pairErrors?.sourceLanguageId && (
            <p className="mt-1 text-xs text-red-600">{pairErrors.sourceLanguageId.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Target language *</label>
          <select
            {...register(`languagePairs.${index}.targetLanguageId`)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select...</option>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          {pairErrors?.targetLanguageId && (
            <p className="mt-1 text-xs text-red-600">{pairErrors.targetLanguageId.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-2">Domains *</label>
        <div className="flex flex-wrap gap-2">
          {DOMAIN_OPTIONS.map((domain) => (
            <label
              key={domain.value}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${
                selectedDomains.includes(domain.value)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedDomains.includes(domain.value)}
                onChange={() => onToggleDomain(domain.value)}
              />
              {domain.label}
            </label>
          ))}
        </div>
        {pairErrors?.domains && (
          <p className="mt-1 text-xs text-red-600">{pairErrors.domains.message}</p>
        )}
      </div>
    </div>
  )
}
