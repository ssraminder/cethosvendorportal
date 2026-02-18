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
import { useLanguages } from '../hooks/useLanguages'
import { translatorSchema, cognitiveDebriefingSchema } from '../lib/schemas'
import type { TranslatorFormData, CognitiveDebriefingFormData } from '../lib/schemas'
import {
  COUNTRIES,
  EXPERIENCE_OPTIONS,
  EDUCATION_OPTIONS,
  CERTIFICATION_OPTIONS,
  CAT_TOOL_OPTIONS,
  SERVICE_OPTIONS,
  REFERRAL_OPTIONS,
  COG_INSTRUMENT_OPTIONS,
  COG_THERAPY_OPTIONS,
  FAMILIARITY_OPTIONS,
  AVAILABILITY_OPTIONS,
} from '../lib/constants'
import type { RoleType } from '../types/application'

const inputClasses = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
const selectClasses = inputClasses

export function Apply() {
  const [roleType, setRoleType] = useState<RoleType>('translator')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [workSampleFiles, setWorkSampleFiles] = useState<File[]>([])
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
      languagePairs: [{ sourceLanguageId: '', targetLanguageId: '', domains: [] }],
      servicesOffered: [],
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

  const handleToggleDomain = useCallback((pairIndex: number, domain: string) => {
    const current = translatorForm.getValues(`languagePairs.${pairIndex}.domains`) ?? []
    const updated = current.includes(domain as typeof current[number])
      ? current.filter((d) => d !== domain)
      : [...current, domain as typeof current[number]]
    translatorForm.setValue(
      `languagePairs.${pairIndex}.domains`,
      updated,
      { shouldValidate: true }
    )
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

  const handleWorkSampleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024)
    setWorkSampleFiles(prev => [...prev, ...validFiles].slice(0, 3))
  }

  const onTranslatorSubmit = async (data: TranslatorFormData) => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        ...data,
        workSampleFiles: workSampleFiles.length > 0 ? workSampleFiles : undefined,
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
          <h1 className="text-2xl font-bold text-gray-900">Apply to Join CETHOS</h1>
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
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="roleType"
                value="translator"
                checked={roleType === 'translator'}
                onChange={() => handleRoleChange('translator')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">Translator / Reviewer</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
              roleType === 'cognitive_debriefing'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="roleType"
                value="cognitive_debriefing"
                checked={roleType === 'cognitive_debriefing'}
                onChange={() => handleRoleChange('cognitive_debriefing')}
                className="text-blue-600 focus:ring-blue-500"
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
                  <label className="text-sm font-medium text-gray-700">Certifications</label>
                  <button
                    type="button"
                    onClick={() => addCert({ name: 'ATA', customName: '', expiryDate: '' })}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add certification
                  </button>
                </div>
                {certFields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start">
                    <select
                      {...translatorForm.register(`certifications.${index}.name`)}
                      className={`${selectClasses} flex-1`}
                    >
                      {CERTIFICATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {translatorForm.watch(`certifications.${index}.name`) === 'Other' && (
                      <input
                        {...translatorForm.register(`certifications.${index}.customName`)}
                        className={`${inputClasses} flex-1`}
                        placeholder="Certification name"
                      />
                    )}
                    <input
                      {...translatorForm.register(`certifications.${index}.expiryDate`)}
                      type="date"
                      className={`${inputClasses} w-40`}
                      placeholder="Expiry date"
                    />
                    <button
                      type="button"
                      onClick={() => removeCert(index)}
                      className="text-gray-400 hover:text-red-500 p-2"
                    >
                      <span className="sr-only">Remove</span>&times;
                    </button>
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
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
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

            {/* Section 3: Language Pairs & Domains */}
            <FormSection title="Language Pairs & Domains" description="Add each language pair you can work with, and select the domains you specialize in for each.">
              <div className="space-y-4">
                {languagePairFields.map((field, index) => (
                  <LanguagePairRow
                    key={field.id}
                    index={index}
                    languages={languages}
                    register={translatorForm.register}
                    errors={translatorForm.formState.errors}
                    onRemove={() => removeLanguagePair(index)}
                    canRemove={languagePairFields.length > 1}
                    selectedDomains={translatorForm.watch(`languagePairs.${index}.domains`) ?? []}
                    onToggleDomain={(domain) => handleToggleDomain(index, domain)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => addLanguagePair({ sourceLanguageId: '', targetLanguageId: '', domains: [] })}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add another language pair
                </button>
              </div>
              {translatorForm.formState.errors.languagePairs?.message && (
                <p className="text-sm text-red-600">{translatorForm.formState.errors.languagePairs.message}</p>
              )}
            </FormSection>

            {/* Section 4: Services Offered */}
            <FormSection title="Services Offered" description="Select all services you can provide.">
              <div className="space-y-3">
                {SERVICE_OPTIONS.map((service) => {
                  const selected = (translatorForm.watch('servicesOffered') ?? []).includes(service.value)
                  return (
                    <label
                      key={service.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        checked={selected}
                        onChange={() => handleToggleCheckbox(
                          translatorForm as unknown as { getValues: (field: string) => string[]; setValue: (field: string, value: string[], options?: { shouldValidate?: boolean }) => void },
                          'servicesOffered',
                          service.value
                        )}
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{service.label}</span>
                        <p className="text-xs text-gray-500">{service.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
              {translatorForm.formState.errors.servicesOffered?.message && (
                <p className="text-sm text-red-600">{translatorForm.formState.errors.servicesOffered.message}</p>
              )}
            </FormSection>

            {/* Section 5: Work Samples */}
            <FormSection title="Work Samples" description="Upload 1-3 samples of your work (PDF or DOCX, max 10MB each). Samples improve your pre-screening score.">
              <div className="space-y-3">
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">Click to upload files</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    multiple
                    className="sr-only"
                    onChange={handleWorkSampleUpload}
                  />
                </label>
                {workSampleFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setWorkSampleFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-red-500 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </FormSection>

            {/* Section 6: Rate Expectations */}
            <FormSection title="Rate Expectations">
              <FormField label="Expected rate per page (CAD)" hint="This is used for initial matching and may be subject to discussion.">
                <input
                  {...translatorForm.register('rateExpectation')}
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${inputClasses} max-w-xs`}
                  placeholder="e.g. 15.00"
                />
              </FormField>
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
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the Privacy Policy <span className="text-red-500">*</span>
                  </span>
                </label>
                {translatorForm.formState.errors.privacyPolicy && (
                  <p className="text-sm text-red-600 ml-6">{translatorForm.formState.errors.privacyPolicy.message}</p>
                )}

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...translatorForm.register('consentTest')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
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
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
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
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
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
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
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
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
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
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{opt.label}</span>
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
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{opt.label}</span>
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
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">I have prior debrief report writing experience</span>
                </label>

                {cogForm.watch('cogPriorDebriefReports') && (
                  <FormField label="Upload sample debrief report">
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-400 transition-colors">
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

                <FormField label="Expected day/project rate (CAD)" hint="This is used for initial matching and may be subject to discussion.">
                  <input
                    {...cogForm.register('cogRateExpectation')}
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClasses}
                    placeholder="e.g. 500.00"
                  />
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
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the Privacy Policy <span className="text-red-500">*</span>
                  </span>
                </label>
                {cogForm.formState.errors.privacyPolicy && (
                  <p className="text-sm text-red-600 ml-6">{cogForm.formState.errors.privacyPolicy.message}</p>
                )}

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...cogForm.register('consentTest')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
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
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
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
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
