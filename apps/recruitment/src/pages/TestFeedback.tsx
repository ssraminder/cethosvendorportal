import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Loader2, CheckCircle, AlertTriangle, XCircle, Send } from 'lucide-react'
import { isRtlCode } from '../lib/rtl'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface ErrorRow {
  index: number
  category: string | null
  severity: string | null
  location: string | null
  source_segment: string | null
  applicant_translation: string | null
  revised_translation: string | null
  comment: string | null
}

interface ContextData {
  applicantFirstName: string
  applicationNumber: string
  pair: string
  sourceLanguageCode?: string | null
  targetLanguageCode?: string | null
  sourceLanguageRtl?: boolean
  targetLanguageRtl?: boolean
  domain: string | null
  overallScore: number | null
  feedbackDraft: string | null
  strengths: string[]
  expiresAt: string
  expired: boolean
  alreadySubmitted: boolean
  errors: ErrorRow[]
  existingResponses: Array<{ errorIndex: number; response: 'accept' | 'reject'; reason: string | null }>
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; error: string }
  | { kind: 'loaded'; data: ContextData }
  | { kind: 'submitted'; recorded: number }

interface ResponseDraft {
  response: 'accept' | 'reject' | null
  reason: string
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

function formatExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const hours = Math.round(ms / (1000 * 60 * 60))
  if (hours >= 24) return `${Math.round(hours / 24)} days remaining`
  return `${hours}h remaining`
}

const SEVERITY_STYLE: Record<string, { wrap: string; chip: string; label: string }> = {
  critical: {
    wrap: 'border-red-300 bg-red-50',
    chip: 'bg-red-600 text-white',
    label: 'CRITICAL',
  },
  major: {
    wrap: 'border-orange-300 bg-orange-50',
    chip: 'bg-orange-500 text-white',
    label: 'MAJOR',
  },
  minor: {
    wrap: 'border-yellow-200 bg-yellow-50',
    chip: 'bg-yellow-400 text-yellow-900',
    label: 'MINOR',
  },
}

function severityStyle(s: string | null) {
  return SEVERITY_STYLE[(s ?? '').toLowerCase()] ?? {
    wrap: 'border-gray-200 bg-gray-50',
    chip: 'bg-gray-200 text-gray-700',
    label: (s ?? 'INFO').toUpperCase(),
  }
}

// Render revised_translation with <ins>/<del> markers as styled spans.
// AI is asked to wrap inserts and deletes; if it didn't, we show plain text.
function RevisedSpan({ text }: { text: string }) {
  // Split on the markers while keeping them.
  const tokens = text.split(/(<ins>.*?<\/ins>|<del>.*?<\/del>)/g)
  return (
    <span>
      {tokens.map((tok, i) => {
        const ins = tok.match(/^<ins>(.*?)<\/ins>$/)
        if (ins) {
          return (
            <span key={i} className="bg-emerald-100 text-emerald-900 underline decoration-emerald-400 underline-offset-2 px-0.5 rounded">
              {ins[1]}
            </span>
          )
        }
        const del = tok.match(/^<del>(.*?)<\/del>$/)
        if (del) {
          return (
            <span key={i} className="bg-red-100 text-red-900 line-through decoration-red-500 px-0.5 rounded">
              {del[1]}
            </span>
          )
        }
        return <span key={i}>{tok}</span>
      })}
    </span>
  )
}

