import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Loader2, ArrowLeft, ExternalLink, AlertTriangle, CheckCircle2,
  XCircle, Clock, ChevronDown, ChevronUp, Save, Send,
  User, Briefcase, Globe, Mail, Phone, MapPin, FileText,
  Shield, Star, DollarSign,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  EXPERIENCE_OPTIONS,
  EDUCATION_OPTIONS,
  CERTIFICATION_OPTIONS,
  DOMAIN_OPTIONS,
  SERVICE_OPTIONS,
  COG_INSTRUMENT_OPTIONS,
  COG_THERAPY_OPTIONS,
  FAMILIARITY_OPTIONS,
  AVAILABILITY_OPTIONS,
} from '../../lib/constants'

// --- Types ---

interface ApplicationFull {
  id: string
  application_number: string
  role_type: 'translator' | 'cognitive_debriefing'
  email: string
  full_name: string
  phone: string | null
  city: string | null
  country: string
  linkedin_url: string | null
  years_experience: number | null
  education_level: string | null
  certifications: { name: string; customName?: string; expiryDate?: string }[]
  cat_tools: string[]
  services_offered: string[]
  work_samples: { storage_path: string; description: string }[]
  rate_expectation: number | null
  referral_source: string | null
  notes: string | null
  cog_years_experience: number | null
  cog_degree_field: string | null
  cog_credentials: string | null
  cog_instrument_types: string[]
  cog_therapy_areas: string[]
  cog_pharma_clients: string | null
  cog_ispor_familiarity: string | null
  cog_fda_familiarity: string | null
  cog_prior_debrief_reports: boolean
  cog_sample_report_path: string | null
  cog_availability: string | null
  cog_rate_expectation: number | null
  status: string
  ai_prescreening_score: number | null
  ai_prescreening_result: PrescreenResult | CogPrescreenResult | AiFallbackResult | null
  ai_prescreening_at: string | null
  assigned_tier: string | null
  tier_override_by: string | null
  tier_override_at: string | null
  negotiation_status: string | null
  negotiation_log: NegotiationEvent[]
  final_agreed_rate: number | null
  staff_review_notes: string | null
  staff_reviewed_by: string | null
  staff_reviewed_at: string | null
  rejection_reason: string | null
  rejection_email_draft: string | null
  rejection_email_status: string | null
  rejection_email_queued_at: string | null
  can_reapply_after: string | null
  waitlist_language_pair: string | null
  waitlist_notes: string | null
  translator_id: string | null
  created_at: string
  updated_at: string
}

interface PrescreenResult {
  overall_score: number
  recommendation: 'proceed' | 'staff_review' | 'reject'
  demand_match: string
  certification_quality: string
  experience_consistency: string
  sample_quality: string
  rate_expectation_assessment: string
  red_flags: string[]
  notes: string
  suggested_test_difficulty: string
  suggested_test_types: string[]
  suggested_tier: string
}

interface CogPrescreenResult {
  overall_score: number
  recommendation: 'staff_review'
  coa_instrument_experience: string
  guideline_familiarity: string
  interviewing_skills: string
  language_fluency: string
  report_writing_experience: string
  red_flags: string[]
  notes: string
}

interface AiFallbackResult {
  error: 'ai_fallback'
  reason: string
}

interface NegotiationEvent {
  event: string
  amount?: number
  final_amount?: number
  timestamp: string
  notes?: string
}

interface TestCombinationRow {
  id: string
  source_language_id: string
  target_language_id: string
  domain: string
  service_type: string
  status: string
  ai_score: number | null
  ai_assessment_result: Record<string, unknown> | null
  approved_at: string | null
  approved_rate: number | null
  test_submission_id: string | null
  created_at: string
}

interface TestCombinationDisplay extends TestCombinationRow {
  source_language_name: string
  target_language_name: string
}

interface TestSubmissionRow {
  id: string
  combination_id: string
  status: string
  token: string
  token_expires_at: string
  submitted_at: string | null
  ai_assessment_score: number | null
  first_viewed_at: string | null
  view_count: number
  created_at: string
}

