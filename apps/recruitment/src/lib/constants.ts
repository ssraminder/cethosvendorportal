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
  { value: 'translation', label: 'Translation', description: 'Source \u2192 target translation' },
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
