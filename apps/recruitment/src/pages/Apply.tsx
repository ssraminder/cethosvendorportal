import { useState, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Upload, Loader2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { FormSection } from '../components/FormSection'
import { FormField } from '../components/FormField'
import { LanguagePairRow } from '../components/LanguagePairRow'
import { MultiSelect } from '../components/MultiSelect'
import { RankedMultiSelect } from '../components/RankedMultiSelect'
import { CvSection, ConsentSection } from '../components/FormHelpers'
import { useLanguages } from '../hooks/useLanguages'
import { supabase } from '../lib/supabase'
import {
  translatorSchema,
  cognitiveDebriefingSchema,
  interpreterSchema,
  transcriberSchema,
  clinicianReviewerSchema,
  cdConsultantSchema,
} from '../lib/schemas'
import type {
  TranslatorFormData,
  CognitiveDebriefingFormData,
  InterpreterFormData,
  TranscriberFormData,
  ClinicianReviewerFormData,
  CdConsultantFormData,
} from '../lib/schemas'
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
  COG_INTERVIEWS_CONDUCTED_OPTIONS,
  COG_INTERVIEW_MODE_OPTIONS,
  COG_ECOA_PLATFORM_OPTIONS,
  COG_SPECIAL_POPULATIONS_OPTIONS,
  TIMEZONE_OPTIONS,
} from '../lib/constants'
import { DOMAIN_OPTIONS } from '../lib/domains'
import type { DomainValue } from '../lib/domains'
import { RATE_CURRENCIES } from '../lib/currencies'
import {
  ROLE_OPTIONS,
  INTERPRETER_MODES,
  INTERPRETER_SETTINGS,
  INTERPRETER_DELIVERY,
  TRANSCRIBER_SPECIALIZATIONS,
  TRANSCRIBER_VERBATIM,
  TRANSCRIBER_TIMESTAMPING,
  CLINICIAN_CREDENTIALS,
  CLINICIAN_PROFESSIONS,
  CLINICIAN_THERAPY_AREAS,
  CONSULTANT_SERVICES,
} from '../lib/roles'
import type { RoleType } from '../types/application'

const inputClasses = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal'
const selectClasses = inputClasses

const CV_MISSING_ERROR = 'Please upload your CV before submitting (PDF only, max 10MB).'
const CV_NOT_PDF_ERROR = 'Only PDF format is accepted. If you have a DOCX, please export to PDF first.'
const CV_TOO_LARGE_ERROR = 'CV is too large — maximum 10MB.'

// Only roles offered on the form (must match ROLE_OPTIONS). Interpreter /
// transcriber / clinician_reviewer forms remain in code but are not offered, so
// a ?role= deep link can't select an unsupported (400-on-submit) role.
const VALID_ROLES: RoleType[] = ['translator', 'cognitive_debriefing', 'clinician_reviewer', 'cd_clinician_consultant']

const CLINICIAN_PROFESSION_VALUES = CLINICIAN_PROFESSIONS.map((p) => p.value) as string[]

