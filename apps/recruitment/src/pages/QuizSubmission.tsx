import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { NdaGate, type NdaTemplate } from '../components/NdaGate'
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface QuizQuestion {
  id: string
  competence: string
  difficulty: string
  question: string
  options: { label: string; value: string }[]
}

interface TranslationItem {
  id: string
  source_text: string
  construct: string
  difficulty: string | null
  flawed_draft: string | null
  target_language_code: string | null
}

interface QuizData {
  submissionId: string
  token: string
  applicantName: string
  applicationNumber: string
  targetLanguageName: string
  expiresAt: string
  remainingHours: number
  remainingMinutes: number
  status: string
  isCoa?: boolean
  isCogDebrief?: boolean
  questions: QuizQuestion[]
  translationItems?: TranslationItem[]
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; error: string; errorType?: string }
  | { kind: 'nda_required'; nda: NdaTemplate | null; applicantName: string; applicantEmail: string | null }
  | { kind: 'loaded'; data: QuizData }
  | { kind: 'submitted' }

const COMPETENCE_LABELS: Record<string, string> = {
  linguistic_textual_competence: 'Linguistic & Textual',
  cultural_competence: 'Cultural',
  domain_competence: 'Domain',
  research_competence: 'Research',
  technical_competence: 'Technical',
  coa_methodology: 'COA Methodology',
}

async function callEdgeFunction(
  name: string,
  body: Record<string, unknown>,
): Promise<{
  success: boolean
  data?: Record<string, unknown>
  error?: string
  message?: string
}> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  return response.json()
}

function formatTimeRemaining(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return 'Expired'
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h remaining`
  }
  return hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`
}