export function TestFeedback() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [drafts, setDrafts] = useState<Record<number, ResponseDraft>>({})
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setPageState({ kind: 'error', error: 'Missing token in the link.' })
      return
    }
    callEdgeFunction('cvp-get-test-feedback-context', { token })
      .then((result) => {
        if (!result.success || !result.data) {
          setPageState({ kind: 'error', error: result.message ?? result.error ?? 'Could not load this review.' })
          return
        }
        const data = result.data as unknown as ContextData
        setPageState({ kind: 'loaded', data })

        // Hydrate drafts from any prior responses on this submission.
        const initial: Record<number, ResponseDraft> = {}
        for (const r of data.existingResponses ?? []) {
          initial[r.errorIndex] = {
            response: r.response,
            reason: r.reason ?? '',
          }
        }
        setDrafts(initial)
      })
      .catch((err: unknown) => {
        setPageState({ kind: 'error', error: err instanceof Error ? err.message : 'Network error' })
      })
  }, [token])

  const setResponse = useCallback((idx: number, response: 'accept' | 'reject') => {
    setDrafts((prev) => ({
      ...prev,
      [idx]: {
        response,
        reason: response === 'reject' ? prev[idx]?.reason ?? '' : '',
      },
    }))
  }, [])

  const setReason = useCallback((idx: number, reason: string) => {
    setDrafts((prev) => ({
      ...prev,
      [idx]: {
        response: prev[idx]?.response ?? 'reject',
        reason,
      },
    }))
  }, [])

  const handleSubmit = async () => {
    if (pageState.kind !== 'loaded') return
    setValidationError(null)

    const responses: Array<{ errorIndex: number; response: 'accept' | 'reject'; reason?: string }> = []
    for (const e of pageState.data.errors) {
      const d = drafts[e.index]
      if (!d || !d.response) continue
      if (d.response === 'reject') {
        const trimmed = d.reason.trim()
        if (trimmed.length === 0) {
          setValidationError(
            `Finding ${e.index + 1}: please add a reason in English when rejecting.`
          )
          return
        }
        responses.push({ errorIndex: e.index, response: 'reject', reason: trimmed })
      } else {
        responses.push({ errorIndex: e.index, response: 'accept' })
      }
    }

    if (responses.length === 0) {
      setValidationError('Respond to at least one finding before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const res = await callEdgeFunction('cvp-submit-test-feedback', { token, responses })
      if (!res.success) {
        setValidationError(res.message ?? res.error ?? 'Submit failed.')
        setSubmitting(false)
        return
      }
      const recorded = (res.data as { recorded?: number } | undefined)?.recorded ?? responses.length
      setPageState({ kind: 'submitted', recorded })
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (pageState.kind === 'loading') {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[40vh] gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      </Layout>
    )
  }

  if (pageState.kind === 'error') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-6 my-12 border border-red-200 bg-red-50 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <div className="font-semibold text-red-800">Couldn't load this review</div>
            <div className="text-sm text-red-700 mt-1">{pageState.error}</div>
          </div>
        </div>
      </Layout>
    )
  }

  if (pageState.kind === 'submitted') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-6 my-12 border border-emerald-200 bg-emerald-50 rounded-lg text-center">
          <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-emerald-900">Thanks — your responses are in</h2>
          <p className="text-sm text-emerald-800 mt-2">
            We recorded responses for {pageState.recorded} finding{pageState.recorded === 1 ? '' : 's'}. Our team will read every comment. You don't need to do anything else.
          </p>
        </div>
      </Layout>
    )
  }

  const { data } = pageState
  const total = data.errors.length
  const sourceRtl = data.sourceLanguageRtl ?? isRtlCode(data.sourceLanguageCode)
  const targetRtl = data.targetLanguageRtl ?? isRtlCode(data.targetLanguageCode)
  const sourceCode = data.sourceLanguageCode ?? undefined
  const targetCode = data.targetLanguageCode ?? undefined
  const responded = Object.values(drafts).filter((d) => d.response !== null && d.response !== undefined).length

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <div className="text-xs text-gray-500">{data.applicationNumber}</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hi {data.applicantFirstName || 'there'} — review your test findings
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <span className="px-2 py-0.5 rounded bg-gray-100">{data.pair}</span>
            {data.domain && <span className="px-2 py-0.5 rounded bg-gray-100 capitalize">{data.domain}</span>}
            {data.overallScore !== null && (
              <span
                className={`px-2 py-0.5 rounded font-semibold ${
                  data.overallScore >= 80
                    ? 'bg-emerald-100 text-emerald-800'
                    : data.overallScore >= 65
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                Score: {data.overallScore}/100
              </span>
            )}
            <span className="text-xs text-gray-500">{formatExpiry(data.expiresAt)}</span>
          </div>
        </header>

        {data.expired && (
          <div className="p-3 border border-red-200 bg-red-50 rounded text-sm text-red-800">
            This link has expired. You can no longer submit feedback.
          </div>
        )}

        {data.alreadySubmitted && (
          <div className="p-3 border border-emerald-200 bg-emerald-50 rounded text-sm text-emerald-800">
            You've already submitted feedback. You can update your responses below if needed.
          </div>
        )}

        <section className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-base font-semibold text-blue-900">How this works</h2>
          <ol className="list-decimal pl-5 text-sm text-blue-900 space-y-1.5">
            <li>For each finding, click <strong>I agree</strong> if our reviewer is right, or <strong>I disagree</strong> if you'd push back.</li>
            <li>If you disagree, write a short explanation <strong>in English</strong>. Our review team handles many language pairs and reads everything in English.</li>
            <li>This isn't an appeal — your score stands. Your responses help us train our reviewer to be fairer next time.</li>
          </ol>
        </section>

        {data.feedbackDraft && (
          <section className="p-4 bg-white border border-gray-200 rounded-lg">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Reviewer's overall feedback</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.feedbackDraft}</p>
          </section>
        )}

        {data.strengths && data.strengths.length > 0 && (
          <section className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <h2 className="text-sm font-semibold text-emerald-900 mb-2">What you did well</h2>
            <ul className="list-disc pl-5 text-sm text-emerald-900 space-y-0.5">
              {data.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Findings ({total})
            </h2>
            <span className="text-xs text-gray-500">{responded}/{total} responded</span>
          </div>

          {data.errors.map((e) => {
            const draft = drafts[e.index]
            const sev = severityStyle(e.severity)
            return (
              <div key={e.index} className={`border rounded-lg p-4 ${sev.wrap}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sev.chip}`}>{sev.label}</span>
                  {e.category && <span className="text-xs capitalize text-gray-700">{e.category.replace(/_/g, ' ')}</span>}
                  {e.location && <span className="text-[11px] font-mono text-gray-500">{e.location}</span>}
                </div>

                {(e.source_segment || e.applicant_translation || e.revised_translation) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3">
                    {e.source_segment !== null && (
                      <div className="bg-white border border-gray-200 rounded p-2">
                        <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Source</div>
                        <div
                          dir={sourceRtl ? 'rtl' : 'ltr'}
                          lang={sourceCode}
                          className={`text-gray-800 leading-relaxed ${sourceRtl ? 'text-right' : ''}`}
                        >
                          {e.source_segment}
                        </div>
                      </div>
                    )}
                    {e.applicant_translation !== null && (
                      <div className="bg-white border border-gray-200 rounded p-2">
                        <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Your translation</div>
                        <div
                          dir={targetRtl ? 'rtl' : 'ltr'}
                          lang={targetCode}
                          className={`text-gray-800 leading-relaxed ${targetRtl ? 'text-right' : ''}`}
                        >
                          {e.applicant_translation}
                        </div>
                      </div>
                    )}
                    {e.revised_translation !== null && (
                      <div className="bg-white border border-emerald-200 rounded p-2">
                        <div className="text-[10px] uppercase font-semibold text-emerald-700 mb-1">Suggested revision</div>
                        <div
                          dir={targetRtl ? 'rtl' : 'ltr'}
                          lang={targetCode}
                          className={`text-gray-800 leading-relaxed ${targetRtl ? 'text-right' : ''}`}
                        >
                          <RevisedSpan text={e.revised_translation} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {e.comment && (
                  <div className="text-sm text-gray-800 mb-3">
                    <span className="font-semibold text-gray-700">Reviewer's note: </span>
                    {e.comment}
                  </div>
                )}

                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="text-[11px] font-semibold text-gray-700">Your response</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResponse(e.index, 'accept')}
                      disabled={data.expired}
                      className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                        draft?.response === 'accept'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-emerald-50'
                      } disabled:opacity-50`}
                    >
                      I agree
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponse(e.index, 'reject')}
                      disabled={data.expired}
                      className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                        draft?.response === 'reject'
                          ? 'bg-red-600 text-white border-red-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50'
                      } disabled:opacity-50`}
                    >
                      I disagree
                    </button>
                  </div>
                  {draft?.response === 'reject' && (
                    <div className="space-y-1">
                      <textarea
                        value={draft.reason}
                        onChange={(ev) => setReason(e.index, ev.target.value.slice(0, 2000))}
                        rows={3}
                        placeholder="Explain (in English) why you disagree. Cite specific terminology, regional usage, or context."
                        disabled={data.expired}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 resize-y disabled:opacity-50"
                      />
                      <div className="text-[10px] text-gray-500 text-right">{draft.reason.length}/2000 · English only</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {validationError && (
          <div className="p-3 border border-red-200 bg-red-50 rounded flex items-start gap-2 text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 px-4 py-3 sm:mx-0 sm:rounded-lg sm:border">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || data.expired}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit my responses
          </button>
        </div>
      </div>
    </Layout>
  )
}
