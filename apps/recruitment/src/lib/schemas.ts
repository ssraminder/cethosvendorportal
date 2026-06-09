import { z } from 'zod'
import { DOMAIN_VALUES } from './domains'
import {
  INTERPRETER_MODES,
  INTERPRETER_SETTINGS,
  INTERPRETER_DELIVERY,
  TRANSCRIBER_SPECIALIZATIONS,
  TRANSCRIBER_VERBATIM,
  TRANSCRIBER_TIMESTAMPING,
  CLINICIAN_CREDENTIALS,
  CLINICIAN_THERAPY_AREAS,
} from './roles'

const modeValues = INTERPRETER_MODES.map((m) => m.value) as [string, ...string[]]
const settingValues = INTERPRETER_SETTINGS.map((s) => s.value) as [string, ...string[]]
const deliveryValues = INTERPRETER_DELIVERY.map((d) => d.value) as [string, ...string[]]
const transcriberSpecValues = TRANSCRIBER_SPECIALIZATIONS.map((s) => s.value) as [string, ...string[]]
const verbatimValues = TRANSCRIBER_VERBATIM.map((v) => v.value) as [string, ...string[]]
const timestampingValues = TRANSCRIBER_TIMESTAMPING.map((t) => t.value) as [string, ...string[]]
const credentialValues = CLINICIAN_CREDENTIALS.map((c) => c.value) as [string, ...string[]]
const clinicianAreaValues = CLINICIAN_THERAPY_AREAS.map((a) => a.value) as [string, ...string[]]

// -- Shared fields --

const personalInfoSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  linkedinUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

const consentSchema = z.object({
  privacyPolicy: z.literal(true, {
    error: 'You must agree to the Privacy Policy',
  }),
  consentTest: z.literal(true, {
    error: 'You must consent to receiving a translation test',
  }),
  consentUnpaid: z.literal(true, {
    error: 'You must acknowledge the test is unpaid',
  }),
})

// -- Translator-specific --

const certificationSchema = z.object({
  name: z.enum(['ATA', 'CTTIC', 'ITI', 'CIOL', 'ISO_17100', 'Other']),
  customName: z.string().optional(),
  expiryDate: z.string().optional(),
})

// Per-pair per-service rate capture.
// serviceCode references `services.code`; unit is one of the service's
// default_calculation_units; rate is optional unless the submit handler
// decides it's required (translation services enforce, others don't).
const pairServiceRateSchema = z.object({
  serviceCode: z.string().min(1),
  unit: z.string().min(1),
  rate: z.string().optional(),
  minimumCharge: z.string().optional(),
})

const languagePairSchema = z.object({
  sourceLanguageId: z.string().min(1, 'Source language is required'),
  targetLanguageId: z.string().min(1, 'Target language is required'),
  services: z.array(pairServiceRateSchema).min(1, 'Select at least one service for this language pair'),
}).refine(
  (data) => data.sourceLanguageId !== data.targetLanguageId,
  { message: 'Source and target language must be different', path: ['targetLanguageId'] }
)

// -- Agency multi-service application --