export function QuizSubmission() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [translationAnswers, setTranslationAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeDisplay, setTimeDisplay] = useState('')

  // Load quiz (re-callable after the NDA is accepted).
  const loadQuiz = useCallback(() => {
    if (!token) {
      setPageState({ kind: 'error', error: 'No quiz token provided.' })
      return
    }
    setPageState({ kind: 'loading' })
    callEdgeFunction('cvp-get-quiz', { token })
      .then((result) => {
        const data = result.data as Record<string, unknown> | undefined
        if (result.success && data?.nda_required) {
          setPageState({
            kind: 'nda_required',
            nda: (data.nda as NdaTemplate | null) ?? null,
            applicantName: (data.applicantName as string) ?? '',
            applicantEmail: (data.applicantEmail as string | null) ?? null,
          })
        } else if (result.success && data) {
          setPageState({ kind: 'loaded', data: data as unknown as QuizData })
        } else {
          setPageState({
            kind: 'error',
            error: result.message ?? result.error ?? 'Failed to load quiz.',
            errorType: result.error,
          })
        }
      })
      .catch(() =>
        setPageState({
          kind: 'error',
          error: 'Could not connect to the server. Please try again.',
        }),
      )
  }, [token])

  useEffect(() => {
    loadQuiz()
  }, [loadQuiz])

  // Timer
  useEffect(() => {
    if (pageState.kind !== 'loaded') return
    const update = () => setTimeDisplay(formatTimeRemaining(pageState.data.expiresAt))
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [pageState])

  // Group questions by competence for rendering
  const groupedQuestions = useMemo(() => {
    if (pageState.kind !== 'loaded') return [] as { competence: string; questions: QuizQuestion[] }[]
    const groups = new Map<string, QuizQuestion[]>()
    for (const q of pageState.data.questions) {
      if (!groups.has(q.competence)) groups.set(q.competence, [])
      groups.get(q.competence)!.push(q)
    }
    return Array.from(groups.entries()).map(([competence, questions]) => ({
      competence,
      questions,
    }))
  }, [pageState])

  const totalCount = pageState.kind === 'loaded' ? pageState.data.questions.length : 0
  const answeredCount = Object.keys(answers).length

  const handleSubmit = async () => {
    if (!token) return
    setIsSubmitting(true)
    setShowConfirmDialog(false)
    try {
      const responses = Object.entries(answers).map(([question_id, selected_option]) => ({
        question_id,
        selected_option,
      }))
      const translations = Object.entries(translationAnswers)
        .filter(([, v]) => v.trim().length > 0)
        .map(([item_id, translation]) => ({ item_id, translation }))
      const result = await callEdgeFunction('cvp-submit-quiz', {
        token,
        responses,
        translations,
      })
      if (result.success) {
        setPageState({ kind: 'submitted' })
      } else {
        alert(result.message ?? result.error ?? 'Submission failed. Please try again.')
      }
    } catch {
      alert('Could not connect to the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---- LOADING ----
  if (pageState.kind === 'loading') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-500">Loading your quiz...</p>
        </div>
      </Layout>
    )
  }

  // ---- NDA GATE ----
  if (pageState.kind === 'nda_required') {
    return (
      <NdaGate
        token={token ?? ''}
        kind="quiz"
        nda={pageState.nda}
        applicantName={pageState.applicantName}
        applicantEmail={pageState.applicantEmail}
        onSigned={loadQuiz}
      />
    )
  }

  // ---- ERROR ----
  if (pageState.kind === 'error') {
    const isExpired = pageState.errorType === 'token_expired'
    const isAlreadySubmitted = pageState.errorType === 'already_submitted'
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-12 space-y-6">
          <div className="flex justify-center">
            {isExpired ? (
              <Clock className="w-16 h-16 text-amber-500" />
            ) : isAlreadySubmitted ? (
              <CheckCircle className="w-16 h-16 text-green-500" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-cethos-navy">
            {isExpired
              ? 'Quiz Link Expired'
              : isAlreadySubmitted
                ? 'Already Submitted'
                : 'Unable to Load Quiz'}
          </h1>
          <p className="text-gray-600">{pageState.error}</p>
          {isExpired && (
            <p className="text-sm text-gray-500">
              If you need a new quiz link, please reply to your invitation
              email or contact us at recruitment@cethos.com.
            </p>
          )}
        </div>
      </Layout>
    )
  }

  // ---- SUBMITTED ----
  if (pageState.kind === 'submitted') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-12 space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-cethos-navy">Quiz Submitted</h1>
          <p className="text-gray-600">
            Your quiz has been submitted. Our team will review it and follow up
            by email within 1–2 business days with the next step.
          </p>
          <div className="bg-cethos-bg-blue rounded-lg border border-cethos-teal p-4 text-sm text-cethos-teal">
            You'll receive a confirmation email shortly.
          </div>
        </div>
      </Layout>
    )
  }

  // ---- LOADED ----
  const { data } = pageState
  const isExpiringSoon =
    new Date(data.expiresAt).getTime() - Date.now() < 2 * 60 * 60 * 1000
  const tItems = data.translationItems ?? []
  const tAnswered = tItems.filter((t) => (translationAnswers[t.id] ?? '').trim().length > 0).length
  const combinedTotal = totalCount + tItems.length
  const combinedAnswered = answeredCount + tAnswered
  const allAnswered = combinedAnswered === combinedTotal

  // Flatten into one ordered list of cards: MCQs (grouped by competence) then
  // the Part-2 translation items. One card shown at a time.
  type FlatItem =
    | { kind: 'mcq'; q: QuizQuestion; competence: string; number: number }
    | { kind: 'translation'; t: TranslationItem; number: number }
  const flatItems: FlatItem[] = []
  let qn = 1
  for (const g of groupedQuestions)
    for (const q of g.questions) flatItems.push({ kind: 'mcq', q, competence: g.competence, number: qn++ })
  tItems.forEach((t, i) => flatItems.push({ kind: 'translation', t, number: i + 1 }))
  const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, flatItems.length - 1))
  const current = flatItems[safeIndex]
  const isLast = safeIndex >= flatItems.length - 1
  const isCurrentAnswered = current
    ? current.kind === 'mcq'
      ? !!answers[current.q.id]
      : (translationAnswers[current.t.id] ?? '').trim().length > 0
    : false
  const firstUnansweredIndex = flatItems.findIndex((it) =>
    it.kind === 'mcq' ? !answers[it.q.id] : !(translationAnswers[it.t.id] ?? '').trim())

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-cethos-navy">
                {data.isCoa
                  ? 'COA Linguistic Validation Assessment'
                  : data.isCogDebrief
                    ? 'Cognitive Debriefing Assessment'
                    : 'Translation Competence Assessment'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {data.applicationNumber} &middot; Target: {data.targetLanguageName} &middot; {totalCount} questions
              </p>
              {data.applicantName && (
                <p className="text-sm text-gray-400 mt-0.5">Applicant: {data.applicantName}</p>
              )}
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                isExpiringSoon
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-gray-50 text-cethos-navy border border-gray-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              {timeDisplay}
            </div>
          </div>
        </div>

        {/* Progress + position */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2 gap-3">
            <span className="text-sm font-semibold text-cethos-navy">
              {current?.kind === 'translation'
                ? `Translation ${current.number} of ${tItems.length}`
                : `Question ${current?.number ?? 1} of ${totalCount}`}
              <span className="text-gray-400 font-normal"> &middot; item {safeIndex + 1} of {flatItems.length}</span>
            </span>
            <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
              {combinedAnswered} / {combinedTotal} answered
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-cethos-teal transition-all"
              style={{ width: `${(combinedAnswered / combinedTotal) * 100}%` }}
            />
          </div>
        </div>

        {/* Expiring warning */}
        {isExpiringSoon && (
          <div className="bg-red-50 rounded-lg border border-red-200 p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Your quiz link is expiring soon. Please finish and submit before the deadline.
            </p>
          </div>
        )}

        {/* Current item card */}
        {current && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5 min-h-[300px]">
            {current.kind === 'mcq' ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-cethos-teal uppercase tracking-wide">
                    {COMPETENCE_LABELS[current.competence] ?? current.competence}
                  </span>
                  {isCurrentAnswered && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-base text-gray-900 leading-relaxed font-medium">{current.q.question}</p>
                <div className="space-y-2">
                  {current.q.options.map((o) => {
                    const isSelected = answers[current.q.id] === o.value
                    return (
                      <label
                        key={o.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? 'border-cethos-teal bg-cethos-bg-blue' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${current.q.id}`}
                          value={o.value}
                          checked={isSelected}
                          onChange={() => setAnswers((prev) => ({ ...prev, [current.q.id]: o.value }))}
                          className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                        />
                        <span className="text-sm text-gray-800 leading-relaxed">
                          <span className="font-semibold text-cethos-navy mr-2 uppercase">{o.value}.</span>
                          {o.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-cethos-teal uppercase tracking-wide">
                    Translation into {data.targetLanguageName}
                  </span>
                  {isCurrentAnswered && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
                <p className="text-base text-gray-900 leading-relaxed font-medium">
                  {current.t.construct === 'error_correction' ? 'Correct the draft translation of: ' : ''}
                  {current.t.source_text}
                </p>
                {current.t.construct === 'error_correction' && current.t.flawed_draft && (
                  <div className="text-sm bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
                    <span className="font-medium">Draft to correct:</span> {current.t.flawed_draft}
                  </div>
                )}
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-cethos-teal focus:border-cethos-teal"
                  rows={4}
                  placeholder={`Your ${data.targetLanguageName} translation...`}
                  value={translationAnswers[current.t.id] ?? ''}
                  onChange={(e) => setTranslationAnswers((prev) => ({ ...prev, [current.t.id]: e.target.value }))}
                />
                <p className="text-xs text-gray-400">
                  Aim for natural, patient-appropriate wording that preserves the meaning — not word-for-word.
                </p>
              </>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pb-12">
          <button
            type="button"
            onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
            disabled={safeIndex === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-cethos-navy bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <div className="flex items-center gap-3">
            {/* Jump to the first gap — available from any card, not just the last */}
            {!allAnswered && firstUnansweredIndex >= 0 && (
              <button
                type="button"
                onClick={() => setCurrentIndex(firstUnansweredIndex)}
                className="text-xs text-amber-700 underline whitespace-nowrap"
              >
                {combinedTotal - combinedAnswered} unanswered — go to it
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                onClick={() => setCurrentIndex(Math.min(flatItems.length - 1, safeIndex + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-cethos-teal rounded-lg hover:bg-cethos-teal-light"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {/* Submit appears as soon as everything's answered (or on the last card) */}
            {(allAnswered || isLast) && (
              <button
                type="button"
                onClick={() => setShowConfirmDialog(true)}
                disabled={isSubmitting || !allAnswered}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-cethos-teal rounded-lg hover:bg-cethos-teal-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Quiz
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-cethos-navy">Confirm Submission</h3>
            <p className="text-sm text-gray-600">
              You've answered {combinedAnswered} of {combinedTotal} items. Once
              submitted, you cannot change your answers or retake this quiz.
              Ready to submit?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-sm font-medium text-cethos-navy bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-cethos-teal rounded-lg hover:bg-cethos-teal-light disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
