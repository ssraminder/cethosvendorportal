import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  AlertTriangle,
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
  questions: QuizQuestion[]
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; error: string; errorType?: string }
  | { kind: 'loaded'; data: QuizData }
  | { kind: 'submitted' }

const COMPETENCE_LABELS: Record<string, string> = {
  linguistic_textual_competence: 'Linguistic & Textual',
  cultural_competence: 'Cultural',
  domain_competence: 'Domain',
  research_competence: 'Research',
  technical_competence: 'Technical',
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [timeDisplay, setTimeDisplay] = useState('')

  // Load quiz on mount
  useEffect(() => {
    if (!token) {
      setPageState({ kind: 'error', error: 'No quiz token provided.' })
      return
    }
    callEdgeFunction('cvp-get-quiz', { token })
      .then((result) => {
        if (result.success && result.data) {
          setPageState({ kind: 'loaded', data: result.data as unknown as QuizData })
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
      const result = await callEdgeFunction('cvp-submit-quiz', {
        token,
        responses,
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
            Your quiz has been submitted and graded. We will follow up by
            email within 1–2 business days with the next step.
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
  const allAnswered = answeredCount === totalCount

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-cethos-navy">
                ISO Competence Quiz
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

        {/* Progress */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-cethos-teal transition-all"
              style={{ width: `${(answeredCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 font-medium">
            {answeredCount} / {totalCount}
          </span>
        </div>

        {/* Instructions */}
        <div className="bg-cethos-bg-blue rounded-lg border border-cethos-teal p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Instructions</h3>
          <ul className="text-sm text-cethos-teal space-y-1 list-disc pl-5">
            <li>Pick one answer per question. Each question has exactly one correct answer.</li>
            <li>Your answers are not saved until you submit. Complete the full quiz in one sitting.</li>
            <li>Grading is automatic and immediate. We'll email you the next step within 1–2 business days.</li>
          </ul>
        </div>

        {/* Question blocks grouped by competence */}
        {groupedQuestions.map((group) => {
          let questionNum = 1
          // Compute the starting question number for this group across the whole quiz
          for (const earlier of groupedQuestions) {
            if (earlier.competence === group.competence) break
            questionNum += earlier.questions.length
          }
          return (
            <div
              key={group.competence}
              className="bg-white rounded-lg border border-gray-200 p-6 space-y-5"
            >
              <h2 className="text-sm font-semibold text-cethos-navy uppercase tracking-wide border-b border-gray-100 pb-2">
                {COMPETENCE_LABELS[group.competence] ?? group.competence}
              </h2>
              {group.questions.map((q, idx) => {
                const num = questionNum + idx
                const selected = answers[q.id]
                return (
                  <div key={q.id} className="space-y-3">
                    <div className="flex items-baseline gap-3">
                      <span className="text-xs font-semibold text-gray-400 mt-1">
                        Q{num}
                      </span>
                      <p className="text-sm text-gray-900 leading-relaxed">
                        {q.question}
                      </p>
                    </div>
                    <div className="space-y-2 pl-7">
                      {q.options.map((o) => {
                        const isSelected = selected === o.value
                        return (
                          <label
                            key={o.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-cethos-teal bg-cethos-bg-blue'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              value={o.value}
                              checked={isSelected}
                              onChange={() =>
                                setAnswers((prev) => ({ ...prev, [q.id]: o.value }))
                              }
                              className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
                            />
                            <span className="text-sm text-gray-800 leading-relaxed">
                              <span className="font-semibold text-cethos-navy mr-2 uppercase">
                                {o.value}.
                              </span>
                              {o.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Warning when expiring */}
        {isExpiringSoon && (
          <div className="bg-red-50 rounded-lg border border-red-200 p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Your quiz link is expiring soon. Please finish and submit before
              the deadline.
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-12">
          <div className="text-sm text-gray-600">
            {allAnswered ? (
              <span className="text-green-700 font-medium">
                All {totalCount} questions answered.
              </span>
            ) : (
              <span>
                {totalCount - answeredCount} question{totalCount - answeredCount === 1 ? '' : 's'} remaining.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            disabled={isSubmitting || !allAnswered}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-cethos-teal rounded-lg hover:bg-cethos-teal-light disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-cethos-navy">Confirm Submission</h3>
            <p className="text-sm text-gray-600">
              You've answered {answeredCount} of {totalCount} questions. Once
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
