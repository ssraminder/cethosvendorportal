import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, Loader2 } from 'lucide-react'
import { FormSection } from './FormSection'
import { FormField } from './FormField'
import { MultiSelect } from './MultiSelect'
import { ConsentSection } from './FormHelpers'
import { useLanguages } from '../hooks/useLanguages'
import { supabase } from '../lib/supabase'
import { agencyApplicationSchema } from '../lib/schemas'
import type { AgencyApplicationFormData } from '../lib/schemas'
import {
  COUNTRIES,
  REFERRAL_OPTIONS,
  AGENCY_LINGUIST_COUNT_OPTIONS,
  AGENCY_YEARS_OPERATING_OPTIONS,
  AGENCY_SERVICE_OPTIONS,
} from '../lib/constants'
import { DOMAIN_OPTIONS } from '../lib/domains'
import type { DomainValue } from '../lib/domains'
import {
  INTERPRETER_MODES,
  INTERPRETER_SETTINGS,
  TRANSCRIBER_SPECIALIZATIONS,
} from '../lib/roles'

const inputClasses = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal'
const selectClasses = inputClasses

const PROFILE_MISSING_ERROR = 'Please upload your company profile PDF before submitting (max 10MB).'
const PROFILE_NOT_PDF_ERROR = 'Only PDF format is accepted for the company profile.'
const PROFILE_TOO_LARGE_ERROR = 'Company profile is too large — maximum 10MB.'

