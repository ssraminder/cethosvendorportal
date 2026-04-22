// Role catalog + per-role option lists. role_type values match the CHECK
// constraint on cvp_applications.role_type.

export const ROLE_OPTIONS = [
  { value: 'translator', label: 'Translator / Reviewer', hint: 'Translation, review, proofreading, MTPE' },
  { value: 'interpreter', label: 'Interpreter', hint: 'Consecutive, simultaneous, OPI, VRI, sign, escort' },
  { value: 'transcriber', label: 'Transcriber', hint: 'Audio transcription (medical, legal, research, media)' },
  { value: 'clinician_reviewer', label: 'Clinician Reviewer', hint: 'Clinical review for linguistic validation (RN/MD/PharmD/PsyD)' },
  { value: 'cognitive_debriefing', label: 'Cognitive Debriefing Consultant', hint: 'COA/PRO interviewing + linguistic validation' },
] as const

export type RoleValue = typeof ROLE_OPTIONS[number]['value']

export const INTERPRETER_MODES = [
  { value: 'consecutive', label: 'Consecutive' },
  { value: 'simultaneous', label: 'Simultaneous' },
  { value: 'telephone', label: 'Telephone (OPI)' },
  { value: 'video_remote', label: 'Video Remote (VRI)' },
  { value: 'sign_language', label: 'Sign Language' },
  { value: 'escort_travel', label: 'Escort / Travel' },
] as const

export const INTERPRETER_SETTINGS = [
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal' },
  { value: 'court', label: 'Court' },
  { value: 'business_conference', label: 'Business / Conference' },
  { value: 'community', label: 'Community' },
  { value: 'educational', label: 'Educational' },
] as const

export const INTERPRETER_DELIVERY = [
  { value: 'in_person', label: 'In-person' },
  { value: 'remote', label: 'Remote' },
  { value: 'both', label: 'Both' },
] as const

export const TRANSCRIBER_SPECIALIZATIONS = [
  { value: 'medical_dictation', label: 'Medical dictation' },
  { value: 'legal_depositions', label: 'Legal depositions' },
  { value: 'research_interviews', label: 'Research interviews' },
  { value: 'media_journalism', label: 'Media & journalism' },
  { value: 'general', label: 'General' },
] as const

export const TRANSCRIBER_VERBATIM = [
  { value: 'verbatim', label: 'Verbatim' },
  { value: 'clean_verbatim', label: 'Clean verbatim' },
  { value: 'both', label: 'Both' },
] as const

export const TRANSCRIBER_TIMESTAMPING = [
  { value: 'yes', label: 'Yes, always' },
  { value: 'on_request', label: 'On request' },
  { value: 'no', label: 'No' },
] as const

export const CLINICIAN_CREDENTIALS = [
  { value: 'RN', label: 'RN (Registered Nurse)' },
  { value: 'NP', label: 'NP (Nurse Practitioner)' },
  { value: 'MD', label: 'MD (Medical Doctor)' },
  { value: 'DO', label: 'DO (Doctor of Osteopathy)' },
  { value: 'PharmD', label: 'PharmD (Doctor of Pharmacy)' },
  { value: 'PsyD', label: 'PsyD (Doctor of Psychology)' },
  { value: 'PhD_ClinPsych', label: 'PhD (Clinical Psychology)' },
  { value: 'MSc_ClinPsych', label: 'MSc (Clinical Psychology)' },
  { value: 'LMFT', label: 'LMFT (Marriage & Family Therapist)' },
  { value: 'LCSW', label: 'LCSW (Licensed Clinical Social Worker)' },
  { value: 'Other', label: 'Other' },
] as const

export const CLINICIAN_THERAPY_AREAS = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'rheumatology', label: 'Rheumatology' },
  { value: 'endocrinology', label: 'Endocrinology' },
  { value: 'rare_disease', label: 'Rare Disease' },
  { value: 'pediatrics', label: 'Pediatrics' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
] as const
