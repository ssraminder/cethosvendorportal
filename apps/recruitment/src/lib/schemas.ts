import { z } from 'zod'
import { DOMAIN_VALUES } from './domains'

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

export type TranslatorFormData = z.infer<typeof translatorSchema>
export type CognitiveDebriefingFormData = z.infer<typeof cognitiveDebriefingSchema>
export type ApplicationFormData = TranslatorFormData | CognitiveDebriefingFormData
export type PairServiceRate = z.infer<typeof pairServiceRateSchema>
