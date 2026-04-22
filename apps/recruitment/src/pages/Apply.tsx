import { useState, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Loader2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { FormSection } from '../components/FormSection'
import { FormField } from '../components/FormField'
import { LanguagePairRow } from '../components/LanguagePairRow'
import { MultiSelect } from '../components/MultiSelect'
import { useLanguages } from '../hooks/useLanguages'
import { translatorSchema, cognitiveDebriefingSchema } from '../lib/schemas'
import type { TranslatorFormData, CognitiveDebriefingFormData } from '../lib/schemas'
import {
  COUNTRIES,
  EXPERIENCE_OPTIONS,
  EDUCATION_OPTIONS,
  CERTIFICATION_OPTIONS,
  CAT_TOOL_OPTIONS,
  REFERRAL_OPTIONS,
  COG_INSTRUMENT_OPTIONS,
  COG_THERAPY_OPTIONS,
  FAMILIARITY_OPTIONS,
  AVAILABILITY_OPTIONS,
} from '../lib/constants'
import { DOMAIN_OPTIONS } from '../lib/domains'
import type { DomainValue } from '../lib/domains'
import { RATE_CURRENCIES } from '../lib/currencies'
import type { RoleType } from '../types/application'

const inputClasses = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal'
const selectClasses = inputClasses

export function Apply() {
  const [roleType, setRoleType] = useState<RoleType>('translator')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cogSampleFile, setCogSampleFile] = useState<File | null>(null)
  const { languages, loading: languagesLoading, error: languagesError } = useLanguages()
  const navigate = useNavigate()

  // Translator form
  const translatorForm = useForm<TranslatorFormData>({
    resolver: zodResolver(translatorSchema) as Resolver<TranslatorFormData>,
    defaultValues: {
      roleType: 'translator',
      certifications: [],
      catTools: [],
      languagePairs: [{ sourceLanguageId: '', targetLanguageId: '', services: [] }],
      domainsOffered: [],
      rateCurrency: 'CAD',
      privacyPolicy: false as unknown as true,
      consentTest: false as unknown as true,
      consentUnpaid: false as unknown as true,
    },
  })

  const { fields: languagePairFields, append: addLanguagePair, remove: removeLanguagePair } = useFieldArray({
    control: translatorForm.control,
    name: 'languagePairs',
  })

  const { fields: certFields, append: addCert, remove: removeCert } = useFieldArray({
    control: translatorForm.control,
    name: 'certifications',
  })

  // Cognitive debriefing form
  const cogForm = useForm<CognitiveDebriefingFormData>({
    resolver: zodResolver(cognitiveDebriefingSchema) as Resolver<CognitiveDebriefingFormData>,
    defaultValues: {
      roleType: 'cognitive_debriefing',
      cogInstrumentTypes: [],
      cogTherapyAreas: [],
      cogAdditionalLanguages: [],
      cogPriorDebriefReports: false,
      privacyPolicy: false as unknown as true,
      consentTest: false as unknown as true,
      consentUnpaid: false as unknown as true,
    },
  })

  const handleRoleChange = (newRole: RoleType) => {
    setRoleType(newRole)
    setSubmitError(null)
  }

  const handleToggleDomainOffered = useCallback((domain: DomainValue) => {
    const current = translatorForm.getValues('domainsOffered') ?? []
    const updated = current.includes(domain)
      ? current.filter((d) => d !== domain)
      : [...current, domain]
    translatorForm.setValue('domainsOffered', updated, { shouldValidate: true })
  }, [translatorForm])

  const handleToggleCheckbox = useCallback((
    form: { getValues: (field: string) => string[]; setValue: (field: string, value: string[], options?: { shouldValidate?: boolean }) => void },
    field: string,
    value: string
  ) => {
    const current = form.getValues(field) ?? []
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value]
    form.setValue(field, updated, { shouldValidate: true })
  }, [])

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return
    setCvFile(file)
  }

  const onTranslatorSubmit = async (data: TranslatorFormData) => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        ...data,
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cvp-submit-application`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error ?? 'Submission failed')
      }

      navigate('/apply/confirmation', { state: { applicationNumber: result.data.applicationNumber } })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const onCogSubmit = async (data: CognitiveDebriefingFormData) => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        ...data,
        cogSampleFile: cogSampleFile ?? undefined,
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cvp-submit-application`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error ?? 'Submission failed')
      }

      navigate('/apply/confirmation', { state: { applicationNumber: result.data.applicationNumber } })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (languagesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading...</span>
        </div>
      </Layout>
    )
  }

  if (languagesError) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">{languagesError}</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-cethos-navy">Apply to Join CETHOS</h1>
          <p className="mt-2 text-gray-600">
            We're looking for talented translators and cognitive debriefing consultants.
            Complete the form below to start the application process.
          </p>
        </div>

        {/* Role selector */}
        <FormSection title="I am applying as a:">
          <div className="flex gap-4">
            <label className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
              roleType === 'translator'
                ? 'border-cethos-teal bg-cethos-bg-blue text-cethos-teal'
                : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="roleType"
                value="translator"
                checked={roleType === 'translator'}
                onChange={() => handleRoleChange('translator')}
                className="text-cethos-teal focus:ring-cethos-teal"
              />
              <span className="text-sm font-medium">Translator / Reviewer</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
              roleType === 'cognitive_debriefing'
                ? 'border-cethos-teal bg-cethos-bg-blue text-cethos-teal'
                : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="roleType"
                value="cognitive_debriefing"
                checked={roleType === 'cognitive_debriefing'}
                onChange={() => handleRoleChange('cognitive_debriefing')}
                className="text-cethos-teal focus:ring-cethos-teal"
              />
              <span className="text-sm font-medium">Cognitive Debriefing Consultant</span>
            </label>
          </div>
        </FormSection>

        {/* ===== TRANSLATOR FORM ===== */}
        {roleType === 'translator' && (
          <form onSubmit={translatorForm.handleSubmit(onTranslatorSubmit)} className="space-y-6">
            {/* Section 1: Personal Information */}
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full name" required error={translatorForm.formState.errors.fullName?.message}>
                  <input {...translatorForm.register('fullName')} className={inputClasses} placeholder="John Doe" />
                </FormField>

                <FormField label="Email" required error={translatorForm.formState.errors.email?.message}>
                  <input {...translatorForm.register('email')} type="email" className={inputClasses} placeholder="john@example.com" />
                </FormField>

                <FormField label="Phone" error={translatorForm.formState.errors.phone?.message}>
                  <input {...translatorForm.register('phone')} type="tel" className={inputClasses} placeholder="+1 555 123 4567" />
                </FormField>

                <FormField label="City" error={translatorForm.formState.errors.city?.message}>
                  <input {...translatorForm.register('city')} className={inputClasses} placeholder="Toronto" />
                </FormField>

                <FormField label="Country" required error={translatorForm.formState.errors.country?.message}>
                  <select {...translatorForm.register('country')} className={selectClasses}>
                    <option value="">Select country...</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="LinkedIn URL" error={translatorForm.formState.errors.linkedinUrl?.message}>
                  <input {...translatorForm.register('linkedinUrl')} type="url" className={inputClasses} placeholder="https://linkedin.com/in/..." />
                </FormField>
              </div>
            </FormSection>

            {/* Section 2: Professional Background */}
            <FormSection title="Professional Background">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Years of experience" required error={translatorForm.formState.errors.yearsExperience?.message}>
                  <select {...translatorForm.register('yearsExperience')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Education level" required error={translatorForm.formState.errors.educationLevel?.message}>
                  <select {...translatorForm.register('educationLevel')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EDUCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Certifications */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-cethos-navy">Certifications</label>
                  <button
                    type="button"
                    onClick={() => addCert({ name: 'ATA', customName: '', expiryDate: '' })}
                    className="text-sm text-cethos-teal hover:text-cethos-teal font-medium"
                  >
                    + Add certification
                  </button>
                </div>
                {certFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="relative rounded-lg border border-cethos-border bg-white p-3 sm:p-0 sm:border-0 sm:bg-transparent"
                  >
                    <button
                      type="button"
                      onClick={() => removeCert(index)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 sm:static sm:self-center"
                      aria-label="Remove certification"
                    >
                      <span className="sr-only">Remove</span>&times;
                    </button>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 sm:pr-2">
                      <div className="flex-1 space-y-2 sm:space-y-0 sm:flex sm:gap-3">
                        <select
                          {...translatorForm.register(`certifications.${index}.name`)}
                          className={`${selectClasses} w-full sm:flex-1`}
                        >
                          {CERTIFICATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {translatorForm.watch(`certifications.${index}.name`) === 'Other' && (
                          <input
                            {...translatorForm.register(`certifications.${index}.customName`)}
                            className={`${inputClasses} w-full sm:flex-1`}
                            placeholder="Certification name"
                          />
                        )}
                        <div className="sm:w-48">
                          <label className="sm:hidden block text-xs text-cethos-gray-light mb-1">Expiry date</label>
                          <input
                            {...translatorForm.register(`certifications.${index}.expiryDate`)}
                            type="date"
                            className={`${inputClasses} w-full`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CAT Tools */}
              <FormField label="CAT tools">
                <div className="flex flex-wrap gap-2">
                  {CAT_TOOL_OPTIONS.map((tool) => {
                    const selected = (translatorForm.watch('catTools') ?? []).includes(tool)
                    return (
                      <label
                        key={tool}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-cethos-bg-blue border-cethos-teal text-cethos-teal'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selected}
                          onChange={() => handleToggleCheckbox(
                            translatorForm as unknown as { getValues: (field: string) => string[]; setValue: (field: string, value: string[], options?: { shouldValidate?: boolean }) => void },
                            'catTools',
                            tool
                          )}
                        />
                        {tool}
                      </label>
                    )
                  })}
                </div>
              </FormField>
            </FormSection>

            {/* Section 3: Domains & Rate Currency (applicant-wide) */}
            <FormSection
              title="Domains & Rate Currency"
              description="Select every domain you can work in. Your selections apply across all language pairs you add below."
            >
              <FormField label="Domains" required error={translatorForm.formState.errors.domainsOffered?.message}>
                <MultiSelect
                  options={DOMAIN_OPTIONS as unknown as { value: string; label: string }[]}
                  value={(translatorForm.watch('domainsOffered') ?? []) as string[]}
                  onChange={(next) => translatorForm.setValue(
                    'domainsOffered',
                    next as DomainValue[],
                    { shouldValidate: true }
                  )}
                  placeholder="Select one or more domains…"
                />
              </FormField>

              <FormField
                label="Currency for all rates"
                required
                error={translatorForm.formState.errors.rateCurrency?.message}
                hint="Applies to every rate you enter on language pairs below."
              >
                <select {...translatorForm.register('rateCurrency')} className={`${selectClasses} max-w-xs`}>
                  {RATE_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </FormField>
            </FormSection>

            {/* Section 4: Language Pairs & Rates */}
            <FormSection
              title="Language Pairs & Rates"
              description="Add each language pair you can work with. For each pair, list the services you offer and your rate."
            >
              <div className="space-y-4">
                {languagePairFields.map((field, index) => (
                  <LanguagePairRow
                    key={field.id}
                    index={index}
                    languages={languages}
                    register={translatorForm.register}
                    setValue={translatorForm.setValue}
                    watch={translatorForm.watch}
                    errors={translatorForm.formState.errors}
                    onRemove={() => removeLanguagePair(index)}
                    canRemove={languagePairFields.length > 1}
                    currencyCode={translatorForm.watch('rateCurrency') ?? 'CAD'}
                    submitAttempted={translatorForm.formState.submitCount > 0}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => addLanguagePair({ sourceLanguageId: '', targetLanguageId: '', services: [] })}
                  className="flex items-center gap-1.5 text-sm text-cethos-teal hover:text-cethos-teal font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add another language pair
                </button>
              </div>
              {translatorForm.formState.errors.languagePairs?.message && (
                <p className="text-sm text-red-600">{translatorForm.formState.errors.languagePairs.message}</p>
              )}
            </FormSection>

            {/* Section 5a: Resume / CV */}
            <FormSection
              title="Resume / CV"
              description="Upload your most recent CV (PDF or DOCX, max 10MB). This helps us contextualize your experience."
            >
              <div className="space-y-3">
                {!cvFile ? (
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-cethos-teal transition-colors">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500">Click to upload your CV</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc"
                      className="sr-only"
                      onChange={handleCvUpload}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <span className="text-sm text-cethos-navy truncate">{cvFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setCvFile(null)}
                      className="text-gray-400 hover:text-red-500 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </FormSection>

            {/* Section 7: Additional Information */}
            <FormSection title="Additional Information">
              <FormField label="How did you hear about us?">
                <select {...translatorForm.register('referralSource')} className={selectClasses}>
                  <option value="">Select...</option>
                  {REFERRAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Additional notes">
                <textarea
                  {...translatorForm.register('notes')}
                  rows={3}
                  className={inputClasses}
                  placeholder="Anything else you'd like us to know?"
                />
              </FormField>
            </FormSection>

            {/* Section 8: Consent */}
            <FormSection title="Consent">
              <div className="space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...translatorForm.register('privacyPolicy')}
                    className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">
                    I agree to the{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cethos-teal hover:text-cethos-teal underline"
                    >
                      Privacy Policy
                    </a>{' '}
                    <span className="text-red-500">*</span>
                  </span>
                </label>
                {translatorForm.formState.errors.privacyPolicy && (
                  <p className="text-sm text-red-600 ml-6">{translatorForm.formState.errors.privacyPolicy.message}</p>
                )}

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...translatorForm.register('consentTest')}
                    className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">
                    I consent to receiving a translation test as part of this application <span className="text-red-500">*</span>
                  </span>
                </label>
                {translatorForm.formState.errors.consentTest && (
                  <p className="text-sm text-red-600 ml-6">{translatorForm.formState.errors.consentTest.message}</p>
                )}

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...translatorForm.register('consentUnpaid')}
                    className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">
                    I understand the test is unpaid <span className="text-red-500">*</span>
                  </span>
                </label>
                {translatorForm.formState.errors.consentUnpaid && (
                  <p className="text-sm text-red-600 ml-6">{translatorForm.formState.errors.consentUnpaid.message}</p>
                )}
              </div>
            </FormSection>

            {/* Submit */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3 bg-cethos-teal text-white font-semibold rounded-lg hover:bg-cethos-teal-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}

        {/* ===== COGNITIVE DEBRIEFING FORM ===== */}
        {roleType === 'cognitive_debriefing' && (
          <form onSubmit={cogForm.handleSubmit(onCogSubmit)} className="space-y-6">
            {/* Section 1: Personal Information */}
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full name" required error={cogForm.formState.errors.fullName?.message}>
                  <input {...cogForm.register('fullName')} className={inputClasses} placeholder="John Doe" />
                </FormField>

                <FormField label="Email" required error={cogForm.formState.errors.email?.message}>
                  <input {...cogForm.register('email')} type="email" className={inputClasses} placeholder="john@example.com" />
                </FormField>

                <FormField label="Phone" error={cogForm.formState.errors.phone?.message}>
                  <input {...cogForm.register('phone')} type="tel" className={inputClasses} placeholder="+1 555 123 4567" />
                </FormField>

                <FormField label="City" error={cogForm.formState.errors.city?.message}>
                  <input {...cogForm.register('city')} className={inputClasses} placeholder="Toronto" />
                </FormField>

                <FormField label="Country" required error={cogForm.formState.errors.country?.message}>
                  <select {...cogForm.register('country')} className={selectClasses}>
                    <option value="">Select country...</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="LinkedIn URL" error={cogForm.formState.errors.linkedinUrl?.message}>
                  <input {...cogForm.register('linkedinUrl')} type="url" className={inputClasses} placeholder="https://linkedin.com/in/..." />
                </FormField>
              </div>
            </FormSection>

            {/* Section 2: Professional Background */}
            <FormSection title="Professional Background">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Years of debriefing experience" required error={cogForm.formState.errors.cogYearsExperience?.message}>
                  <select {...cogForm.register('cogYearsExperience')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Education level" required error={cogForm.formState.errors.educationLevel?.message}>
                  <select {...cogForm.register('educationLevel')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EDUCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Degree field" required error={cogForm.formState.errors.cogDegreeField?.message}>
                  <input {...cogForm.register('cogDegreeField')} className={inputClasses} placeholder="e.g. Psychology, Linguistics" />
                </FormField>

                <FormField label="Credentials / certifications" error={cogForm.formState.errors.cogCredentials?.message}>
                  <input {...cogForm.register('cogCredentials')} className={inputClasses} placeholder="List any relevant credentials" />
                </FormField>
              </div>
            </FormSection>

            {/* Section 3: Languages */}
            <FormSection title="Languages">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Native language" required error={cogForm.formState.errors.cogNativeLanguageId?.message}>
                  <select {...cogForm.register('cogNativeLanguageId')} className={selectClasses}>
                    <option value="">Select...</option>
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.id}>{lang.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Additional fluent languages">
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang) => {
                      const selected = (cogForm.watch('cogAdditionalLanguages') ?? []).includes(lang.id)
                      return (
                        <label
                          key={lang.id}
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${
                            selected
                              ? 'bg-cethos-bg-blue border-cethos-teal text-cethos-teal'
                              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selected}
                            onChange={() => handleToggleCheckbox(
                              cogForm as unknown as { getValues: (field: string) => string[]; setValue: (field: string, value: string[], options?: { shouldValidate?: boolean }) => void },
                              'cogAdditionalLanguages',
                              lang.id
                            )}
                          />
                          {lang.name}
                        </label>
                      )
                    })}
                  </div>
                </FormField>
              </div>
            </FormSection>

            {/* Section 4: Experience Profile */}
            <FormSection title="Experience Profile">
              <FormField label="COA/PRO instrument types" required error={cogForm.formState.errors.cogInstrumentTypes?.message}>
                <div className="flex flex-wrap gap-2">
                  {COG_INSTRUMENT_OPTIONS.map((opt) => {
                    const selected = (cogForm.watch('cogInstrumentTypes') ?? []).includes(opt.value)
                    return (
                      <label
                        key={opt.value}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-cethos-bg-blue border-cethos-teal text-cethos-teal'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selected}
                          onChange={() => handleToggleCheckbox(
                            cogForm as unknown as { getValues: (field: string) => string[]; setValue: (field: string, value: string[], options?: { shouldValidate?: boolean }) => void },
                            'cogInstrumentTypes',
                            opt.value
                          )}
                        />
                        {opt.label}
                      </label>
                    )
                  })}
                </div>
              </FormField>

              <FormField label="Therapy areas" required error={cogForm.formState.errors.cogTherapyAreas?.message}>
                <div className="flex flex-wrap gap-2">
                  {COG_THERAPY_OPTIONS.map((opt) => {
                    const selected = (cogForm.watch('cogTherapyAreas') ?? []).includes(opt.value)
                    return (
                      <label
                        key={opt.value}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-cethos-bg-blue border-cethos-teal text-cethos-teal'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selected}
                          onChange={() => handleToggleCheckbox(
                            cogForm as unknown as { getValues: (field: string) => string[]; setValue: (field: string, value: string[], options?: { shouldValidate?: boolean }) => void },
                            'cogTherapyAreas',
                            opt.value
                          )}
                        />
                        {opt.label}
                      </label>
                    )
                  })}
                </div>
              </FormField>

              <FormField label="Pharma/CRO clients" hint="This information is treated as confidential.">
                <textarea
                  {...cogForm.register('cogPharmaClients')}
                  rows={2}
                  className={inputClasses}
                  placeholder="List any relevant pharma or CRO clients"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Familiar with ISPOR guidelines?" required error={cogForm.formState.errors.cogIsporFamiliarity?.message}>
                  <div className="flex gap-4">
                    {FAMILIARITY_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          {...cogForm.register('cogIsporFamiliarity')}
                          value={opt.value}
                          className="text-cethos-teal focus:ring-cethos-teal"
                        />
                        <span className="text-sm text-cethos-navy">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </FormField>

                <FormField label="Familiar with FDA COA guidance?" required error={cogForm.formState.errors.cogFdaFamiliarity?.message}>
                  <div className="flex gap-4">
                    {FAMILIARITY_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          {...cogForm.register('cogFdaFamiliarity')}
                          value={opt.value}
                          className="text-cethos-teal focus:ring-cethos-teal"
                        />
                        <span className="text-sm text-cethos-navy">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </FormField>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...cogForm.register('cogPriorDebriefReports')}
                    className="text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">I have prior debrief report writing experience</span>
                </label>

                {cogForm.watch('cogPriorDebriefReports') && (
                  <FormField label="Upload sample debrief report">
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-cethos-teal transition-colors">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {cogSampleFile ? cogSampleFile.name : 'Click to upload'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file && file.size <= 10 * 1024 * 1024) {
                            setCogSampleFile(file)
                          }
                        }}
                      />
                    </label>
                  </FormField>
                )}
              </div>
            </FormSection>

            {/* Section 5: Availability & Rate */}
            <FormSection title="Availability & Rate">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Availability" required error={cogForm.formState.errors.cogAvailability?.message}>
                  <select {...cogForm.register('cogAvailability')} className={selectClasses}>
                    <option value="">Select...</option>
                    {AVAILABILITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>

              </div>
            </FormSection>

            {/* Additional Information */}
            <FormSection title="Additional Information">
              <FormField label="How did you hear about us?">
                <select {...cogForm.register('referralSource')} className={selectClasses}>
                  <option value="">Select...</option>
                  {REFERRAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Additional notes">
                <textarea
                  {...cogForm.register('notes')}
                  rows={3}
                  className={inputClasses}
                  placeholder="Anything else you'd like us to know?"
                />
              </FormField>
            </FormSection>

            {/* Section 8: Consent */}
            <FormSection title="Consent">
              <div className="space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...cogForm.register('privacyPolicy')}
                    className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">
                    I agree to the{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cethos-teal hover:text-cethos-teal underline"
                    >
                      Privacy Policy
                    </a>{' '}
                    <span className="text-red-500">*</span>
                  </span>
                </label>
                {cogForm.formState.errors.privacyPolicy && (
                  <p className="text-sm text-red-600 ml-6">{cogForm.formState.errors.privacyPolicy.message}</p>
                )}

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...cogForm.register('consentTest')}
                    className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">
                    I consent to receiving an assessment as part of this application <span className="text-red-500">*</span>
                  </span>
                </label>
                {cogForm.formState.errors.consentTest && (
                  <p className="text-sm text-red-600 ml-6">{cogForm.formState.errors.consentTest.message}</p>
                )}

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...cogForm.register('consentUnpaid')}
                    className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">
                    I understand the assessment is unpaid <span className="text-red-500">*</span>
                  </span>
                </label>
                {cogForm.formState.errors.consentUnpaid && (
                  <p className="text-sm text-red-600 ml-6">{cogForm.formState.errors.consentUnpaid.message}</p>
                )}
              </div>
            </FormSection>

            {/* Submit */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3 bg-cethos-teal text-white font-semibold rounded-lg hover:bg-cethos-teal-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  )
}