export function AgencyForm() {
  const navigate = useNavigate()
  const { languages, loading: languagesLoading, error: languagesError } = useLanguages()
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<AgencyApplicationFormData>({
    resolver: zodResolver(agencyApplicationSchema) as Resolver<AgencyApplicationFormData>,
    defaultValues: {
      roleType: 'agency',
      applicantType: 'agency',
      servicesOffered: [],
      languagePairs: [{ sourceLanguageId: '', targetLanguageId: '' }],
      domainsOffered: [],
      interpreterModes: [],
      interpreterSettings: [],
      transcriberLanguages: [],
      transcriberSpecializations: [],
      privacyPolicy: false as unknown as true,
      consentTest: false as unknown as true,
      consentUnpaid: false as unknown as true,
    },
  })

  const { fields: pairFields, append: addPair, remove: removePair } = useFieldArray({
    control: form.control,
    name: 'languagePairs',
  })

  const services = (form.watch('servicesOffered') ?? []) as string[]
  const hasTranslation = services.includes('translation')
  const hasInterpretation = services.includes('interpretation')
  const hasTranscription = services.includes('transcription')
  const wantsLangPairs = hasTranslation || hasInterpretation

  const toggleService = (value: 'translation' | 'interpretation' | 'transcription') => {
    const current = (form.getValues('servicesOffered') ?? []) as string[]
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    form.setValue('servicesOffered', next as ('translation' | 'interpretation' | 'transcription')[], { shouldValidate: true })
  }

  const handleProfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) { setSubmitError(PROFILE_NOT_PDF_ERROR); e.target.value = ''; return }
    if (file.size > 10 * 1024 * 1024) { setSubmitError(PROFILE_TOO_LARGE_ERROR); e.target.value = ''; return }
    setSubmitError(null)
    setProfileFile(file)
  }

  const uploadProfileIfPresent = async (): Promise<string | null> => {
    if (!profileFile) { setSubmitError(PROFILE_MISSING_ERROR); return null }
    const clientUuid = crypto.randomUUID()
    const sanitized = profileFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `agency-profiles/${clientUuid}/${sanitized}`
    const { error } = await supabase.storage
      .from('cvp-applicant-cvs')
      .upload(path, profileFile, { cacheControl: '3600', upsert: false })
    if (error) { console.error('Profile upload failed:', error.message); return null }
    return path
  }

  const onSubmit = async (data: AgencyApplicationFormData) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const profilePath = await uploadProfileIfPresent()
      if (!profilePath) { setSubmitting(false); return }
      const payload = { ...data, agencyCompanyProfilePath: profilePath }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cvp-submit-application`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const result = await response.json()
      if (!result.success) throw new Error(result.error ?? 'Submission failed')
      navigate('/apply/confirmation', { state: { applicationNumber: result.data.applicationNumber } })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const errors = form.formState.errors as Record<string, { message?: string } | undefined>

  if (languagesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    )
  }
  if (languagesError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{languagesError}</p>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Services Offered */}
      <FormSection title="Services Offered" description="Select every service your agency provides. You can pick more than one.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AGENCY_SERVICE_OPTIONS.map((opt) => {
            const selected = services.includes(opt.value)
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-2 cursor-pointer rounded-lg border p-3 transition-colors ${
                  selected ? 'border-cethos-teal bg-cethos-bg-blue text-cethos-teal' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleService(opt.value)}
                  className="mt-0.5 text-cethos-teal focus:ring-cethos-teal shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.hint}</div>
                </div>
              </label>
            )
          })}
        </div>
        {errors.servicesOffered?.message && (
          <p className="text-sm text-red-600 mt-2">{errors.servicesOffered.message}</p>
        )}
      </FormSection>

      {/* Primary Contact */}
      <FormSection title="Primary Contact" description="Who at your agency should we reach about this application?">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Contact name" required error={errors.agencyPrimaryContactName?.message}>
            <input {...form.register('agencyPrimaryContactName')} className={inputClasses} placeholder="Jane Smith" />
          </FormField>
          <FormField label="Contact role" required error={errors.agencyPrimaryContactRole?.message}>
            <input {...form.register('agencyPrimaryContactRole')} className={inputClasses} placeholder="e.g. Vendor Manager" />
          </FormField>
          <FormField label="Work email" required error={errors.email?.message}>
            <input {...form.register('email')} type="email" className={inputClasses} placeholder="jane@agency.com" />
          </FormField>
          <FormField label="Phone" error={errors.phone?.message}>
            <input {...form.register('phone')} type="tel" className={inputClasses} placeholder="+1 555 123 4567" />
          </FormField>
          <FormField label="Country" required error={errors.country?.message}>
            <select {...form.register('country')} className={selectClasses}>
              <option value="">Select country...</option>
              {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </FormField>
          <FormField label="LinkedIn URL" error={errors.linkedinUrl?.message}>
            <input {...form.register('linkedinUrl')} type="url" className={inputClasses} placeholder="https://linkedin.com/company/..." />
          </FormField>
        </div>
      </FormSection>

      {/* Business Information */}
      <FormSection title="Business Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Business name" required error={errors.agencyBusinessName?.message}>
            <input {...form.register('agencyBusinessName')} className={inputClasses} placeholder="Acme Translations Inc." />
          </FormField>
          <FormField label="Country of registration" required error={errors.agencyRegistrationCountry?.message}>
            <select {...form.register('agencyRegistrationCountry')} className={selectClasses}>
              <option value="">Select country...</option>
              {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </FormField>
          <FormField label="Tax / registration ID" required error={errors.agencyTaxId?.message}>
            <input {...form.register('agencyTaxId')} className={inputClasses} placeholder="EIN / VAT / business number" />
          </FormField>
          <FormField label="Linguists on roster" required error={errors.agencyLinguistCount?.message}>
            <select {...form.register('agencyLinguistCount')} className={selectClasses}>
              <option value="">Select...</option>
              {AGENCY_LINGUIST_COUNT_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </FormField>
          <FormField label="Years operating" required error={errors.agencyYearsOperating?.message}>
            <select {...form.register('agencyYearsOperating')} className={selectClasses}>
              <option value="">Select...</option>
              {AGENCY_YEARS_OPERATING_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </FormField>
        </div>
      </FormSection>

      {/* Company Profile PDF */}
      <FormSection
        title="Company Profile *"
        description="Upload your company profile / capabilities deck as a PDF (max 10MB). Required."
      >
        <div className="space-y-2">
          {!profileFile ? (
            <label
              className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                submitError === PROFILE_MISSING_ERROR
                  ? 'border-red-400 bg-red-50 hover:border-red-500'
                  : 'border-gray-300 hover:border-cethos-teal'
              }`}
            >
              <Upload className={`w-5 h-5 ${submitError === PROFILE_MISSING_ERROR ? 'text-red-500' : 'text-gray-400'}`} />
              <span className={`text-sm ${submitError === PROFILE_MISSING_ERROR ? 'text-red-700 font-medium' : 'text-gray-500'}`}>
                Click to upload company profile (PDF only)
              </span>
              <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={handleProfileUpload} />
            </label>
          ) : (
            <div className="flex items-center justify-between bg-cethos-bg-blue rounded-md px-3 py-2 border border-cethos-teal/30">
              <span className="text-sm text-cethos-navy truncate">{profileFile.name}</span>
              <button type="button" onClick={() => setProfileFile(null)} className="text-gray-500 hover:text-red-600 text-sm">
                Remove
              </button>
            </div>
          )}
          {submitError === PROFILE_MISSING_ERROR && !profileFile && (
            <p className="text-xs text-red-600">Company profile is required to submit your application.</p>
          )}
        </div>
      </FormSection>

      {/* Language Pairs — required if translation or interpretation selected */}
      {wantsLangPairs && (
        <FormSection
          title="Language Pairs"
          description="Approximate pairs your agency covers. You will build the detailed roster after approval."
        >
          <div className="space-y-3">
            {pairFields.map((field, index) => {
              const pairErrors = (form.formState.errors as Record<string, unknown>).languagePairs as
                | Array<{ sourceLanguageId?: { message?: string }; targetLanguageId?: { message?: string } }>
                | undefined
              const pairError = pairErrors?.[index]
              return (
                <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-cethos-navy">Pair {index + 1}</span>
                    {pairFields.length > 1 && (
                      <button type="button" onClick={() => removePair(index)} className="text-gray-400 hover:text-red-500">×</button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Source *</label>
                      <select {...form.register(`languagePairs.${index}.sourceLanguageId`)} className={selectClasses}>
                        <option value="">Select...</option>
                        {languages.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                      </select>
                      {pairError?.sourceLanguageId && <p className="mt-1 text-xs text-red-600">{pairError.sourceLanguageId.message}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Target *</label>
                      <select {...form.register(`languagePairs.${index}.targetLanguageId`)} className={selectClasses}>
                        <option value="">Select...</option>
                        {languages.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                      </select>
                      {pairError?.targetLanguageId && <p className="mt-1 text-xs text-red-600">{pairError.targetLanguageId.message}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => addPair({ sourceLanguageId: '', targetLanguageId: '' })}
              className="flex items-center gap-1.5 text-sm text-cethos-teal hover:text-cethos-teal-light font-medium"
            >
              <Plus className="w-4 h-4" /> Add another language pair
            </button>
            {(errors.languagePairs as { message?: string } | undefined)?.message && (
              <p className="text-sm text-red-600">{(errors.languagePairs as { message?: string }).message}</p>
            )}
          </div>
        </FormSection>
      )}

      {/* Translation extras */}
      {hasTranslation && (
        <FormSection title="Translation Profile">
          <FormField label="Domains" required error={(errors.domainsOffered as { message?: string } | undefined)?.message}>
            <MultiSelect
              options={DOMAIN_OPTIONS.map((d) => ({ value: d.value, label: d.label }))}
              value={(form.watch('domainsOffered') ?? []) as string[]}
              onChange={(next) => form.setValue('domainsOffered', next as DomainValue[], { shouldValidate: true })}
              placeholder="Select domains…"
            />
          </FormField>
        </FormSection>
      )}

      {/* Interpretation extras */}
      {hasInterpretation && (
        <FormSection title="Interpretation Profile">
          <FormField label="Modes offered" required error={(errors.interpreterModes as { message?: string } | undefined)?.message}>
            <MultiSelect
              options={INTERPRETER_MODES.map((m) => ({ value: m.value, label: m.label }))}
              value={(form.watch('interpreterModes') ?? []) as string[]}
              onChange={(next) => form.setValue('interpreterModes', next as AgencyApplicationFormData['interpreterModes'], { shouldValidate: true })}
              placeholder="Select modes…"
            />
          </FormField>
          <FormField label="Settings" required error={(errors.interpreterSettings as { message?: string } | undefined)?.message}>
            <MultiSelect
              options={INTERPRETER_SETTINGS.map((s) => ({ value: s.value, label: s.label }))}
              value={(form.watch('interpreterSettings') ?? []) as string[]}
              onChange={(next) => form.setValue('interpreterSettings', next as AgencyApplicationFormData['interpreterSettings'], { shouldValidate: true })}
              placeholder="Select settings…"
            />
          </FormField>
        </FormSection>
      )}

      {/* Transcription extras */}
      {hasTranscription && (
        <FormSection title="Transcription Profile">
          <FormField label="Working languages" required error={(errors.transcriberLanguages as { message?: string } | undefined)?.message}>
            <MultiSelect
              options={languages.map((l) => ({ value: l.id, label: l.name }))}
              value={(form.watch('transcriberLanguages') ?? []) as string[]}
              onChange={(next) => form.setValue('transcriberLanguages', next, { shouldValidate: true })}
              placeholder="Select languages…"
            />
          </FormField>
          <FormField label="Specializations" required error={(errors.transcriberSpecializations as { message?: string } | undefined)?.message}>
            <MultiSelect
              options={TRANSCRIBER_SPECIALIZATIONS.map((s) => ({ value: s.value, label: s.label }))}
              value={(form.watch('transcriberSpecializations') ?? []) as string[]}
              onChange={(next) => form.setValue('transcriberSpecializations', next as AgencyApplicationFormData['transcriberSpecializations'], { shouldValidate: true })}
              placeholder="Select specializations…"
            />
          </FormField>
        </FormSection>
      )}

      {/* Additional Information */}
      <FormSection title="Additional Information">
        <FormField label="How did you hear about us?">
          <select {...form.register('referralSource')} className={selectClasses}>
            <option value="">Select...</option>
            {REFERRAL_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </FormField>
        <FormField label="Additional notes">
          <textarea {...form.register('notes')} rows={3} className={inputClasses} placeholder="Anything else you'd like us to know?" />
        </FormField>
      </FormSection>

      {/* Consent */}
      <ConsentSection form={form} />

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
  )
}
