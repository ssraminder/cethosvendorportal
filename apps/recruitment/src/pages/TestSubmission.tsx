import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import {
  Clock,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Save,
  Loader2,
  Send,
} from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface TestData {
  submissionId: string
  token: string
  serviceType: 'translation' | 'translation_review' | 'lqa_review'
  domain: string
  difficulty: string
  sourceLanguage: string
  targetLanguage: string
  sourceText: string | null
  sourceFilePath: string | null
  instructions: string | null
  applicantName: string
  expiresAt: string
  remainingHours: number
  remainingMinutes: number
  draftContent: string | null
  draftLastSavedAt: string | null
  lqaSourceTranslation?: string | null
  mqmDimensionsEnabled?: string[]
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; error: string; errorType?: string }
  | { kind: 'loaded'; data: TestData }
  | { kind: 'submitted' }

const SERVICE_TYPE_LABELS: Record<string, string> = {
  translation: 'Translation Test',
  translation_review: 'Translation + Review Test',
  lqa_review: 'LQA Review Test (MQM Core)',
}

const MQM_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  accuracy: 'Target text does not accurately represent the source text',
  fluency: 'Target text has issues with grammar, spelling, or readability',
  terminology: 'Incorrect, inconsistent, or inappropriate terminology',
  style: 'Text does not follow style guidelines or expected register',
  locale_conventions: 'Issues with date/number/currency formatting or locale-specific conventions',
  design: 'Layout, formatting, or tag-related issues',
  non_translation: 'Content that should have been left untranslated or was not translated',
}

