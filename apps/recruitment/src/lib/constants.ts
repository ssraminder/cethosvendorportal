export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bangladesh', 'Belarus', 'Belgium', 'Bolivia',
  'Bosnia and Herzegovina', 'Brazil', 'Bulgaria', 'Cambodia', 'Cameroon',
  'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica', 'Croatia', 'Cuba',
  'Cyprus', 'Czech Republic', 'Denmark', 'Dominican Republic', 'Ecuador',
  'Egypt', 'El Salvador', 'Estonia', 'Ethiopia', 'Finland', 'France',
  'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala', 'Haiti', 'Honduras',
  'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
  'Kenya', 'Kuwait', 'Latvia', 'Lebanon', 'Libya', 'Lithuania', 'Luxembourg',
  'Malaysia', 'Mexico', 'Moldova', 'Mongolia', 'Montenegro', 'Morocco',
  'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Nigeria',
  'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Panama',
  'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar',
  'Romania', 'Russia', 'Saudi Arabia', 'Senegal', 'Serbia', 'Singapore',
  'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka',
  'Sudan', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Thailand', 'Tunisia',
  'Turkey', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Uruguay', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen',
] as const

export const EXPERIENCE_OPTIONS = [
  { value: '0', label: 'Less than 1 year' },
  { value: '1', label: '1\u20133 years' },
  { value: '3', label: '3\u20135 years' },
  { value: '5', label: '5\u201310 years' },
  { value: '10', label: '10+ years' },
] as const

export const EDUCATION_OPTIONS = [
  { value: 'bachelor', label: "Bachelor's" },
  { value: 'master', label: "Master's" },
  { value: 'phd', label: 'PhD' },
  { value: 'diploma_certificate', label: 'Diploma / Certificate' },
  { value: 'other', label: 'Other' },
] as const

export const CERTIFICATION_OPTIONS = [
  { value: 'ATA', label: 'ATA (American Translators Association)' },
  { value: 'CTTIC', label: 'CTTIC (Canadian Translators, Terminologists and Interpreters Council)' },
  { value: 'ITI', label: 'ITI (Institute of Translation and Interpreting)' },
  { value: 'CIOL', label: 'CIOL (Chartered Institute of Linguists)' },
  { value: 'ISO_17100', label: 'ISO 17100 certified' },
  { value: 'Other', label: 'Other' },
] as const

export const CAT_TOOL_OPTIONS = [
  'Trados', 'MemoQ', 'Wordfast', 'Phrase', 'Memsource', 'None', 'Other',
] as const

export const DOMAIN_OPTIONS = [
  { value: 'legal', label: 'Legal' },
  { value: 'medical', label: 'Medical' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'financial', label: 'Financial' },
  { value: 'technical', label: 'Technical' },
  { value: 'general', label: 'General' },
] as const

export const SERVICE_OPTIONS = [
  { value: 'certified_translation', label: 'Certified Translation', description: 'Certified translation of official documents (immigration, legal, academic)' },
  { value: 'translation', label: 'Translation', description: 'General source \u2192 target translation' },
  { value: 'translation_review', label: 'Translation + Review', description: 'Translate then self-review' },
  { value: 'lqa_review', label: 'LQA Review', description: "Review someone else's translation using MQM Core" },
] as const

export const REFERRAL_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google', label: 'Google' },
  { value: 'referral', label: 'Referral' },
  { value: 'job_board', label: 'Job board' },
  { value: 'other', label: 'Other' },
] as const

export const COG_INSTRUMENT_OPTIONS = [
  { value: 'pro', label: 'Patient-Reported Outcomes (PROs)' },
  { value: 'clinro', label: 'Clinician-Reported Outcomes (ClinROs)' },
  { value: 'obro', label: 'Observer-Reported Outcomes (ObsROs)' },
  { value: 'interview_guide', label: 'Interview guides' },
  { value: 'survey', label: 'Surveys and questionnaires' },
] as const

export const COG_THERAPY_OPTIONS = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'rheumatology', label: 'Rheumatology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'rare_disease', label: 'Rare Disease' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
] as const

export const FAMILIARITY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'partially', label: 'Partially' },
] as const

export const AVAILABILITY_OPTIONS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'project_based', label: 'Project-based' },
] as const

export const COG_INTERVIEWS_CONDUCTED_OPTIONS = [
  { value: '0', label: 'None yet' },
  { value: '1-10', label: '1–10 interviews' },
  { value: '11-50', label: '11–50 interviews' },
  { value: '51-200', label: '51–200 interviews' },
  { value: '200+', label: '200+ interviews' },
] as const

export const COG_INTERVIEW_MODE_OPTIONS = [
  { value: 'in_person', label: 'In-person' },
  { value: 'telephone', label: 'Telephone' },
  { value: 'video', label: 'Video' },
] as const

export const COG_SPECIAL_POPULATIONS_OPTIONS = [
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'elderly', label: 'Elderly' },
  { value: 'cognitively_impaired', label: 'Cognitively impaired' },
  { value: 'rare_disease', label: 'Rare disease' },
  { value: 'immigrant_refugee', label: 'Immigrant / refugee' },
  { value: 'lgbtq', label: 'LGBTQ+' },
  { value: 'none', label: 'None / general adult only' },
] as const

// Curated IANA time zones — common across CRO/pharma debrief work.
export const TIMEZONE_OPTIONS = [
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Denver', label: 'America/Denver (MT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/Toronto', label: 'America/Toronto (ET)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT)' },
] as const

export const COG_ECOA_PLATFORM_OPTIONS = [
  { value: 'signant', label: 'Signant Health' },
  { value: 'clario_ert', label: 'Clario / ERT' },
  { value: 'medidata', label: 'Medidata' },
  { value: 'calyx', label: 'Calyx' },
  { value: 'yprime', label: 'YPrime' },
  { value: 'iqvia', label: 'IQVIA' },
  { value: 'cognigen', label: 'Cognigen' },
  { value: 'none', label: 'None / paper-only' },
  { value: 'other', label: 'Other' },
] as const
