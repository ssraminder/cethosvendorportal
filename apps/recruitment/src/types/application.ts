export type RoleType = 'translator' | 'cognitive_debriefing'

export type Domain = 'legal' | 'medical' | 'immigration' | 'financial' | 'technical' | 'general'

export type ServiceType = 'translation' | 'translation_review' | 'lqa_review'

export type ExperienceBracket = '0' | '1' | '3' | '5' | '7' | '10'

export type EducationLevel = 'bachelor' | 'master' | 'phd' | 'diploma_certificate' | 'other'

export type CertificationType = 'ATA' | 'CTTIC' | 'ITI' | 'CIOL' | 'ISO_17100' | 'Other'

export type CatTool = 'Trados' | 'MemoQ' | 'Wordfast' | 'Phrase' | 'Memsource' | 'None' | 'Other'

export type ReferralSource = 'linkedin' | 'google' | 'referral' | 'job_board' | 'other'

export type CogInstrumentType = 'pro' | 'clinro' | 'obro' | 'interview_guide' | 'survey'

export type CogTherapyArea = 'oncology' | 'rheumatology' | 'neurology' | 'cardiology' | 'rare_disease' | 'general' | 'other'

export type CogAvailability = 'full_time' | 'part_time' | 'project_based'

export type FamiliarityLevel = 'yes' | 'no' | 'partially'

export interface Certification {
  name: CertificationType
  customName?: string
  expiryDate?: string
}

export interface LanguagePairRow {
  sourceLanguageId: string
  targetLanguageId: string
  domains: Domain[]
}

export interface WorkSample {
  file: File
  description: string
}

export interface Language {
  id: string
  name: string
  code: string
  is_active: boolean
}