async function callEdgeFunction(
  name: string,
  body: Record<string, unknown>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string; message?: string }> {
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
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs <= 0) return 'Expired'

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`
  }
  return `${minutes}m remaining`
}

export function TestSubmission() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [content, setContent] = useState('')
  const [notes, setNotes] = useState('')
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [timeDisplay, setTimeDisplay] = useState('')
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const contentRef = useRef(content)
  contentRef.current = content

  // Load test data on mount
  useEffect(() => {
    if (!token) {
      setPageState({ kind: 'error', error: 'No test token provided.' })
      return
    }

    callEdgeFunction('cvp-get-test', { token }).then((result) => {
      if (result.success && result.data) {
        const data = result.data as unknown as TestData
        setPageState({ kind: 'loaded', data })
        if (data.draftContent) {
          setContent(data.draftContent)
        }
        if (data.draftLastSavedAt) {
          setLastSaved(data.draftLastSavedAt)
        }
      } else {
        setPageState({
          kind: 'error',
          error: result.message ?? result.error ?? 'Failed to load test.',
          errorType: result.error,
        })
      }
    }).catch(() => {
      setPageState({
        kind: 'error',
        error: 'Could not connect to the server. Please try again.',
      })
    })
  }, [token])

  // Update timer display every minute
  useEffect(() => {
    if (pageState.kind !== 'loaded') return

    const update = () => {
      setTimeDisplay(formatTimeRemaining(pageState.data.expiresAt))
    }
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [pageState])

  // Auto-save draft every 60 seconds
  const saveDraft = useCallback(async () => {
    if (!token || !contentRef.current.trim()) return

    setIsSaving(true)
    try {
      const result = await callEdgeFunction('cvp-save-test-draft', {
        token,
        draftContent: contentRef.current,
      })
      if (result.success && result.data) {
        setLastSaved(result.data.savedAt as string)
      }
    } catch {
      // Silent fail for auto-save
    } finally {
      setIsSaving(false)
    }
  }, [token])

  useEffect(() => {
    if (pageState.kind !== 'loaded') return

    autoSaveRef.current = setInterval(saveDraft, 60_000)
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [pageState.kind, saveDraft])

  // Submit handler
  const handleSubmit = async () => {
    if (!token || !content.trim()) return

    setIsSubmitting(true)
    setShowConfirmDialog(false)

    try {
      const result = await callEdgeFunction('cvp-submit-test', {
        token,
        submittedContent: content,
        submittedNotes: notes || undefined,
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

  // --- LOADING ---
  if (pageState.kind === 'loading') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-500">Loading your test...</p>
        </div>
      </Layout>
    )
  }

  // --- ERROR ---
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
          <h1 className="text-2xl font-bold text-gray-900">
            {isExpired
              ? 'Test Link Expired'
              : isAlreadySubmitted
                ? 'Already Submitted'
                : 'Unable to Load Test'}
          </h1>
          <p className="text-gray-600">{pageState.error}</p>
          {isExpired && (
            <p className="text-sm text-gray-500">
              If you need a new test link, please reply to your test invitation email
              or contact us at recruitment@cethos.com.
            </p>
          )}
        </div>
      </Layout>
    )
  }

  // --- SUBMITTED ---
  if (pageState.kind === 'submitted') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-12 space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Test Submitted</h1>
          <p className="text-gray-600">
            Your test has been submitted successfully. We will assess it and get back to you
            by email within 1–2 business days.
          </p>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-sm text-blue-800">
            You'll receive a confirmation email shortly. Check your spam folder if you don't see it.
          </div>
        </div>
      </Layout>
    )
  }

  // --- LOADED — Main test page ---
  const { data } = pageState
  const isExpiringSoon =
    new Date(data.expiresAt).getTime() - Date.now() < 2 * 60 * 60 * 1000 // < 2 hours

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {SERVICE_TYPE_LABELS[data.serviceType] ?? 'Test'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {data.sourceLanguage} → {data.targetLanguage} &middot;{' '}
                <span className="capitalize">{data.domain}</span>
              </p>
              {data.applicantName && (
                <p className="text-sm text-gray-400 mt-0.5">
                  Applicant: {data.applicantName}
                </p>
              )}
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                isExpiringSoon
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-gray-50 text-gray-700 border border-gray-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              {timeDisplay}
            </div>
          </div>
        </div>

        {/* Instructions */}
        {data.instructions && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Instructions</h3>
            <div className="text-sm text-blue-800 whitespace-pre-wrap">{data.instructions}</div>
          </div>
        )}

        {/* Source Text */}
        {data.sourceText && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                {data.serviceType === 'lqa_review' ? 'Source Text' : 'Source Text — Translate This'}
              </h2>
            </div>
            <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap border-t border-gray-100 pt-4">
              {data.sourceText}
            </div>
          </div>
        )}

        {/* LQA: Flawed translation to review */}
        {data.serviceType === 'lqa_review' && data.lqaSourceTranslation && (
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                Translation to Review
              </h2>
            </div>
            <p className="text-xs text-amber-600 mb-3">
              Review this translation for errors. Identify each error with its MQM category,
              severity (Minor/Major/Critical), location, and a brief explanation.
            </p>
            <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap border-t border-amber-100 pt-4">
              {data.lqaSourceTranslation}
            </div>
          </div>
        )}

        {/* LQA: MQM Categories guide */}
        {data.serviceType === 'lqa_review' && data.mqmDimensionsEnabled && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">MQM Error Categories</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.mqmDimensionsEnabled.map((dim) => (
                <div key={dim} className="text-xs">
                  <span className="font-medium text-gray-700 capitalize">
                    {dim.replace(/_/g, ' ')}
                  </span>
                  {MQM_CATEGORY_DESCRIPTIONS[dim] && (
                    <span className="text-gray-500 ml-1">
                      — {MQM_CATEGORY_DESCRIPTIONS[dim]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              <span className="font-medium">Severity levels:</span> Minor (stylistic, negligible impact)
              &middot; Major (affects understanding or usability) &middot; Critical (completely wrong or misleading)
            </div>
          </div>
        )}

        {/* Source file download (if applicable) */}
        {data.sourceFilePath && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Source document available for download</p>
                <a
                  href={`${SUPABASE_URL}/storage/v1/object/public/quote-files/${data.sourceFilePath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Download source file
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Submission area */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {data.serviceType === 'lqa_review'
                ? 'Your Review'
                : 'Your Translation'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {isSaving && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </>
              )}
              {!isSaving && lastSaved && (
                <>
                  <Save className="w-3 h-3" />
                  <span>
                    Last saved:{' '}
                    {new Date(lastSaved).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              data.serviceType === 'lqa_review'
                ? 'List each error you found with its MQM category, severity, location, and explanation...'
                : 'Enter your translation here...'
            }
            rows={16}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
          <p className="text-xs text-gray-400 mt-1">
            Your work is auto-saved every 60 seconds.
          </p>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Notes (Optional)
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about your submission (e.g. assumptions made, ambiguous terms, etc.)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
        </div>

        {/* Submit button */}
        <div className="flex items-center justify-between">
          <button
            onClick={saveDraft}
            disabled={isSaving || !content.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>

          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={isSubmitting || !content.trim()}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Test
              </>
            )}
          </button>
        </div>

        {/* Warning for expiring soon */}
        {isExpiringSoon && (
          <div className="bg-red-50 rounded-lg border border-red-200 p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              Your test link is expiring soon. Please submit your work before the deadline.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Confirm Submission</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to submit your test? This action cannot be undone —
              you will not be able to edit or resubmit after this.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