const agencyContactSchema = z.object({
  agencyPrimaryContactName: z.string().min(2, 'Primary contact name is required'),
  agencyPrimaryContactRole: z.string().min(1, 'Contact role is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  linkedinUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

const agencyBusinessSchema = z.object({
  agencyBusinessName: z.string().min(2, 'Business name is required'),
  agencyRegistrationCountry: z.string().min(1, 'Registration country is required'),
  agencyTaxId: z.string().min(1, 'Tax / registration ID is required'),
  agencyLinguistCount: z.string().min(1, 'Linguist count is required'),
  agencyYearsOperating: z.string().min(1, 'Years operating is required'),
})

const agencySimplePairSchema = z.object({
  sourceLanguageId: z.string().min(1, 'Source language is required'),
  targetLanguageId: z.string().min(1, 'Target language is required'),
}).refine(
  (d) => d.sourceLanguageId !== d.targetLanguageId,
  { message: 'Source and target language must be different', path: ['targetLanguageId'] },
)

const SERVICE_VALUES = ['translation', 'interpretation', 'transcription', 'cognitive_debriefing'] as const
const COG_INSTRUMENT_VALUES = ['pro', 'clinro', 'obro', 'interview_guide', 'survey'] as const
const COG_THERAPY_VALUES = ['oncology', 'rheumatology', 'neurology', 'cardiology', 'rare_disease', 'general', 'other'] as const

// Single multi-service agency schema. The applicant picks 1+ services and
// the form conditionally renders per-service sub-sections. Per-service
// fields stay optional in zod; the form enforces requireds via UI gating
// based on the selected services.
export const agencyApplicationSchema = z.object({
  roleType: z.literal('agency'),
  applicantType: z.literal('agency'),
  servicesOffered: z.array(z.enum(SERVICE_VALUES))
    .min(1, 'Select at least one service your agency offers'),
  ...agencyContactSchema.shape,
  ...agencyBusinessSchema.shape,
  // Language pairs apply to translation + interpretation. Required if
  // either of those services is picked; optional otherwise.
  languagePairs: z.array(agencySimplePairSchema).default([]),
  // Translation extras
  domainsOffered: z.array(z.enum(DOMAIN_VALUES)).default([]),
  // Interpretation extras
  interpreterModes: z.array(z.enum(modeValues)).default([]),
  interpreterSettings: z.array(z.enum(settingValues)).default([]),
  // Transcription extras
  transcriberLanguages: z.array(z.string()).default([]),
  transcriberSpecializations: z.array(z.enum(transcriberSpecValues)).default([]),
  // Cognitive Debriefing extras (agency-level capability declaration; the
  // per-linguist clinician credentials live on the blinded roster in PR A3+).
  cogInstrumentTypes: z.array(z.enum(COG_INSTRUMENT_VALUES)).default([]),
  cogTherapyAreas: z.array(z.enum(COG_THERAPY_VALUES)).default([]),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
  ...consentSchema.shape,
}).superRefine((data, ctx) => {
  const wantsLangPairs = data.servicesOffered.includes('translation')
    || data.servicesOffered.includes('interpretation')
    || data.servicesOffered.includes('cognitive_debriefing')
  if (wantsLangPairs && data.languagePairs.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['languagePairs'],
      message: 'At least one language pair is required for the selected services',
    })
  }
  if (data.servicesOffered.includes('translation') && data.domainsOffered.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['domainsOffered'],
      message: 'Select at least one domain for Translation',
    })
  }
  if (data.servicesOffered.includes('interpretation')) {
    if (data.interpreterModes.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['interpreterModes'], message: 'Select at least one interpretation mode' })
    }
    if (data.interpreterSettings.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['interpreterSettings'], message: 'Select at least one setting' })
    }
  }
  if (data.servicesOffered.includes('transcription')) {
    if (data.transcriberLanguages.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['transcriberLanguages'], message: 'Select at least one working language' })
    }
    if (data.transcriberSpecializations.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['transcriberSpecializations'], message: 'Select at least one specialization' })
    }
  }
  if (data.servicesOffered.includes('cognitive_debriefing')) {
    if (data.cogInstrumentTypes.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['cogInstrumentTypes'], message: 'Select at least one COA/PRO instrument type' })
    }
    if (data.cogTherapyAreas.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['cogTherapyAreas'], message: 'Select at least one therapy area' })
    }
  }
})

export const translatorSchema = z.object({
  roleType: z.literal('translator'),
  ...personalInfoSchema.shape,
  yearsExperience: z.string().min(1, 'Years of experience is required'),
  educationLevel: z.string().min(1, 'Education level is required'),
  certifications: z.array(certificationSchema).default([]),
  catTools: z.array(z.string()).default([]),
  languagePairs: z.array(languagePairSchema).min(1, 'At least one language pair is required'),
  domainsOffered: z.array(z.enum(DOMAIN_VALUES)).min(1, 'Select at least one domain'),
  rateCurrency: z.string().min(3, 'Select a currency for your rates'),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
  ...consentSchema.shape,
})

// -- Cognitive Debriefing-specific --

export const cognitiveDebriefingSchema = z.object({
  roleType: z.literal('cognitive_debriefing'),
  ...personalInfoSchema.shape,
  cogYearsExperience: z.string().min(1, 'Years of experience is required'),
  educationLevel: z.string().min(1, 'Education level is required'),
  cogDegreeField: z.string().min(1, 'Degree field is required'),
  cogCredentials: z.string().optional(),
  cogNativeLanguages: z.array(z.string().min(1))
    .min(1, 'Select at least one native language')
    .max(3, 'Select up to 3 native languages'),
  cogAdditionalLanguages: z.array(z.string()).default([]),
  cogInstrumentTypes: z.array(z.enum(['pro', 'clinro', 'obro', 'interview_guide', 'survey']))
    .min(1, 'Select at least one instrument type'),
  cogTherapyAreas: z.array(z.enum([
    'oncology', 'rheumatology', 'neurology', 'cardiology', 'rare_disease', 'general', 'other',
  ])).min(1, 'Select at least one therapy area'),
  cogPharmaClients: z.string().optional(),
  cogIsporFamiliarity: z.enum(['yes', 'no', 'partially'], {
    error: 'This field is required',
  }),
  cogFdaFamiliarity: z.enum(['yes', 'no', 'partially'], {
    error: 'This field is required',
  }),
  cogPriorDebriefReports: z.boolean(),
  cogInterviewsConducted: z.enum(['0', '1-10', '11-50', '51-200', '200+'], {
    error: 'Approximate number of interviews is required',
  }),
  cogConductsDirectPatientInterviews: z.boolean(),
  cogInterviewModes: z.array(z.enum(['in_person', 'telephone', 'video']))
    .min(1, 'Select at least one interview mode'),
  cogEcoaPlatforms: z.array(z.enum([
    'signant', 'clario_ert', 'medidata', 'calyx', 'yprime', 'iqvia', 'cognigen', 'none', 'other',
  ])).default([]),
  cogAvailability: z.enum(['full_time', 'part_time', 'project_based'], {
    error: 'Availability is required',
  }),
  cogRateExpectation: z.string().min(1, 'Rate is required'),
  cogRateCurrency: z.string().min(3, 'Select a currency'),
  cogEmaFamiliarity: z.enum(['yes', 'no', 'partially'], {
    error: 'EMA familiarity is required',
  }),
  cogConceptElicitationYears: z.string().min(1, 'Concept-elicitation experience is required'),
  cogSpecialPopulations: z.array(z.enum([
    'pediatric', 'elderly', 'cognitively_impaired', 'rare_disease',
    'immigrant_refugee', 'lgbtq', 'none',
  ])).default([]),
  cogGcpTrained: z.boolean(),
  cogGcpYear: z.string().optional(),
  cogLicenseType: z.string().optional(),
  cogLicenseJurisdiction: z.string().optional(),
  cogLicenseNumber: z.string().optional(),
  cogLicenseActive: z.boolean().optional(),
  cogTimezone: z.string().min(1, 'Time zone is required'),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
  ...consentSchema.shape,
})