// --- Constants ---

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  prescreening: 'Pre-screening',
  prescreened: 'Pre-screened',
  test_pending: 'Test Pending',
  test_sent: 'Test Sent',
  test_in_progress: 'Test In Progress',
  test_submitted: 'Test Submitted',
  test_assessed: 'Test Assessed',
  negotiation: 'Negotiation',
  staff_review: 'Staff Review',
  approved: 'Approved',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
  archived: 'Archived',
  info_requested: 'Info Requested',
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-gray-100 text-gray-700',
  prescreening: 'bg-yellow-100 text-yellow-800',
  prescreened: 'bg-blue-100 text-blue-700',
  test_pending: 'bg-blue-100 text-blue-700',
  test_sent: 'bg-blue-100 text-blue-700',
  test_in_progress: 'bg-indigo-100 text-indigo-700',
  test_submitted: 'bg-indigo-100 text-indigo-700',
  test_assessed: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-orange-100 text-orange-700',
  staff_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  waitlisted: 'bg-cyan-100 text-cyan-700',
  archived: 'bg-gray-100 text-gray-500',
  info_requested: 'bg-yellow-100 text-yellow-700',
}

const COMBO_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  no_test_available: 'No Test Available',
  test_assigned: 'Test Assigned',
  test_sent: 'Test Sent',
  test_submitted: 'Test Submitted',
  assessed: 'Assessed',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
}

const COMBO_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  no_test_available: 'bg-yellow-100 text-yellow-700',
  test_assigned: 'bg-blue-100 text-blue-700',
  test_sent: 'bg-blue-100 text-blue-700',
  test_submitted: 'bg-indigo-100 text-indigo-700',
  assessed: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
}

const TIER_LABELS: Record<string, string> = {
  standard: 'Standard',
  senior: 'Senior',
  expert: 'Expert',
}

const TIER_COLORS: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700',
  senior: 'bg-blue-100 text-blue-700',
  expert: 'bg-purple-100 text-purple-700',
}

const STRENGTH_COLORS: Record<string, string> = {
  strong: 'text-green-700 bg-green-50',
  partial: 'text-yellow-700 bg-yellow-50',
  weak: 'text-red-700 bg-red-50',
  high: 'text-green-700 bg-green-50',
  medium: 'text-yellow-700 bg-yellow-50',
  low: 'text-red-700 bg-red-50',
  none: 'text-gray-500 bg-gray-50',
  not_provided: 'text-gray-400 bg-gray-50',
  within_band: 'text-green-700 bg-green-50',
  above_band: 'text-orange-700 bg-orange-50',
  below_band: 'text-blue-700 bg-blue-50',
}

function lookupLabel(options: readonly { value: string; label: string }[], value: string | null): string {
  if (!value) return '—'
  const found = options.find((o) => o.value === value)
  return found ? found.label : value
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function hoursUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60)))
}

function isAiFallback(result: unknown): result is AiFallbackResult {
  return typeof result === 'object' && result !== null && (result as AiFallbackResult).error === 'ai_fallback'
}

function isTranslatorResult(result: unknown): result is PrescreenResult {
  return typeof result === 'object' && result !== null && 'demand_match' in (result as Record<string, unknown>)
}

