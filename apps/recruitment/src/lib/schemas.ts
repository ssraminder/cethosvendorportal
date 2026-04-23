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
  cogAvailability: z.enum(['full_time', 'part_time', 'project_based'], {
    error: 'Availability is required',
  }),
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
export type ApplicationFormData =
  | TranslatorFormData
  | CognitiveDebriefingFormData
  | InterpreterFormData
  | TranscriberFormData
  | ClinicianReviewerFormData
export type PairServiceRate = z.infer<typeof pairServiceRateSchema>