// -- Interpreter --

const interpreterPairSchema = z.object({
  sourceLanguageId: z.string().min(1, 'Source language is required'),
  targetLanguageId: z.string().min(1, 'Target language is required'),
}).refine(
  (d) => d.sourceLanguageId !== d.targetLanguageId,
  { message: 'Source and target language must be different', path: ['targetLanguageId'] }
)

export const interpreterSchema = z.object({
  roleType: z.literal('interpreter'),
  ...personalInfoSchema.shape,
  yearsExperience: z.string().min(1, 'Years of experience is required'),
  educationLevel: z.string().min(1, 'Education level is required'),
  certifications: z.array(certificationSchema).default([]),
  interpreterLanguagePairs: z.array(interpreterPairSchema).min(1, 'At least one language pair is required'),
  interpreterModes: z.array(z.enum(modeValues)).min(1, 'Select at least one interpretation mode'),
  interpreterSettings: z.array(z.enum(settingValues)).min(1, 'Select at least one setting'),
  interpreterDelivery: z.enum(deliveryValues, { error: 'Select a delivery option' }),
  interpreterHourlyRate: z.string().min(1, 'Hourly rate is required'),
  interpreterMinEngagementHours: z.string().optional(),
  rateCurrency: z.string().min(3, 'Select a currency'),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
  ...consentSchema.shape,
})

// -- Transcriber --

export const transcriberSchema = z.object({
  roleType: z.literal('transcriber'),
  ...personalInfoSchema.shape,
  yearsExperience: z.string().min(1, 'Years of experience is required'),
  educationLevel: z.string().min(1, 'Education level is required'),
  certifications: z.array(certificationSchema).default([]),
  transcriberLanguages: z.array(z.string().min(1)).min(1, 'Select at least one working language'),
  transcriberSpecializations: z.array(z.enum(transcriberSpecValues)).min(1, 'Select at least one specialization'),
  transcriberRatePerMinute: z.string().min(1, 'Per-minute rate is required'),
  transcriberRatePerHour: z.string().optional(),
  transcriberVerbatimMode: z.enum(verbatimValues, { error: 'Select a verbatim mode' }),
  transcriberTimestamping: z.enum(timestampingValues, { error: 'Select a time-stamping preference' }),
  rateCurrency: z.string().min(3, 'Select a currency'),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
  ...consentSchema.shape,
})

// -- Clinician Reviewer --

export const clinicianReviewerSchema = z.object({
  roleType: z.literal('clinician_reviewer'),
  ...personalInfoSchema.shape,
  educationLevel: z.string().min(1, 'Education level is required'),
  clinicianCredentials: z.array(z.enum(credentialValues)).min(1, 'Select at least one credential'),
  clinicianLicensingCountry: z.string().min(1, 'Licensing country is required'),
  clinicianLicensingRegion: z.string().optional(),
  clinicianWorkingLanguages: z.array(z.string().min(1)).min(1, 'Select at least one working language'),
  clinicianTherapyAreas: z.array(z.enum(clinicianAreaValues)).min(1, 'Select at least one therapy area'),
  clinicianYearsClinicalReview: z.string().min(1, 'Clinical review experience is required'),
  clinicianYearsCoa: z.string().optional(),
  clinicianHourlyRate: z.string().min(1, 'Hourly rate is required'),
  rateCurrency: z.string().min(3, 'Select a currency'),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
  ...consentSchema.shape,
})

export type TranslatorFormData = z.infer<typeof translatorSchema>
export type CognitiveDebriefingFormData = z.infer<typeof cognitiveDebriefingSchema>
export type InterpreterFormData = z.infer<typeof interpreterSchema>
export type TranscriberFormData = z.infer<typeof transcriberSchema>
export type ClinicianReviewerFormData = z.infer<typeof clinicianReviewerSchema>
export type AgencyApplicationFormData = z.infer<typeof agencyApplicationSchema>
export type ApplicationFormData =
  | TranslatorFormData
  | CognitiveDebriefingFormData
  | InterpreterFormData
  | TranscriberFormData
  | ClinicianReviewerFormData
  | AgencyApplicationFormData
export type PairServiceRate = z.infer<typeof pairServiceRateSchema>
