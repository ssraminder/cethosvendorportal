// Applicant-wide domain options. Value strings match the CHECK constraint on
// cvp_test_combinations.domain / cvp_test_library.domain (see migration
// cvp_applications_domains_currency_and_domain_expansion).
export const DOMAIN_OPTIONS = [
  { value: 'legal', label: 'Legal' },
  { value: 'certified_official', label: 'Certified / Official Documents' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'medical', label: 'Medical' },
  { value: 'life_sciences', label: 'Life Sciences / Clinical Trials' },
  { value: 'pharmaceutical', label: 'Pharmaceutical' },
  { value: 'financial', label: 'Financial' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'technical', label: 'Technical' },
  { value: 'it_software', label: 'IT / Software' },
  { value: 'automotive_engineering', label: 'Automotive / Engineering' },
  { value: 'energy', label: 'Energy' },
  { value: 'marketing_advertising', label: 'Marketing & Advertising' },
  { value: 'literary_publishing', label: 'Literary & Publishing' },
  { value: 'academic_scientific', label: 'Academic & Scientific' },
  { value: 'government_public', label: 'Government & Public Sector' },
  { value: 'business_corporate', label: 'Business & Corporate' },
  { value: 'gaming_entertainment', label: 'Gaming & Entertainment' },
  { value: 'media_journalism', label: 'Media & Journalism' },
  { value: 'tourism_hospitality', label: 'Tourism & Hospitality' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
] as const

export type DomainValue = typeof DOMAIN_OPTIONS[number]['value']

export const DOMAIN_VALUES = DOMAIN_OPTIONS.map((d) => d.value) as [
  DomainValue,
  ...DomainValue[],
]