// --- Component ---

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [application, setApplication] = useState<ApplicationFull | null>(null)
  const [combinations, setCombinations] = useState<TestCombinationDisplay[]>([])
  const [submissions, setSubmissions] = useState<TestSubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Staff actions state
  const [staffNotes, setStaffNotes] = useState('')
  const [tierOverride, setTierOverride] = useState('')
  const [rejectionDraft, setRejectionDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [savingTier, setSavingTier] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Collapsible sections
  const [showAiDetails, setShowAiDetails] = useState(true)
  const [showCombinations, setShowCombinations] = useState(true)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)

    try {
      // Fetch application
      const { data: appData, error: appError } = await supabase
        .from('cvp_applications')
        .select('*')
        .eq('id', id)
        .single()

      if (appError || !appData) {
        setError('Application not found.')
        setLoading(false)
        return
      }

      const app = appData as unknown as ApplicationFull
      setApplication(app)
      setStaffNotes(app.staff_review_notes ?? '')
      setTierOverride(app.assigned_tier ?? '')
      setRejectionDraft(app.rejection_email_draft ?? '')

      // Fetch test combinations with language names
      const { data: comboData } = await supabase
        .from('cvp_test_combinations')
        .select('*')
        .eq('application_id', id)
        .order('created_at', { ascending: true })

      const combos = (comboData ?? []) as unknown as TestCombinationRow[]

      // Fetch language names for all source/target language IDs
      const languageIds = new Set<string>()
      for (const c of combos) {
        languageIds.add(c.source_language_id)
        languageIds.add(c.target_language_id)
      }

      let languageMap: Record<string, string> = {}
      if (languageIds.size > 0) {
        const { data: langData } = await supabase
          .from('languages')
          .select('id, name')
          .in('id', Array.from(languageIds))

        if (langData) {
          languageMap = Object.fromEntries(
            (langData as { id: string; name: string }[]).map((l) => [l.id, l.name])
          )
        }
      }

      const displayCombos: TestCombinationDisplay[] = combos.map((c) => ({
        ...c,
        source_language_name: languageMap[c.source_language_id] ?? 'Unknown',
        target_language_name: languageMap[c.target_language_id] ?? 'Unknown',
      }))
      setCombinations(displayCombos)

      // Fetch test submissions if any
      const { data: subData } = await supabase
        .from('cvp_test_submissions')
        .select('*')
        .eq('application_id', id)
        .order('created_at', { ascending: true })

      setSubmissions((subData ?? []) as unknown as TestSubmissionRow[])
    } catch (err) {
      console.error('Error fetching application detail:', err)
      setError('Failed to load application data.')
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Staff action handlers ---

  const saveStaffNotes = async () => {
    if (!application) return
    setSavingNotes(true)
    setActionMessage(null)

    const { error: updateError } = await supabase
      .from('cvp_applications')
      .update({
        staff_review_notes: staffNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Failed to save notes.' })
    } else {
      setActionMessage({ type: 'success', text: 'Notes saved.' })
    }
    setSavingNotes(false)
  }

  const saveTierOverride = async () => {
    if (!application || !tierOverride) return
    setSavingTier(true)
    setActionMessage(null)

    const { error: updateError } = await supabase
      .from('cvp_applications')
      .update({
        assigned_tier: tierOverride,
        tier_override_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Failed to update tier.' })
    } else {
      setApplication({ ...application, assigned_tier: tierOverride })
      setActionMessage({ type: 'success', text: 'Tier updated.' })
    }
    setSavingTier(false)
  }

  const saveRejectionDraft = async () => {
    if (!application) return
    setActionMessage(null)

    const { error: updateError } = await supabase
      .from('cvp_applications')
      .update({
        rejection_email_draft: rejectionDraft,
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Failed to save rejection draft.' })
    } else {
      setActionMessage({ type: 'success', text: 'Rejection email draft saved.' })
    }
  }

  const updateApplicationStatus = async (newStatus: string, extra?: Record<string, unknown>) => {
    if (!application) return
    setActionLoading(newStatus)
    setActionMessage(null)

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...extra,
    }

    const { error: updateError } = await supabase
      .from('cvp_applications')
      .update(updateData)
      .eq('id', application.id)

    if (updateError) {
      setActionMessage({ type: 'error', text: `Failed to update status to ${newStatus}.` })
    } else {
      setApplication({ ...application, status: newStatus, ...extra } as ApplicationFull)
      setActionMessage({ type: 'success', text: `Status updated to ${STATUS_LABELS[newStatus] ?? newStatus}.` })
    }
    setActionLoading(null)
  }

  const interceptRejection = async () => {
    if (!application) return
    setActionLoading('intercept')
    setActionMessage(null)

    const { error: updateError } = await supabase
      .from('cvp_applications')
      .update({
        rejection_email_status: 'intercepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id)

    if (updateError) {
      setActionMessage({ type: 'error', text: 'Failed to intercept rejection email.' })
    } else {
      setApplication({ ...application, rejection_email_status: 'intercepted' })
      setActionMessage({ type: 'success', text: 'Rejection email intercepted.' })
    }
    setActionLoading(null)
  }

  // --- Render helpers ---

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 text-sm">Loading application...</span>
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
          <button onClick={() => navigate('/admin/recruitment')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to queue
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error ?? 'Application not found.'}
          </div>
        </div>
      </div>
    )
  }

  const aiResult = application.ai_prescreening_result
  const isTranslator = application.role_type === 'translator'
  const rejectionWindowOpen = application.rejection_email_status === 'queued' && application.rejection_email_queued_at
    ? hoursUntil(new Date(new Date(application.rejection_email_queued_at).getTime() + 48 * 60 * 60 * 1000).toISOString()) > 0
    : false

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin/recruitment')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Queue
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{application.full_name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[application.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[application.status] ?? application.status}
                </span>
                {application.assigned_tier && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_COLORS[application.assigned_tier] ?? 'bg-gray-100 text-gray-600'}`}>
                    {TIER_LABELS[application.assigned_tier] ?? application.assigned_tier}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {application.application_number} &middot;{' '}
                {isTranslator ? 'Translator / Reviewer' : 'Cognitive Debriefing Consultant'} &middot;{' '}
                Applied {formatDate(application.created_at)} ({daysSince(application.created_at)}d ago)
              </p>
            </div>
          </div>
        </div>

        {/* Action message */}
        {actionMessage && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            actionMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Three-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT PANEL — Applicant Info */}
          <div className="lg:col-span-3 space-y-4">
            {/* Contact info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Contact
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <a href={`mailto:${application.email}`} className="text-blue-600 hover:underline break-all">{application.email}</a>
                </div>
                {application.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{application.phone}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-gray-700">{[application.city, application.country].filter(Boolean).join(', ')}</span>
                </div>
                {application.linkedin_url && (
                  <div className="flex items-start gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <a href={application.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">LinkedIn</a>
                  </div>
                )}
              </div>
            </div>

            {/* Professional background */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Professional Background
              </h2>
              <div className="space-y-3 text-sm">
                {isTranslator ? (
                  <>
                    <InfoRow label="Experience" value={lookupLabel(EXPERIENCE_OPTIONS, String(application.years_experience))} />
                    <InfoRow label="Education" value={lookupLabel(EDUCATION_OPTIONS, application.education_level)} />
                    {application.certifications?.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide">Certifications</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {application.certifications.map((cert, i) => {
                            const label = cert.name === 'Other' && cert.customName
                              ? cert.customName
                              : CERTIFICATION_OPTIONS.find((o) => o.value === cert.name)?.label ?? cert.name
                            return (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                {label}
                                {cert.expiryDate && <span className="text-blue-400 ml-1">(exp {cert.expiryDate})</span>}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {application.cat_tools?.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide">CAT Tools</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {application.cat_tools.map((tool) => (
                            <span key={tool} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tool}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {application.services_offered?.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide">Services</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {application.services_offered.map((svc) => (
                            <span key={svc} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                              {SERVICE_OPTIONS.find((o) => o.value === svc)?.label ?? svc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <InfoRow label="Debriefing Experience" value={lookupLabel(EXPERIENCE_OPTIONS, String(application.cog_years_experience))} />
                    <InfoRow label="Education" value={lookupLabel(EDUCATION_OPTIONS, application.education_level)} />
                    <InfoRow label="Degree Field" value={application.cog_degree_field ?? '—'} />
                    {application.cog_credentials && <InfoRow label="Credentials" value={application.cog_credentials} />}
                    {application.cog_instrument_types?.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide">COA/PRO Instruments</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {application.cog_instrument_types.map((t) => (
                            <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              {COG_INSTRUMENT_OPTIONS.find((o) => o.value === t)?.label ?? t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {application.cog_therapy_areas?.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wide">Therapy Areas</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {application.cog_therapy_areas.map((t) => (
                            <span key={t} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                              {COG_THERAPY_OPTIONS.find((o) => o.value === t)?.label ?? t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <InfoRow label="ISPOR Guidelines" value={lookupLabel(FAMILIARITY_OPTIONS, application.cog_ispor_familiarity)} />
                    <InfoRow label="FDA COA Guidance" value={lookupLabel(FAMILIARITY_OPTIONS, application.cog_fda_familiarity)} />
                    <InfoRow label="Prior Debrief Reports" value={application.cog_prior_debrief_reports ? 'Yes' : 'No'} />
                    {application.cog_availability && (
                      <InfoRow label="Availability" value={lookupLabel(AVAILABILITY_OPTIONS, application.cog_availability)} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Rate & Referral */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Rate & Referral
              </h2>
              <div className="space-y-2 text-sm">
                {isTranslator ? (
                  <InfoRow label="Expected Rate" value={application.rate_expectation ? `$${application.rate_expectation}/page` : '—'} />
                ) : (
                  <InfoRow label="Expected Rate" value={application.cog_rate_expectation ? `$${application.cog_rate_expectation}` : '—'} />
                )}
                {application.final_agreed_rate && (
                  <InfoRow label="Agreed Rate" value={`$${application.final_agreed_rate}/page`} />
                )}
                <InfoRow label="Referral Source" value={application.referral_source ?? '—'} />
              </div>
            </div>

            {/* Work samples */}
            {application.work_samples?.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Work Samples
                </h2>
                <div className="space-y-2">
                  {application.work_samples.map((sample, i) => (
                    <div key={i} className="text-sm border border-gray-100 rounded p-2">
                      <p className="text-gray-700 text-xs">{sample.description || 'No description'}</p>
                      <p className="text-gray-400 text-xs mt-1 truncate">{sample.storage_path}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Applicant notes */}
            {application.notes && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Applicant Notes</h2>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{application.notes}</p>
              </div>
            )}
          </div>

          {/* CENTRE PANEL — Stage-specific content */}
          <div className="lg:col-span-5 space-y-4">
            {/* AI Pre-screening Results */}
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => setShowAiDetails(!showAiDetails)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> AI Pre-screening
                  {application.ai_prescreening_score !== null && (
                    <span className={`ml-2 text-lg font-bold ${
                      application.ai_prescreening_score >= 70 ? 'text-green-600' :
                      application.ai_prescreening_score >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {application.ai_prescreening_score}/100
                    </span>
                  )}
                </h2>
                {showAiDetails ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showAiDetails && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  {!aiResult ? (
                    <p className="text-sm text-gray-400">Pre-screening has not run yet.</p>
                  ) : isAiFallback(aiResult) ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">AI Fallback — Sent to Staff Review</p>
                          <p className="text-xs text-amber-600 mt-1">{aiResult.reason}</p>
                        </div>
                      </div>
                    </div>
                  ) : isTranslator && isTranslatorResult(aiResult) ? (
                    <div className="space-y-3">
                      {/* Score breakdown grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <ScoreBadge label="Recommendation" value={aiResult.recommendation} />
                        <ScoreBadge label="Demand Match" value={aiResult.demand_match} />
                        <ScoreBadge label="Certification" value={aiResult.certification_quality} />
                        <ScoreBadge label="Experience" value={aiResult.experience_consistency} />
                        <ScoreBadge label="Samples" value={aiResult.sample_quality} />
                        <ScoreBadge label="Rate" value={aiResult.rate_expectation_assessment} />
                      </div>

                      {/* Suggested test config */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 rounded p-2">
                          <span className="text-gray-500">Test Difficulty</span>
                          <p className="font-medium text-gray-700 mt-0.5 capitalize">{aiResult.suggested_test_difficulty}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <span className="text-gray-500">Suggested Tier</span>
                          <p className="font-medium text-gray-700 mt-0.5 capitalize">{aiResult.suggested_tier}</p>
                        </div>
                      </div>
                      {aiResult.suggested_test_types?.length > 0 && (
                        <div className="text-xs">
                          <span className="text-gray-500">Suggested Test Types: </span>
                          <span className="text-gray-700">{aiResult.suggested_test_types.join(', ')}</span>
                        </div>
                      )}

                      {/* Red flags */}
                      {aiResult.red_flags?.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Red Flags
                          </p>
                          <ul className="text-xs text-red-600 space-y-0.5">
                            {aiResult.red_flags.map((flag, i) => (
                              <li key={i}>&bull; {flag}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* AI notes */}
                      {aiResult.notes && (
                        <div className="text-xs text-gray-600 bg-gray-50 rounded p-3">
                          <span className="font-medium text-gray-700">AI Notes: </span>
                          {aiResult.notes}
                        </div>
                      )}

                      <p className="text-xs text-gray-400">Screened {formatDateTime(application.ai_prescreening_at)}</p>
                    </div>
                  ) : !isTranslator && !isAiFallback(aiResult) ? (
                    <div className="space-y-3">
                      {/* Cognitive debriefing criteria */}
                      {(() => {
                        const cogResult = aiResult as unknown as CogPrescreenResult
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <ScoreBadge label="COA/PRO Experience" value={cogResult.coa_instrument_experience} />
                              <ScoreBadge label="Guideline Familiarity" value={cogResult.guideline_familiarity} />
                              <ScoreBadge label="Interviewing Skills" value={cogResult.interviewing_skills} />
                              <ScoreBadge label="Language Fluency" value={cogResult.language_fluency} />
                              <ScoreBadge label="Report Writing" value={cogResult.report_writing_experience} />
                              <ScoreBadge label="Recommendation" value={cogResult.recommendation} />
                            </div>

                            {cogResult.red_flags?.length > 0 && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Red Flags
                                </p>
                                <ul className="text-xs text-red-600 space-y-0.5">
                                  {cogResult.red_flags.map((flag, i) => (
                                    <li key={i}>&bull; {flag}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {cogResult.notes && (
                              <div className="text-xs text-gray-600 bg-gray-50 rounded p-3">
                                <span className="font-medium text-gray-700">AI Notes: </span>
                                {cogResult.notes}
                              </div>
                            )}

                            <p className="text-xs text-gray-400">Screened {formatDateTime(application.ai_prescreening_at)}</p>
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No pre-screening results available.</p>
                  )}
                </div>
              )}
            </div>

            {/* Test Combinations */}
            {combinations.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200">
                <button
                  onClick={() => setShowCombinations(!showCombinations)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Test Combinations
                    <span className="text-xs font-normal text-gray-400">({combinations.length})</span>
                  </h2>
                  {showCombinations ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {showCombinations && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    {combinations.map((combo) => {
                      const submission = submissions.find((s) => s.combination_id === combo.id)
                      return (
                        <div key={combo.id} className="border border-gray-100 rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {combo.source_language_name} &rarr; {combo.target_language_name}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {DOMAIN_OPTIONS.find((d) => d.value === combo.domain)?.label ?? combo.domain}
                                {' · '}
                                {SERVICE_OPTIONS.find((s) => s.value === combo.service_type)?.label ?? combo.service_type}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${COMBO_STATUS_COLORS[combo.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {COMBO_STATUS_LABELS[combo.status] ?? combo.status}
                            </span>
                          </div>

                          {/* Test score if assessed */}
                          {combo.ai_score !== null && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-gray-500">Test Score:</span>
                              <span className={`text-sm font-bold ${
                                combo.ai_score >= 80 ? 'text-green-600' :
                                combo.ai_score >= 65 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {combo.ai_score}/100
                              </span>
                            </div>
                          )}

                          {/* Approved rate */}
                          {combo.approved_at && (
                            <div className="mt-2 flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              <span className="text-xs text-green-700">
                                Approved {formatDate(combo.approved_at)}
                                {combo.approved_rate && ` at $${combo.approved_rate}/page`}
                              </span>
                            </div>
                          )}

                          {/* Test submission info */}
                          {submission && (
                            <div className="mt-2 pt-2 border-t border-gray-50 text-xs text-gray-500">
                              <div className="flex items-center gap-3">
                                <span>Token: {submission.status}</span>
                                {submission.status === 'sent' || submission.status === 'viewed' || submission.status === 'draft_saved' ? (
                                  <span className={`${
                                    hoursUntil(submission.token_expires_at) > 12 ? 'text-gray-500' :
                                    hoursUntil(submission.token_expires_at) > 0 ? 'text-orange-600' : 'text-red-600'
                                  }`}>
                                    <Clock className="w-3 h-3 inline mr-0.5" />
                                    {hoursUntil(submission.token_expires_at) > 0
                                      ? `${hoursUntil(submission.token_expires_at)}h remaining`
                                      : 'Expired'}
                                  </span>
                                ) : null}
                                {submission.view_count > 0 && <span>Viewed {submission.view_count}x</span>}
                              </div>
                              {submission.submitted_at && (
                                <p className="mt-1">Submitted {formatDateTime(submission.submitted_at)}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Negotiation History */}
            {application.negotiation_log?.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Negotiation History
                </h2>
                <div className="space-y-2">
                  {application.negotiation_log.map((event, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-gray-700">
                          <span className="font-medium capitalize">{event.event.replace(/_/g, ' ')}</span>
                          {event.amount && <span className="text-gray-500"> — ${event.amount}</span>}
                          {event.final_amount && <span className="text-green-600 font-medium"> — Final: ${event.final_amount}</span>}
                        </p>
                        <p className="text-xs text-gray-400">{formatDateTime(event.timestamp)}</p>
                        {event.notes && <p className="text-xs text-gray-500 mt-0.5">{event.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reapplication info */}
            {application.can_reapply_after && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                <Clock className="w-3 h-3 inline mr-1" />
                Reapplication cooldown until {formatDate(application.can_reapply_after)}
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Actions */}
          <div className="lg:col-span-4 space-y-4">
            {/* Staff Notes */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Staff Notes</h2>
              <textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                placeholder="Add internal notes about this application..."
              />
              <div className="flex items-center justify-between mt-2">
                {application.staff_reviewed_at && (
                  <span className="text-xs text-gray-400">Last reviewed {formatDateTime(application.staff_reviewed_at)}</span>
                )}
                <button
                  onClick={saveStaffNotes}
                  disabled={savingNotes}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save Notes
                </button>
              </div>
            </div>

            {/* Tier Override */}
            {isTranslator && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4" /> Tier Assignment
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={tierOverride}
                    onChange={(e) => setTierOverride(e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Not set —</option>
                    <option value="standard">Standard</option>
                    <option value="senior">Senior</option>
                    <option value="expert">Expert</option>
                  </select>
                  <button
                    onClick={saveTierOverride}
                    disabled={savingTier || !tierOverride}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 disabled:opacity-50"
                  >
                    {savingTier ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Update
                  </button>
                </div>
                {application.tier_override_at && (
                  <p className="text-xs text-gray-400 mt-2">Overridden {formatDateTime(application.tier_override_at)}</p>
                )}
              </div>
            )}

            {/* Decision Buttons */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Decision</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateApplicationStatus('approved')}
                  disabled={actionLoading !== null || application.status === 'approved'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading === 'approved' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve
                </button>
                <button
                  onClick={() => updateApplicationStatus('rejected', {
                    rejection_reason: 'Staff decision',
                    rejection_email_status: 'queued',
                    rejection_email_queued_at: new Date().toISOString(),
                    can_reapply_after: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  })}
                  disabled={actionLoading !== null || application.status === 'rejected'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading === 'rejected' ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Reject
                </button>
                <button
                  onClick={() => updateApplicationStatus('waitlisted')}
                  disabled={actionLoading !== null || application.status === 'waitlisted'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-cyan-50 text-cyan-700 rounded-md hover:bg-cyan-100 border border-cyan-200 disabled:opacity-50"
                >
                  {actionLoading === 'waitlisted' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                  Waitlist
                </button>
                <button
                  onClick={() => updateApplicationStatus('info_requested')}
                  disabled={actionLoading !== null || application.status === 'info_requested'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 border border-yellow-200 disabled:opacity-50"
                >
                  {actionLoading === 'info_requested' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Request Info
                </button>
              </div>
            </div>

            {/* Rejection Email Editor — only show when rejection is queued */}
            {(application.rejection_email_status === 'queued' || application.rejection_email_status === 'intercepted') && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Rejection Email
                  {rejectionWindowOpen && (
                    <span className="text-xs font-normal text-orange-600">
                      {hoursUntil(new Date(new Date(application.rejection_email_queued_at!).getTime() + 48 * 60 * 60 * 1000).toISOString())}h left to intercept
                    </span>
                  )}
                </h2>

                {application.rejection_email_status === 'intercepted' && (
                  <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-700 mb-3">
                    Email has been intercepted and will not be sent automatically.
                  </div>
                )}

                <textarea
                  value={rejectionDraft}
                  onChange={(e) => setRejectionDraft(e.target.value)}
                  rows={6}
                  className="w-full text-sm border border-gray-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                  placeholder="AI-drafted rejection email content..."
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={saveRejectionDraft}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    <Save className="w-3 h-3" /> Save Draft
                  </button>
                  {rejectionWindowOpen && application.rejection_email_status === 'queued' && (
                    <button
                      onClick={interceptRejection}
                      disabled={actionLoading === 'intercept'}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 disabled:opacity-50"
                    >
                      {actionLoading === 'intercept' ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                      Intercept
                    </button>
                  )}
                </div>
                {application.rejection_reason && (
                  <p className="text-xs text-gray-400 mt-2">Reason: {application.rejection_reason}</p>
                )}
              </div>
            )}

            {/* Waitlist details */}
            {application.status === 'waitlisted' && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Waitlist Details</h2>
                {application.waitlist_language_pair && (
                  <p className="text-sm text-gray-600 mb-2">{application.waitlist_language_pair}</p>
                )}
                {application.waitlist_notes && (
                  <p className="text-sm text-gray-500">{application.waitlist_notes}</p>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Timeline</h2>
              <div className="space-y-2 text-xs">
                <TimelineItem label="Applied" date={application.created_at} />
                {application.ai_prescreening_at && (
                  <TimelineItem
                    label={`AI Pre-screened (${application.ai_prescreening_score ?? '?'}/100)`}
                    date={application.ai_prescreening_at}
                  />
                )}
                {application.staff_reviewed_at && (
                  <TimelineItem label="Staff Reviewed" date={application.staff_reviewed_at} />
                )}
                {application.rejection_email_queued_at && (
                  <TimelineItem label="Rejection Queued" date={application.rejection_email_queued_at} />
                )}
                {application.tier_override_at && (
                  <TimelineItem label="Tier Overridden" date={application.tier_override_at} />
                )}
                <TimelineItem label="Last Updated" date={application.updated_at} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500 text-xs uppercase tracking-wide">{label}</span>
      <p className="text-gray-700 mt-0.5">{value}</p>
    </div>
  )
}

function ScoreBadge({ label, value }: { label: string; value: string }) {
  const colorClass = STRENGTH_COLORS[value] ?? 'text-gray-600 bg-gray-50'
  return (
    <div className={`rounded p-2 ${colorClass}`}>
      <span className="text-xs opacity-75 block">{label}</span>
      <span className="text-xs font-semibold capitalize">{value.replace(/_/g, ' ')}</span>
    </div>
  )
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-400 ml-auto">{formatDateTime(date)}</span>
    </div>
  )
}