export function Apply() {
  const [searchParams] = useSearchParams()
  const initialRole = (() => {
    const r = searchParams.get('role')
    return (r && VALID_ROLES.includes(r as RoleType)) ? (r as RoleType) : 'translator'
  })()
  // Clinician channel: pre-fill the profession from ?profession= (marketing-site
  // per-profession cards deep-link here), else default to physician.
  const initialProfession = (() => {
    const p = searchParams.get('profession')
    return (p && CLINICIAN_PROFESSION_VALUES.includes(p)) ? p : 'physician'
  })()
  const [roleType, setRoleType] = useState<RoleType>(initialRole)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cogSampleFile, setCogSampleFile] = useState<File | null>(null)
  // Clinician supporting documents (licence / degree / board-cert scans) —
  // multiple PDFs, uploaded alongside the required CV.
  const [docFiles, setDocFiles] = useState<File[]>([])
  // Duplicate-email detection: if the entered email already belongs to a vendor
  // or a prior application, block the submission and point them to log in.
  const [emailExists, setEmailExists] = useState<null | { type: 'vendor' | 'application' }>(null)
  const { languages, loading: languagesLoading, error: languagesError } = useLanguages()
  const navigate = useNavigate()

  // Translator form
  const translatorForm = useForm<TranslatorFormData>({
    resolver: zodResolver(translatorSchema) as Resolver<TranslatorFormData>,
    defaultValues: {
      roleType: 'translator',
      certifications: [],
      catTools: [],
      nativeLanguages: [],
      languagePairs: [{ sourceLanguageId: '', targetLanguageId: '', services: [] }],
      domainsOffered: [],
      rateCurrency: 'CAD',
      privacyPolicy: false as unknown as true,
      declarationTrue: false as unknown as true,
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

  // Interpreter form
  const interpreterForm = useForm<InterpreterFormData>({
    resolver: zodResolver(interpreterSchema) as Resolver<InterpreterFormData>,
    defaultValues: {
      roleType: 'interpreter',
      certifications: [],
      interpreterLanguagePairs: [{ sourceLanguageId: '', targetLanguageId: '' }],
      interpreterModes: [],
      interpreterSettings: [],
      rateCurrency: 'CAD',
      privacyPolicy: false as unknown as true,
      declarationTrue: false as unknown as true,
      consentTest: false as unknown as true,
      consentUnpaid: false as unknown as true,
    },
  })

  const { fields: interpreterPairFields, append: addInterpreterPair, remove: removeInterpreterPair } = useFieldArray({
    control: interpreterForm.control,
    name: 'interpreterLanguagePairs',
  })

  // Transcriber form
  const transcriberForm = useForm<TranscriberFormData>({
    resolver: zodResolver(transcriberSchema) as Resolver<TranscriberFormData>,
    defaultValues: {
      roleType: 'transcriber',
      certifications: [],
      transcriberLanguages: [],
      transcriberSpecializations: [],
      rateCurrency: 'CAD',
      privacyPolicy: false as unknown as true,
      declarationTrue: false as unknown as true,
      consentTest: false as unknown as true,
      consentUnpaid: false as unknown as true,
    },
  })

  // Clinician Reviewer form
  const clinicianForm = useForm<ClinicianReviewerFormData>({
    resolver: zodResolver(clinicianReviewerSchema) as Resolver<ClinicianReviewerFormData>,
    defaultValues: {
      roleType: 'clinician_reviewer',
      clinicianProfession: initialProfession as ClinicianReviewerFormData['clinicianProfession'],
      clinicianCredentials: [],
      degrees: [{ degree: '', field: '', institution: '', year: '' }],
      registration: { number: '', issuingBody: '', jurisdiction: '', status: 'active', expiresOn: '' },
      boardCertifications: [],
      clinicianTherapyAreas: [],
      clinicianWorkingLanguages: [],
      clinicianOtherLanguages: [],
      clinicianGcpTrained: false,
      clinicianCoaExperience: false,
      rateCurrency: 'CAD',
      privacyPolicy: false as unknown as true,
      declarationTrue: false as unknown as true,
    },
  })

  const { fields: degreeFields, append: addDegree, remove: removeDegree } = useFieldArray({
    control: clinicianForm.control,
    name: 'degrees',
  })

  const { fields: boardCertFields, append: addBoardCert, remove: removeBoardCert } = useFieldArray({
    control: clinicianForm.control,
    name: 'boardCertifications',
  })

  // Cognitive debriefing form
  const cogForm = useForm<CognitiveDebriefingFormData>({
    resolver: zodResolver(cognitiveDebriefingSchema) as Resolver<CognitiveDebriefingFormData>,
    defaultValues: {
      roleType: 'cognitive_debriefing',
      cogNativeLanguages: [],
      cogInstrumentTypes: [],
      cogTherapyAreas: [],
      cogAdditionalLanguages: [],
      cogInterviewModes: [],
      cogEcoaPlatforms: [],
      cogSpecialPopulations: [],
      cogPriorDebriefReports: false,
      cogConductsDirectPatientInterviews: false,
      cogGcpTrained: false,
      cogLicenseActive: false,
      cogRateCurrency: 'CAD',
      privacyPolicy: false as unknown as true,
      declarationTrue: false as unknown as true,
      consentTest: false as unknown as true,
      consentUnpaid: false as unknown as true,
    },
  })

  // CD & Clinician Review Consultant form (recruitment/consulting; no skills test)
  const consultantForm = useForm<CdConsultantFormData>({
    resolver: zodResolver(cdConsultantSchema) as Resolver<CdConsultantFormData>,
    defaultValues: {
      roleType: 'cd_clinician_consultant',
      consultantServices: [],
      clinicianTypesSourced: [],
      consultantTherapyAreas: [],
      consultantWorkingLanguages: [],
      canRecruitParticipants: false,
      canRecruitClinicians: false,
      consultantGcpTrained: false,
      rateCurrency: 'CAD',
      privacyPolicy: false as unknown as true,
      declarationTrue: false as unknown as true,
    },
  })

  const handleRoleChange = (newRole: RoleType) => {
    setRoleType(newRole)
    setSubmitError(null)
  }

  // Check (on email blur) whether this email already has a vendor account or an
  // application, and block the form if so. Fail-open on any error — the submit
  // endpoint is the authoritative guard.
  const checkEmail = useCallback(async (email: string) => {
    const e = (email ?? '').trim().toLowerCase()
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setEmailExists(null); return }
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cvp-check-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e }),
      })
      const r = await resp.json()
      setEmailExists(r?.exists ? { type: r.type } : null)
    } catch { setEmailExists(null) }
  }, [])

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
    // PDF-only — Anthropic document input requires PDF and accepting DOCX would
    // need a server-side conversion step we explicitly chose not to build.
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setSubmitError(CV_NOT_PDF_ERROR)
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError(CV_TOO_LARGE_ERROR)
      e.target.value = ''
      return
    }
    setSubmitError(null)
    setCvFile(file)
  }

  // Uploads the applicant's CV to the cvp-applicant-cvs bucket.
  // Path: {clientUuid}/{filename}. Returns the path for server-side persistence.
  const uploadCvIfPresent = async (): Promise<string | null> => {
    if (!cvFile) {
      setSubmitError(CV_MISSING_ERROR)
      return null
    }
    const clientUuid = crypto.randomUUID()
    const sanitized = cvFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${clientUuid}/${sanitized}`
    const { error } = await supabase.storage
      .from('cvp-applicant-cvs')
      .upload(path, cvFile, { cacheControl: '3600', upsert: false })
    if (error) {
      // Non-fatal: applicant can still submit without CV attached.
      console.error('CV upload failed:', error.message)
      return null
    }
    return path
  }

  // Clinician supporting documents — accept multiple PDFs (licence, degree,
  // board-cert scans). Same PDF-only / 10MB rule as the CV.
  const handleDocsAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const valid: File[] = []
    for (const file of files) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) { setSubmitError(CV_NOT_PDF_ERROR); continue }
      if (file.size > 10 * 1024 * 1024) { setSubmitError(CV_TOO_LARGE_ERROR); continue }
      valid.push(file)
    }
    if (valid.length) { setSubmitError(null); setDocFiles((prev) => [...prev, ...valid]) }
    e.target.value = ''
  }

  const removeDoc = (idx: number) => setDocFiles((prev) => prev.filter((_, i) => i !== idx))

  // Uploads each supporting document to the cvp-applicant-cvs bucket with a
  // doc_ prefix. Non-fatal per file — a failed upload is skipped, not blocking.
  const uploadDocs = async (): Promise<string[]> => {
    const paths: string[] = []
    for (const f of docFiles) {
      const clientUuid = crypto.randomUUID()
      const sanitized = f.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const path = `${clientUuid}/doc_${sanitized}`
      const { error } = await supabase.storage
        .from('cvp-applicant-cvs')
        .upload(path, f, { cacheControl: '3600', upsert: false })
      if (!error) paths.push(path)
      else console.error('Document upload failed:', error.message)
    }
    return paths
  }

  const onTranslatorSubmit = async (data: TranslatorFormData) => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const cvPath = await uploadCvIfPresent()
      if (!cvPath) { setSubmitting(false); return }
      const payload = { ...data, cvStoragePath: cvPath }

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

  // Generic submit helper for the 3 new role paths.
  const submitSimpleRole = async (data: Record<string, unknown>) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const cvPath = await uploadCvIfPresent()
      if (!cvPath) { setSubmitting(false); return }
      const payload = { ...data, cvStoragePath: cvPath }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cvp-submit-application`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
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

  const onInterpreterSubmit = (data: InterpreterFormData) => submitSimpleRole(data)
  const onTranscriberSubmit = (data: TranscriberFormData) => submitSimpleRole(data)
  const onConsultantSubmit = (data: CdConsultantFormData) => submitSimpleRole(data)

  // Clinician submit uploads the CV + any supporting documents, then posts the
  // form with cvStoragePath + documentPaths[].
  const onClinicianSubmit = async (data: ClinicianReviewerFormData) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const cvPath = await uploadCvIfPresent()
      if (!cvPath) { setSubmitting(false); return }
      const documentPaths = await uploadDocs()
      const payload = { ...data, cvStoragePath: cvPath, documentPaths }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cvp-submit-application`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
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

  const onCogSubmit = async (data: CognitiveDebriefingFormData) => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const cvPath = await uploadCvIfPresent()
      if (!cvPath) { setSubmitting(false); return }

      // Sample debrief report is optional — only upload if the applicant
      // both checked the box AND attached a file.
      let cogSamplePath: string | null = null
      if (data.cogPriorDebriefReports && cogSampleFile) {
        const clientUuid = crypto.randomUUID()
        const sanitized = cogSampleFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        const path = `${clientUuid}/sample_${sanitized}`
        const { error: sampleErr } = await supabase.storage
          .from('cvp-applicant-cvs')
          .upload(path, cogSampleFile, { cacheControl: '3600', upsert: false })
        if (!sampleErr) cogSamplePath = path
        else console.error('Sample report upload failed:', sampleErr.message)
      }

      const payload = {
        ...data,
        cvStoragePath: cvPath,
        cogSampleReportPath: cogSamplePath,
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

  // Safety net: if client-side validation blocks submission, ALWAYS surface a
  // visible message. react-hook-form auto-focuses the first invalid field, but a
  // REQUIRED field without a rendered control fails silently (the cause of the
  // Jun-23 "Submit does nothing" outage) — passing this as handleSubmit's
  // onInvalid arg guarantees the applicant always gets feedback.
  const handleInvalid = () => {
    setSubmitError(
      "Some required fields still need your attention — they're highlighted in red. Please complete them and submit again.",
    )
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
            We're recruiting translators &amp; revisers, cognitive debriefing interviewers,
            clinician reviewers (physicians, nurses &amp; pharmacists), and cognitive debriefing
            &amp; clinician review consultants for our growing clinical and COA linguistic
            validation work. Complete the form below to start the application process.
          </p>
        </div>

        {/* Role selector — 5 options */}
        <FormSection title="I am applying as a:">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLE_OPTIONS.map((role) => (
              <label
                key={role.value}
                className={`flex items-start gap-2 cursor-pointer rounded-lg border p-3 transition-colors ${
                  roleType === role.value
                    ? 'border-cethos-teal bg-cethos-bg-blue text-cethos-teal'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="roleType"
                  value={role.value}
                  checked={roleType === role.value}
                  onChange={() => handleRoleChange(role.value)}
                  className="mt-0.5 text-cethos-teal focus:ring-cethos-teal shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{role.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{role.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </FormSection>

        {/* Banner: agency applicants belong on the dedicated form. */}
        <div className="bg-cethos-bg-blue border border-cethos-teal/30 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-cethos-navy">
            Applying as a translation company or agency? You'll capture multiple services in one application.
          </p>
          <a
            href="/apply/agency"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-cethos-teal text-white text-sm font-medium hover:bg-cethos-teal-light transition-colors whitespace-nowrap"
          >
            Apply as an Agency →
          </a>
        </div>

        {/* Duplicate-email block: this email already has a vendor / application. */}
        {emailExists && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4" role="alert">
            <p className="text-sm text-amber-900">
              {emailExists.type === 'vendor' ? (
                <>
                  You already have a Cethos vendor account with this email. Please{' '}
                  <a href="https://vendor.cethos.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    log in to your vendor account
                  </a>{' '}
                  to manage your profile and check your status — there's no need to apply again.
                </>
              ) : (
                <>
                  We already have an application on file for this email. Please watch your inbox for updates
                  from our recruitment team — you don't need to submit again. If you need help, just reply to
                  your application confirmation email.
                </>
              )}
            </p>
          </div>
        )}

        {/* ===== TRANSLATOR FORM (individual) ===== */}
        {roleType === 'translator' && (
          <form onSubmit={translatorForm.handleSubmit(onTranslatorSubmit, handleInvalid)} className="space-y-6">
            {/* Section 1: Personal Information */}
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full name" required error={translatorForm.formState.errors.fullName?.message}>
                  <input {...translatorForm.register('fullName')} className={inputClasses} placeholder="John Doe" />
                </FormField>

                <FormField label="Email" required error={translatorForm.formState.errors.email?.message}>
                  <input {...translatorForm.register('email')} type="email" onBlur={(e) => checkEmail(e.target.value)} className={inputClasses} placeholder="john@example.com" />
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
                  <input {...translatorForm.register('linkedinUrl')} type="text" className={inputClasses} placeholder="linkedin.com/in/... (optional)" />
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
              <div className="mb-4">
                <FormField
                  label="Native language(s) (up to 3)"
                  required
                  hint="Your strongest native language(s)."
                  error={translatorForm.formState.errors.nativeLanguages?.message as string | undefined}
                >
                  <RankedMultiSelect
                    options={languages.map((l) => ({ value: l.id, label: l.name }))}
                    value={(translatorForm.watch('nativeLanguages') ?? []) as string[]}
                    onChange={(next) => translatorForm.setValue(
                      'nativeLanguages',
                      next,
                      { shouldValidate: true, shouldDirty: true }
                    )}
                    maxSelections={3}
                    placeholder="Select native language(s)…"
                  />
                </FormField>
              </div>
              <div className="space-y-4">
                {languagePairFields.map((field, index) => (
                  <LanguagePairRow
                    key={field.id}
                    index={index}
                    languages={languages}
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

            {/* Section 5a: Resume / CV (required) */}
            <CvSection
              cvFile={cvFile}
              setCvFile={setCvFile}
              handleCvUpload={handleCvUpload}
              showMissingError={submitError === CV_MISSING_ERROR}
            />

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
                    {...translatorForm.register('declarationTrue')}
                    className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">
                    I declare that all information I have provided in this application is true, accurate, and complete to the best of my knowledge <span className="text-red-500">*</span>
                  </span>
                </label>
                {translatorForm.formState.errors.declarationTrue && (
                  <p className="text-sm text-red-600 ml-6">{translatorForm.formState.errors.declarationTrue.message}</p>
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
          <form onSubmit={cogForm.handleSubmit(onCogSubmit, handleInvalid)} className="space-y-6">
            {/* Section 1: Personal Information */}
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full name" required error={cogForm.formState.errors.fullName?.message}>
                  <input {...cogForm.register('fullName')} className={inputClasses} placeholder="John Doe" />
                </FormField>

                <FormField label="Email" required error={cogForm.formState.errors.email?.message}>
                  <input {...cogForm.register('email')} type="email" onBlur={(e) => checkEmail(e.target.value)} className={inputClasses} placeholder="john@example.com" />
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
                  <input {...cogForm.register('linkedinUrl')} type="text" className={inputClasses} placeholder="linkedin.com/in/... (optional)" />
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
                <FormField
                  label="Native languages (up to 3, ranked by preference)"
                  required
                  error={cogForm.formState.errors.cogNativeLanguages?.message as string | undefined}
                  hint="Pick your strongest native languages, most native first."
                >
                  <RankedMultiSelect
                    options={languages.map((l) => ({ value: l.id, label: l.name }))}
                    value={(cogForm.watch('cogNativeLanguages') ?? []) as string[]}
                    onChange={(next) => cogForm.setValue(
                      'cogNativeLanguages',
                      next,
                      { shouldValidate: true, shouldDirty: true }
                    )}
                    maxSelections={3}
                    placeholder="Select native language(s)…"
                  />
                </FormField>

                <FormField label="Additional fluent languages">
                  <MultiSelect
                    options={languages.map((l) => ({ value: l.id, label: l.name }))}
                    value={(cogForm.watch('cogAdditionalLanguages') ?? []) as string[]}
                    onChange={(next) => cogForm.setValue(
                      'cogAdditionalLanguages',
                      next,
                      { shouldValidate: true, shouldDirty: true }
                    )}
                    placeholder="Select additional languages…"
                  />
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

            {/* Section 5: Patient Interview Experience */}
            <FormSection title="Patient Interview Experience">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Approximate number of CD interviews conducted"
                  required
                  error={cogForm.formState.errors.cogInterviewsConducted?.message}
                  hint="Count interviews you personally led, across all studies."
                >
                  <select {...cogForm.register('cogInterviewsConducted')} className={selectClasses}>
                    <option value="">Select...</option>
                    {COG_INTERVIEWS_CONDUCTED_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="Interview modes offered"
                  required
                  error={cogForm.formState.errors.cogInterviewModes?.message as string | undefined}
                >
                  <MultiSelect
                    options={COG_INTERVIEW_MODE_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
                    value={(cogForm.watch('cogInterviewModes') ?? []) as string[]}
                    onChange={(next) => cogForm.setValue(
                      'cogInterviewModes',
                      next as CognitiveDebriefingFormData['cogInterviewModes'],
                      { shouldValidate: true, shouldDirty: true },
                    )}
                    placeholder="Select interview modes…"
                  />
                </FormField>
              </div>

              <FormField
                label="Remote eCOA platforms used"
                hint="Platforms you have hands-on experience with. Optional."
                error={cogForm.formState.errors.cogEcoaPlatforms?.message as string | undefined}
              >
                <MultiSelect
                  options={COG_ECOA_PLATFORM_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                  value={(cogForm.watch('cogEcoaPlatforms') ?? []) as string[]}
                  onChange={(next) => cogForm.setValue(
                    'cogEcoaPlatforms',
                    next as CognitiveDebriefingFormData['cogEcoaPlatforms'],
                    { shouldValidate: true, shouldDirty: true },
                  )}
                  placeholder="Select eCOA platforms…"
                />
              </FormField>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...cogForm.register('cogConductsDirectPatientInterviews')}
                  className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                />
                <span className="text-sm text-cethos-navy">
                  I have personally interviewed patients (not desk-only linguistic validation).
                </span>
              </label>
            </FormSection>

            {/* Section 5b: Regulatory & Specialized Experience */}
            <FormSection title="Regulatory & Specialized Experience">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Familiar with EMA COA guidance?" required error={cogForm.formState.errors.cogEmaFamiliarity?.message}>
                  <div className="flex gap-4">
                    {FAMILIARITY_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          {...cogForm.register('cogEmaFamiliarity')}
                          value={opt.value}
                          className="text-cethos-teal focus:ring-cethos-teal"
                        />
                        <span className="text-sm text-cethos-navy">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </FormField>

                <FormField
                  label="Concept-elicitation experience"
                  required
                  hint="Distinct from cognitive debriefing — interviewing patients to surface concepts before a measure exists."
                  error={cogForm.formState.errors.cogConceptElicitationYears?.message}
                >
                  <select {...cogForm.register('cogConceptElicitationYears')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField
                label="Special populations worked with"
                hint="Optional. Select all that apply."
                error={cogForm.formState.errors.cogSpecialPopulations?.message as string | undefined}
              >
                <MultiSelect
                  options={COG_SPECIAL_POPULATIONS_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                  value={(cogForm.watch('cogSpecialPopulations') ?? []) as string[]}
                  onChange={(next) => cogForm.setValue(
                    'cogSpecialPopulations',
                    next as CognitiveDebriefingFormData['cogSpecialPopulations'],
                    { shouldValidate: true, shouldDirty: true },
                  )}
                  placeholder="Select populations…"
                />
              </FormField>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...cogForm.register('cogGcpTrained')}
                    className="text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">I have completed Good Clinical Practice (GCP) training.</span>
                </label>
                {cogForm.watch('cogGcpTrained') && (
                  <div className="ml-6">
                    <FormField label="Year of most recent GCP training">
                      <input
                        {...cogForm.register('cogGcpYear')}
                        type="number"
                        min="2000"
                        max="2030"
                        className={inputClasses}
                        placeholder="e.g. 2025"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            </FormSection>

            {/* Section 5c: Professional License (optional, clinician-style CDs) */}
            <FormSection title="Professional License (optional)">
              <p className="text-sm text-gray-500 -mt-2">
                Only complete if you hold a professional license (RN, MD, PsyD, LCSW, etc.). All fields optional.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="License type">
                  <input {...cogForm.register('cogLicenseType')} className={inputClasses} placeholder="e.g. RN, MD, PsyD" />
                </FormField>
                <FormField label="Jurisdiction">
                  <input {...cogForm.register('cogLicenseJurisdiction')} className={inputClasses} placeholder="e.g. California, Ontario, UK" />
                </FormField>
                <FormField label="License number">
                  <input {...cogForm.register('cogLicenseNumber')} className={inputClasses} placeholder="License #" />
                </FormField>
                <FormField label="Status">
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      {...cogForm.register('cogLicenseActive')}
                      className="text-cethos-teal focus:ring-cethos-teal"
                    />
                    <span className="text-sm text-cethos-navy">Active and in good standing</span>
                  </label>
                </FormField>
              </div>
            </FormSection>

            {/* Section 6: Availability & Rate */}
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

                <FormField
                  label="Time zone"
                  required
                  hint="For scheduling interviews across geographies."
                  error={cogForm.formState.errors.cogTimezone?.message}
                >
                  <select {...cogForm.register('cogTimezone')} className={selectClasses}>
                    <option value="">Select...</option>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Hourly rate"
                  required
                  hint="Or per-interview rate — note which in Additional notes."
                  error={cogForm.formState.errors.cogRateExpectation?.message}
                >
                  <input
                    {...cogForm.register('cogRateExpectation')}
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClasses}
                    placeholder="e.g. 125.00"
                  />
                </FormField>

                <FormField label="Currency" required error={cogForm.formState.errors.cogRateCurrency?.message}>
                  <select {...cogForm.register('cogRateCurrency')} className={selectClasses}>
                    {RATE_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            {/* Section 6a: Resume / CV (required) */}
            <CvSection
              cvFile={cvFile}
              setCvFile={setCvFile}
              handleCvUpload={handleCvUpload}
              showMissingError={submitError === CV_MISSING_ERROR}
            />

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
                    {...cogForm.register('declarationTrue')}
                    className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                  />
                  <span className="text-sm text-cethos-navy">
                    I declare that all information I have provided in this application is true, accurate, and complete to the best of my knowledge <span className="text-red-500">*</span>
                  </span>
                </label>
                {cogForm.formState.errors.declarationTrue && (
                  <p className="text-sm text-red-600 ml-6">{cogForm.formState.errors.declarationTrue.message}</p>
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

        {/* ===== INTERPRETER FORM (individual) ===== */}
        {roleType === 'interpreter' && (
          <form onSubmit={interpreterForm.handleSubmit(onInterpreterSubmit, handleInvalid)} className="space-y-6">
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full name" required error={interpreterForm.formState.errors.fullName?.message}>
                  <input {...interpreterForm.register('fullName')} className={inputClasses} placeholder="Jane Smith" />
                </FormField>
                <FormField label="Email" required error={interpreterForm.formState.errors.email?.message}>
                  <input {...interpreterForm.register('email')} type="email" onBlur={(e) => checkEmail(e.target.value)} className={inputClasses} />
                </FormField>
                <FormField label="Phone" error={interpreterForm.formState.errors.phone?.message}>
                  <input {...interpreterForm.register('phone')} type="tel" className={inputClasses} />
                </FormField>
                <FormField label="City" error={interpreterForm.formState.errors.city?.message}>
                  <input {...interpreterForm.register('city')} className={inputClasses} />
                </FormField>
                <FormField label="Country" required error={interpreterForm.formState.errors.country?.message}>
                  <select {...interpreterForm.register('country')} className={selectClasses}>
                    <option value="">Select country...</option>
                    {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </FormField>
                <FormField label="LinkedIn URL" error={interpreterForm.formState.errors.linkedinUrl?.message}>
                  <input {...interpreterForm.register('linkedinUrl')} type="text" className={inputClasses} placeholder="linkedin.com/in/... (optional)" />
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Professional Background">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Years of experience" required error={interpreterForm.formState.errors.yearsExperience?.message}>
                  <select {...interpreterForm.register('yearsExperience')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EXPERIENCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
                <FormField label="Education level" required error={interpreterForm.formState.errors.educationLevel?.message}>
                  <select {...interpreterForm.register('educationLevel')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EDUCATION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Interpretation Profile">
              <FormField label="Modes" required error={interpreterForm.formState.errors.interpreterModes?.message as string | undefined}>
                <MultiSelect
                  options={INTERPRETER_MODES.map((m) => ({ value: m.value, label: m.label }))}
                  value={(interpreterForm.watch('interpreterModes') ?? []) as string[]}
                  onChange={(next) => interpreterForm.setValue('interpreterModes', next as InterpreterFormData['interpreterModes'], { shouldValidate: true })}
                  placeholder="Select interpretation modes…"
                />
              </FormField>

              <FormField label="Settings" required error={interpreterForm.formState.errors.interpreterSettings?.message as string | undefined}>
                <MultiSelect
                  options={INTERPRETER_SETTINGS.map((s) => ({ value: s.value, label: s.label }))}
                  value={(interpreterForm.watch('interpreterSettings') ?? []) as string[]}
                  onChange={(next) => interpreterForm.setValue('interpreterSettings', next as InterpreterFormData['interpreterSettings'], { shouldValidate: true })}
                  placeholder="Select settings…"
                />
              </FormField>

              <FormField label="Delivery" required error={interpreterForm.formState.errors.interpreterDelivery?.message}>
                <select {...interpreterForm.register('interpreterDelivery')} className={selectClasses}>
                  <option value="">Select...</option>
                  {INTERPRETER_DELIVERY.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
                </select>
              </FormField>
            </FormSection>

            <FormSection title="Language Pairs">
              <div className="space-y-3">
                {interpreterPairFields.map((field, index) => {
                  const pairErrors = interpreterForm.formState.errors.interpreterLanguagePairs?.[index]
                  return (
                    <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-cethos-navy">Pair {index + 1}</span>
                        {interpreterPairFields.length > 1 && (
                          <button type="button" onClick={() => removeInterpreterPair(index)} className="text-gray-400 hover:text-red-500">×</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Source *</label>
                          <select {...interpreterForm.register(`interpreterLanguagePairs.${index}.sourceLanguageId`)} className={selectClasses}>
                            <option value="">Select...</option>
                            {languages.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                          </select>
                          {pairErrors?.sourceLanguageId && <p className="mt-1 text-xs text-red-600">{pairErrors.sourceLanguageId.message}</p>}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Target *</label>
                          <select {...interpreterForm.register(`interpreterLanguagePairs.${index}.targetLanguageId`)} className={selectClasses}>
                            <option value="">Select...</option>
                            {languages.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                          </select>
                          {pairErrors?.targetLanguageId && <p className="mt-1 text-xs text-red-600">{pairErrors.targetLanguageId.message}</p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <button type="button" onClick={() => addInterpreterPair({ sourceLanguageId: '', targetLanguageId: '' })} className="flex items-center gap-1.5 text-sm text-cethos-teal hover:text-cethos-teal-light font-medium">
                  <Plus className="w-4 h-4" /> Add another language pair
                </button>
              </div>
            </FormSection>

            <FormSection title="Rates">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Hourly rate" required error={interpreterForm.formState.errors.interpreterHourlyRate?.message}>
                  <input {...interpreterForm.register('interpreterHourlyRate')} type="number" step="0.01" className={inputClasses} placeholder="75.00" />
                </FormField>
                <FormField label="Minimum engagement (hours)" hint="E.g. 1 or 2 hour minimum">
                  <input {...interpreterForm.register('interpreterMinEngagementHours')} type="number" step="0.5" className={inputClasses} placeholder="1" />
                </FormField>
                <FormField label="Currency" required error={interpreterForm.formState.errors.rateCurrency?.message}>
                  <select {...interpreterForm.register('rateCurrency')} className={selectClasses}>
                    {RATE_CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <CvSection cvFile={cvFile} setCvFile={setCvFile} handleCvUpload={handleCvUpload} showMissingError={submitError === CV_MISSING_ERROR} />

            <FormSection title="Additional Information">
              <FormField label="How did you hear about us?">
                <select {...interpreterForm.register('referralSource')} className={selectClasses}>
                  <option value="">Select...</option>
                  {REFERRAL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </FormField>
              <FormField label="Additional notes">
                <textarea {...interpreterForm.register('notes')} rows={3} className={inputClasses} />
              </FormField>
            </FormSection>

            <ConsentSection form={interpreterForm} />

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-sm text-red-700">{submitError}</p></div>
            )}
            <button type="submit" disabled={submitting || Boolean(emailExists)} className="w-full sm:w-auto px-8 py-3 bg-cethos-teal text-white font-semibold rounded-lg hover:bg-cethos-teal-light disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}

        {/* ===== TRANSCRIBER FORM (individual) ===== */}
        {roleType === 'transcriber' && (
          <form onSubmit={transcriberForm.handleSubmit(onTranscriberSubmit, handleInvalid)} className="space-y-6">
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full name" required error={transcriberForm.formState.errors.fullName?.message}>
                  <input {...transcriberForm.register('fullName')} className={inputClasses} />
                </FormField>
                <FormField label="Email" required error={transcriberForm.formState.errors.email?.message}>
                  <input {...transcriberForm.register('email')} type="email" onBlur={(e) => checkEmail(e.target.value)} className={inputClasses} />
                </FormField>
                <FormField label="Phone" error={transcriberForm.formState.errors.phone?.message}>
                  <input {...transcriberForm.register('phone')} type="tel" className={inputClasses} />
                </FormField>
                <FormField label="City" error={transcriberForm.formState.errors.city?.message}>
                  <input {...transcriberForm.register('city')} className={inputClasses} />
                </FormField>
                <FormField label="Country" required error={transcriberForm.formState.errors.country?.message}>
                  <select {...transcriberForm.register('country')} className={selectClasses}>
                    <option value="">Select country...</option>
                    {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </FormField>
                <FormField label="LinkedIn URL" error={transcriberForm.formState.errors.linkedinUrl?.message}>
                  <input {...transcriberForm.register('linkedinUrl')} type="text" className={inputClasses} placeholder="linkedin.com/in/... (optional)" />
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Professional Background">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Years of experience" required error={transcriberForm.formState.errors.yearsExperience?.message}>
                  <select {...transcriberForm.register('yearsExperience')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EXPERIENCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
                <FormField label="Education level" required error={transcriberForm.formState.errors.educationLevel?.message}>
                  <select {...transcriberForm.register('educationLevel')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EDUCATION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Transcription Profile">
              <FormField label="Working languages" required error={transcriberForm.formState.errors.transcriberLanguages?.message as string | undefined}>
                <MultiSelect
                  options={languages.map((l) => ({ value: l.id, label: l.name }))}
                  value={(transcriberForm.watch('transcriberLanguages') ?? []) as string[]}
                  onChange={(next) => transcriberForm.setValue('transcriberLanguages', next, { shouldValidate: true })}
                  placeholder="Select working languages…"
                />
              </FormField>

              <FormField label="Specializations" required error={transcriberForm.formState.errors.transcriberSpecializations?.message as string | undefined}>
                <MultiSelect
                  options={TRANSCRIBER_SPECIALIZATIONS.map((s) => ({ value: s.value, label: s.label }))}
                  value={(transcriberForm.watch('transcriberSpecializations') ?? []) as string[]}
                  onChange={(next) => transcriberForm.setValue('transcriberSpecializations', next as TranscriberFormData['transcriberSpecializations'], { shouldValidate: true })}
                  placeholder="Select specializations…"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Verbatim style" required error={transcriberForm.formState.errors.transcriberVerbatimMode?.message}>
                  <select {...transcriberForm.register('transcriberVerbatimMode')} className={selectClasses}>
                    <option value="">Select...</option>
                    {TRANSCRIBER_VERBATIM.map((v) => (<option key={v.value} value={v.value}>{v.label}</option>))}
                  </select>
                </FormField>
                <FormField label="Time-stamping" required error={transcriberForm.formState.errors.transcriberTimestamping?.message}>
                  <select {...transcriberForm.register('transcriberTimestamping')} className={selectClasses}>
                    <option value="">Select...</option>
                    {TRANSCRIBER_TIMESTAMPING.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Rates">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Per audio-minute" required error={transcriberForm.formState.errors.transcriberRatePerMinute?.message}>
                  <input {...transcriberForm.register('transcriberRatePerMinute')} type="number" step="0.01" className={inputClasses} placeholder="2.50" />
                </FormField>
                <FormField label="Per hour (optional)">
                  <input {...transcriberForm.register('transcriberRatePerHour')} type="number" step="0.01" className={inputClasses} placeholder="45.00" />
                </FormField>
                <FormField label="Currency" required error={transcriberForm.formState.errors.rateCurrency?.message}>
                  <select {...transcriberForm.register('rateCurrency')} className={selectClasses}>
                    {RATE_CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <CvSection cvFile={cvFile} setCvFile={setCvFile} handleCvUpload={handleCvUpload} showMissingError={submitError === CV_MISSING_ERROR} />

            <FormSection title="Additional Information">
              <FormField label="How did you hear about us?">
                <select {...transcriberForm.register('referralSource')} className={selectClasses}>
                  <option value="">Select...</option>
                  {REFERRAL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </FormField>
              <FormField label="Additional notes">
                <textarea {...transcriberForm.register('notes')} rows={3} className={inputClasses} />
              </FormField>
            </FormSection>

            <ConsentSection form={transcriberForm} />

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-sm text-red-700">{submitError}</p></div>
            )}
            <button type="submit" disabled={submitting || Boolean(emailExists)} className="w-full sm:w-auto px-8 py-3 bg-cethos-teal text-white font-semibold rounded-lg hover:bg-cethos-teal-light disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}

        {/* ===== CLINICIAN REVIEWER FORM (physicians / nurses / pharmacists) ===== */}
        {roleType === 'clinician_reviewer' && (
          <form onSubmit={clinicianForm.handleSubmit(onClinicianSubmit, handleInvalid)} className="space-y-6">
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full name" required error={clinicianForm.formState.errors.fullName?.message}>
                  <input {...clinicianForm.register('fullName')} className={inputClasses} />
                </FormField>
                <FormField label="Email" required error={clinicianForm.formState.errors.email?.message}>
                  <input {...clinicianForm.register('email')} type="email" onBlur={(e) => checkEmail(e.target.value)} className={inputClasses} />
                </FormField>
                <FormField label="Phone" error={clinicianForm.formState.errors.phone?.message}>
                  <input {...clinicianForm.register('phone')} type="tel" className={inputClasses} />
                </FormField>
                <FormField label="City" error={clinicianForm.formState.errors.city?.message}>
                  <input {...clinicianForm.register('city')} className={inputClasses} />
                </FormField>
                <FormField label="Country" required error={clinicianForm.formState.errors.country?.message}>
                  <select {...clinicianForm.register('country')} className={selectClasses}>
                    <option value="">Select country...</option>
                    {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </FormField>
                <FormField label="LinkedIn URL" error={clinicianForm.formState.errors.linkedinUrl?.message}>
                  <input {...clinicianForm.register('linkedinUrl')} type="text" className={inputClasses} placeholder="linkedin.com/in/... (optional)" />
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Profession & Credentials">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="I am a" required error={clinicianForm.formState.errors.clinicianProfession?.message as string | undefined}>
                  <select {...clinicianForm.register('clinicianProfession')} className={selectClasses}>
                    {CLINICIAN_PROFESSIONS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                </FormField>
                <FormField label="Education level" required error={clinicianForm.formState.errors.educationLevel?.message}>
                  <select {...clinicianForm.register('educationLevel')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EDUCATION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
              </div>
              <FormField label="Credentials" required error={clinicianForm.formState.errors.clinicianCredentials?.message as string | undefined}>
                <MultiSelect
                  options={CLINICIAN_CREDENTIALS.map((c) => ({ value: c.value, label: c.label }))}
                  value={(clinicianForm.watch('clinicianCredentials') ?? []) as string[]}
                  onChange={(next) => clinicianForm.setValue('clinicianCredentials', next as ClinicianReviewerFormData['clinicianCredentials'], { shouldValidate: true })}
                  placeholder="Select credentials…"
                />
              </FormField>
            </FormSection>

            <FormSection title="Degrees" description="Add each qualifying degree. At least one is required — attach the certificate under Supporting documents below.">
              <div className="space-y-4">
                {degreeFields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-3">
                      <FormField label="Degree" required error={clinicianForm.formState.errors.degrees?.[i]?.degree?.message}>
                        <input {...clinicianForm.register(`degrees.${i}.degree` as const)} className={inputClasses} placeholder="MD, PharmD, PhD…" />
                      </FormField>
                    </div>
                    <div className="sm:col-span-3">
                      <FormField label="Field">
                        <input {...clinicianForm.register(`degrees.${i}.field` as const)} className={inputClasses} placeholder="Medicine…" />
                      </FormField>
                    </div>
                    <div className="sm:col-span-4">
                      <FormField label="Institution" required error={clinicianForm.formState.errors.degrees?.[i]?.institution?.message}>
                        <input {...clinicianForm.register(`degrees.${i}.institution` as const)} className={inputClasses} />
                      </FormField>
                    </div>
                    <div className="sm:col-span-2 flex items-end gap-2">
                      <FormField label="Year">
                        <input {...clinicianForm.register(`degrees.${i}.year` as const)} type="number" min="1950" className={inputClasses} placeholder="2010" />
                      </FormField>
                      {degreeFields.length > 1 && (
                        <button type="button" onClick={() => removeDegree(i)} className="mb-2 text-gray-500 hover:text-red-600 text-sm shrink-0">Remove</button>
                      )}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => addDegree({ degree: '', field: '', institution: '', year: '' })} className="inline-flex items-center gap-1 text-sm text-cethos-teal hover:text-cethos-teal-light">
                  <Plus className="w-4 h-4" /> Add degree
                </button>
                {typeof (clinicianForm.formState.errors.degrees as { message?: string } | undefined)?.message === 'string' && (
                  <p className="text-sm text-red-600">{(clinicianForm.formState.errors.degrees as { message?: string }).message}</p>
                )}
              </div>
            </FormSection>

            <FormSection title="Professional Registration" description="Your current licence or registration with a regulatory body. The registration number is required — it's how we verify you're licensed to practise.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Registration / licence number" required error={clinicianForm.formState.errors.registration?.number?.message}>
                  <input {...clinicianForm.register('registration.number')} className={inputClasses} placeholder="e.g. GMC 1234567" />
                </FormField>
                <FormField label="Issuing body / regulator" required error={clinicianForm.formState.errors.registration?.issuingBody?.message}>
                  <input {...clinicianForm.register('registration.issuingBody')} className={inputClasses} placeholder="e.g. General Medical Council" />
                </FormField>
                <FormField label="Jurisdiction" required error={clinicianForm.formState.errors.registration?.jurisdiction?.message}>
                  <input {...clinicianForm.register('registration.jurisdiction')} className={inputClasses} placeholder="e.g. United Kingdom" />
                </FormField>
                <FormField label="Status" required error={clinicianForm.formState.errors.registration?.status?.message}>
                  <select {...clinicianForm.register('registration.status')} className={selectClasses}>
                    <option value="active">Active</option>
                    <option value="provisional">Provisional / trainee</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </FormField>
                <FormField label="Expiry (optional)">
                  <input {...clinicianForm.register('registration.expiresOn')} type="month" className={inputClasses} />
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Board Certifications (optional)" description="Specialty board certifications, if any.">
              <div className="space-y-4">
                {boardCertFields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <FormField label="Specialty" required error={clinicianForm.formState.errors.boardCertifications?.[i]?.specialty?.message}>
                        <input {...clinicianForm.register(`boardCertifications.${i}.specialty` as const)} className={inputClasses} placeholder="e.g. Psychiatry" />
                      </FormField>
                    </div>
                    <div className="sm:col-span-4">
                      <FormField label="Board">
                        <input {...clinicianForm.register(`boardCertifications.${i}.board` as const)} className={inputClasses} placeholder="Certifying board" />
                      </FormField>
                    </div>
                    <div className="sm:col-span-3 flex items-end gap-2">
                      <FormField label="Year">
                        <input {...clinicianForm.register(`boardCertifications.${i}.year` as const)} type="number" min="1950" className={inputClasses} />
                      </FormField>
                      <button type="button" onClick={() => removeBoardCert(i)} className="mb-2 text-gray-500 hover:text-red-600 text-sm shrink-0">Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => addBoardCert({ specialty: '', board: '', year: '', expiresOn: '' })} className="inline-flex items-center gap-1 text-sm text-cethos-teal hover:text-cethos-teal-light">
                  <Plus className="w-4 h-4" /> Add board certification
                </button>
              </div>
            </FormSection>

            <FormSection title="Review Profile">
              <FormField label="Languages you can review in" required error={clinicianForm.formState.errors.clinicianWorkingLanguages?.message as string | undefined}>
                <MultiSelect
                  options={languages.map((l) => ({ value: l.id, label: l.name }))}
                  value={(clinicianForm.watch('clinicianWorkingLanguages') ?? []) as string[]}
                  onChange={(next) => clinicianForm.setValue('clinicianWorkingLanguages', next, { shouldValidate: true })}
                  placeholder="Select languages…"
                />
              </FormField>

              <FormField label="Other languages (can discuss, not review)">
                <MultiSelect
                  options={languages.map((l) => ({ value: l.id, label: l.name }))}
                  value={(clinicianForm.watch('clinicianOtherLanguages') ?? []) as string[]}
                  onChange={(next) => clinicianForm.setValue('clinicianOtherLanguages', next, { shouldValidate: true })}
                  placeholder="Select languages…"
                />
              </FormField>

              <FormField label="Therapy areas" required error={clinicianForm.formState.errors.clinicianTherapyAreas?.message as string | undefined}>
                <MultiSelect
                  options={CLINICIAN_THERAPY_AREAS.map((a) => ({ value: a.value, label: a.label }))}
                  value={(clinicianForm.watch('clinicianTherapyAreas') ?? []) as string[]}
                  onChange={(next) => clinicianForm.setValue('clinicianTherapyAreas', next as ClinicianReviewerFormData['clinicianTherapyAreas'], { shouldValidate: true })}
                  placeholder="Select therapy areas…"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Years of independent practice" required error={clinicianForm.formState.errors.clinicianYearsIndependentPractice?.message}>
                  <input {...clinicianForm.register('clinicianYearsIndependentPractice')} type="number" min="0" className={inputClasses} />
                </FormField>
                <FormField label="Years COA/PRO (optional)">
                  <input {...clinicianForm.register('clinicianYearsCoa')} type="number" min="0" className={inputClasses} />
                </FormField>
                <FormField label="Time zone (optional)">
                  <select {...clinicianForm.register('clinicianTimezone')} className={selectClasses}>
                    <option value="">Select...</option>
                    {TIMEZONE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Indicative hourly rate (optional)" hint="Clinicians are engaged on an agreed hourly fee — this is only a guide.">
                  <input {...clinicianForm.register('clinicianHourlyRate')} type="number" step="0.01" className={inputClasses} placeholder="150.00" />
                </FormField>
                <FormField label="Currency">
                  <select {...clinicianForm.register('rateCurrency')} className={selectClasses}>
                    {RATE_CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
                  </select>
                </FormField>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...clinicianForm.register('clinicianGcpTrained')} className="text-cethos-teal focus:ring-cethos-teal" />
                  <span className="text-sm text-gray-700">GCP (Good Clinical Practice) trained</span>
                </label>
                {clinicianForm.watch('clinicianGcpTrained') && (
                  <FormField label="GCP training year">
                    <input {...clinicianForm.register('clinicianGcpYear')} type="number" min="1990" className={`${inputClasses} max-w-xs`} placeholder="2022" />
                  </FormField>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...clinicianForm.register('clinicianCoaExperience')} className="text-cethos-teal focus:ring-cethos-teal" />
                  <span className="text-sm text-gray-700">I have prior COA / PRO instrument experience</span>
                </label>
                {clinicianForm.watch('clinicianCoaExperience') && (
                  <FormField label="Briefly describe your COA/PRO experience">
                    <textarea {...clinicianForm.register('clinicianCoaExperienceNotes')} rows={2} className={inputClasses} />
                  </FormField>
                )}
              </div>
            </FormSection>

            <CvSection cvFile={cvFile} setCvFile={setCvFile} handleCvUpload={handleCvUpload} showMissingError={submitError === CV_MISSING_ERROR} />

            <FormSection title="Supporting documents" description="Upload scans of your licence, degree certificate(s) and any board certifications (PDF, max 10MB each). You can add several.">
              <div className="space-y-2">
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-cethos-teal rounded-lg p-6 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">Click to add documents (PDF only)</span>
                  <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={handleDocsAdd} />
                </label>
                {docFiles.length > 0 && (
                  <ul className="space-y-2">
                    {docFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between bg-cethos-bg-blue rounded-md px-3 py-2 border border-cethos-teal/30">
                        <span className="text-sm text-cethos-navy truncate">{f.name}</span>
                        <button type="button" onClick={() => removeDoc(i)} className="text-gray-500 hover:text-red-600 text-sm shrink-0 ml-2">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FormSection>

            <FormSection title="Additional Information">
              <FormField label="Conflicts of interest (optional)" hint="Any commercial or clinical interests that could affect your independence as a reviewer.">
                <textarea {...clinicianForm.register('conflictsOfInterest')} rows={2} className={inputClasses} />
              </FormField>
              <FormField label="How did you hear about us?">
                <select {...clinicianForm.register('referralSource')} className={selectClasses}>
                  <option value="">Select...</option>
                  {REFERRAL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </FormField>
              <FormField label="Additional notes">
                <textarea {...clinicianForm.register('notes')} rows={3} className={inputClasses} />
              </FormField>
            </FormSection>

            <ConsentSection form={clinicianForm} testConsent={false} />

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-sm text-red-700">{submitError}</p></div>
            )}
            <button type="submit" disabled={submitting || Boolean(emailExists)} className="w-full sm:w-auto px-8 py-3 bg-cethos-teal text-white font-semibold rounded-lg hover:bg-cethos-teal-light disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}

        {roleType === 'cd_clinician_consultant' && (
          <form onSubmit={consultantForm.handleSubmit(onConsultantSubmit, handleInvalid)} className="space-y-6">
            <FormSection title="Personal Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full name" required error={consultantForm.formState.errors.fullName?.message}>
                  <input {...consultantForm.register('fullName')} className={inputClasses} />
                </FormField>
                <FormField label="Email" required error={consultantForm.formState.errors.email?.message}>
                  <input {...consultantForm.register('email')} type="email" onBlur={(e) => checkEmail(e.target.value)} className={inputClasses} />
                </FormField>
                <FormField label="Phone" error={consultantForm.formState.errors.phone?.message}>
                  <input {...consultantForm.register('phone')} type="tel" className={inputClasses} />
                </FormField>
                <FormField label="City" error={consultantForm.formState.errors.city?.message}>
                  <input {...consultantForm.register('city')} className={inputClasses} />
                </FormField>
                <FormField label="Country" required error={consultantForm.formState.errors.country?.message}>
                  <select {...consultantForm.register('country')} className={selectClasses}>
                    <option value="">Select country...</option>
                    {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </FormField>
                <FormField label="LinkedIn URL" error={consultantForm.formState.errors.linkedinUrl?.message}>
                  <input {...consultantForm.register('linkedinUrl')} type="text" className={inputClasses} placeholder="linkedin.com/in/... (optional)" />
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Professional Background">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Years of relevant experience" required error={consultantForm.formState.errors.consultantYearsExperience?.message}>
                  <select {...consultantForm.register('consultantYearsExperience')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EXPERIENCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
                <FormField label="Education level" required error={consultantForm.formState.errors.educationLevel?.message}>
                  <select {...consultantForm.register('educationLevel')} className={selectClasses}>
                    <option value="">Select...</option>
                    {EDUCATION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Services & Capabilities" description="Tell us what you can provide for cognitive debriefing and clinician review studies.">
              <FormField label="Services you provide" required error={consultantForm.formState.errors.consultantServices?.message as string | undefined}>
                <MultiSelect
                  options={CONSULTANT_SERVICES.map((s) => ({ value: s.value, label: s.label }))}
                  value={(consultantForm.watch('consultantServices') ?? []) as string[]}
                  onChange={(next) => consultantForm.setValue('consultantServices', next as CdConsultantFormData['consultantServices'], { shouldValidate: true })}
                  placeholder="Select services…"
                />
              </FormField>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" {...consultantForm.register('canRecruitParticipants')} className="text-cethos-teal focus:ring-cethos-teal" />
                  I can recruit cognitive debriefing participants
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" {...consultantForm.register('canRecruitClinicians')} className="text-cethos-teal focus:ring-cethos-teal" />
                  I can recruit / source clinicians (ClinRO reviewers)
                </label>
              </div>
              <FormField label="Clinician types you can source (optional)">
                <MultiSelect
                  options={CLINICIAN_CREDENTIALS.map((c) => ({ value: c.value, label: c.label }))}
                  value={(consultantForm.watch('clinicianTypesSourced') ?? []) as string[]}
                  onChange={(next) => consultantForm.setValue('clinicianTypesSourced', next as CdConsultantFormData['clinicianTypesSourced'], { shouldValidate: true })}
                  placeholder="Select clinician types…"
                />
              </FormField>
              <FormField label="Therapy areas" required error={consultantForm.formState.errors.consultantTherapyAreas?.message as string | undefined}>
                <MultiSelect
                  options={CLINICIAN_THERAPY_AREAS.map((a) => ({ value: a.value, label: a.label }))}
                  value={(consultantForm.watch('consultantTherapyAreas') ?? []) as string[]}
                  onChange={(next) => consultantForm.setValue('consultantTherapyAreas', next as CdConsultantFormData['consultantTherapyAreas'], { shouldValidate: true })}
                  placeholder="Select therapy areas…"
                />
              </FormField>
            </FormSection>

            <FormSection title="Coverage">
              <FormField label="Countries / regions you cover" required error={consultantForm.formState.errors.consultantRegionsCovered?.message}>
                <input {...consultantForm.register('consultantRegionsCovered')} className={inputClasses} placeholder="e.g. India, UK, Germany, LatAm" />
              </FormField>
              <FormField label="Working languages" required error={consultantForm.formState.errors.consultantWorkingLanguages?.message as string | undefined}>
                <MultiSelect
                  options={languages.map((l) => ({ value: l.id, label: l.name }))}
                  value={(consultantForm.watch('consultantWorkingLanguages') ?? []) as string[]}
                  onChange={(next) => consultantForm.setValue('consultantWorkingLanguages', next, { shouldValidate: true })}
                  placeholder="Select languages…"
                />
              </FormField>
            </FormSection>

            <FormSection title="Methodology Familiarity">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="ISPOR" required error={consultantForm.formState.errors.consultantIsporFamiliarity?.message}>
                  <select {...consultantForm.register('consultantIsporFamiliarity')} className={selectClasses}>
                    <option value="">Select...</option>
                    {FAMILIARITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
                <FormField label="FDA" required error={consultantForm.formState.errors.consultantFdaFamiliarity?.message}>
                  <select {...consultantForm.register('consultantFdaFamiliarity')} className={selectClasses}>
                    <option value="">Select...</option>
                    {FAMILIARITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
                <FormField label="EMA" required error={consultantForm.formState.errors.consultantEmaFamiliarity?.message}>
                  <select {...consultantForm.register('consultantEmaFamiliarity')} className={selectClasses}>
                    <option value="">Select...</option>
                    {FAMILIARITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" {...consultantForm.register('consultantGcpTrained')} className="text-cethos-teal focus:ring-cethos-teal" />
                GCP trained
              </label>
            </FormSection>

            <FormSection title="Availability & Rate">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Availability" required error={consultantForm.formState.errors.consultantAvailability?.message}>
                  <select {...consultantForm.register('consultantAvailability')} className={selectClasses}>
                    <option value="">Select...</option>
                    {AVAILABILITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </FormField>
                <FormField label="Rate expectation" required error={consultantForm.formState.errors.consultantRateExpectation?.message}>
                  <input {...consultantForm.register('consultantRateExpectation')} type="text" className={inputClasses} placeholder="e.g. 80/hour or per-project" />
                </FormField>
                <FormField label="Currency" required error={consultantForm.formState.errors.rateCurrency?.message}>
                  <select {...consultantForm.register('rateCurrency')} className={selectClasses}>
                    {RATE_CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <CvSection cvFile={cvFile} setCvFile={setCvFile} handleCvUpload={handleCvUpload} showMissingError={submitError === CV_MISSING_ERROR} />

            <FormSection title="Additional Information">
              <FormField label="How did you hear about us?">
                <select {...consultantForm.register('referralSource')} className={selectClasses}>
                  <option value="">Select...</option>
                  {REFERRAL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </FormField>
              <FormField label="Additional notes">
                <textarea {...consultantForm.register('notes')} rows={3} className={inputClasses} />
              </FormField>
            </FormSection>

            <ConsentSection form={consultantForm} testConsent={false} />

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-sm text-red-700">{submitError}</p></div>
            )}
            <button type="submit" disabled={submitting || Boolean(emailExists)} className="w-full sm:w-auto px-8 py-3 bg-cethos-teal text-white font-semibold rounded-lg hover:bg-cethos-teal-light disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  )
}
