import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ServiceOption {
  id: string
  code: string
  name: string
  category: 'translation' | 'review_qa' | 'interpretation' | 'multimedia' | 'technology' | 'other'
  default_calculation_units: string[]
  sort_order: number
}

const CATEGORY_ORDER: ServiceOption['category'][] = [
  'translation',
  'review_qa',
  'interpretation',
  'multimedia',
  'technology',
  'other',
]

export const CATEGORY_LABELS: Record<ServiceOption['category'], string> = {
  translation: 'Translation',
  review_qa: 'Review & QA',
  interpretation: 'Interpretation',
  multimedia: 'Multimedia',
  technology: 'Technology',
  other: 'Other',
}

// Codes we never offer in the recruitment form — surcharge types, not skills.
const EXCLUDED_CODES = new Set(['rush_handling'])

export function useServices() {
  const [services, setServices] = useState<ServiceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, code, name, category, default_calculation_units, sort_order')
        .eq('is_active', true)
        .eq('vendor_facing', true)
        .order('category')
        .order('sort_order')
      if (cancelled) return
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      const filtered = (data as ServiceOption[])
        .filter((s) => !EXCLUDED_CODES.has(s.code))
        .sort((a, b) => {
          const ca = CATEGORY_ORDER.indexOf(a.category)
          const cb = CATEGORY_ORDER.indexOf(b.category)
          if (ca !== cb) return ca - cb
          return a.sort_order - b.sort_order
        })
      setServices(filtered)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { services, loading, error }
}

export const UNIT_LABELS: Record<string, string> = {
  per_word: 'per word',
  per_page: 'per page',
  per_hour: 'per hour',
  per_minute: 'per minute',
  per_project: 'per project',
  per_day: 'per day',
}

export function serviceIsRateRequired(serviceCode: string): boolean {
  // Translation services require a rate; review/QA and everything else is optional.
  return serviceCode.endsWith('_translation') ||
    serviceCode === 'standard_translation' ||
    serviceCode === 'certified_translation' ||
    serviceCode === 'sworn_translation'
}
