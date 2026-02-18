import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Language } from '../types/application'

export function useLanguages() {
  const [languages, setLanguages] = useState<Language[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLanguages() {
      const { data, error: fetchError } = await supabase
        .from('languages')
        .select('id, name, code, is_active')
        .eq('is_active', true)
        .order('name')

      if (fetchError) {
        setError('Failed to load languages. Please refresh the page.')
        console.error('Error fetching languages:', fetchError)
      } else {
        setLanguages(data ?? [])
      }
      setLoading(false)
    }

    fetchLanguages()
  }, [])

  return { languages, loading, error }
}
