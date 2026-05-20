// Right-to-left language detection by ISO code (matches public.languages.code).
// Set is small and stable — no need for a DB column.
const RTL_CODES = new Set<string>([
  'ar', 'ar-EG', 'ar-SA', 'ar-LB', 'ar-MA',
  'he', 'fa', 'prs', 'ps', 'ur', 'ckb', 'yi',
])

export function isRtlCode(code: string | null | undefined): boolean {
  if (!code) return false
  if (RTL_CODES.has(code)) return true
  return code.startsWith('ar-')
}
