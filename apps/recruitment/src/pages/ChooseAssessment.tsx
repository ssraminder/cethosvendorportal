import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import {
  FileText,
  ListChecks,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type Choice = 'test' | 'quiz'

type PageState =
  | { kind: 'choosing' }
  | { kind: 'submitting'; choice: Choice }
  | { kind: 'done'; choice: Choice }
  | { kind: 'error'; message: string; alreadyChosen?: boolean }

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

export function ChooseAssessment() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>({ kind: 'choosing' })

  const handleChoose = async (choice: Choice) => {
    if (!token) {
      setPageState({ kind: 'error', message: 'No invitation token in URL.' })
      return
    }
    setPageState({ kind: 'submitting', choice })
    try {
      const result = await callEdgeFunction('cvp-record-instrument-choice', {
        token,
        choice,
      })
      if (result.success) {
        setPageState({ kind: 'done', choice })
      } else if (result.error === 'already_chosen') {
        setPageState({
          kind: 'error',
          alreadyChosen: true,
          message:
            result.message ??
            'You have already chosen your assessment. Check your email for the link, or contact recruitment@cethos.com.',
        })
      } else {
        setPageState({
          kind: 'error',
          message:
            result.message ?? result.error ?? 'Could not record your choice. Please try again.',
        })
      }
    } catch {
      setPageState({
        kind: 'error',
        message: 'Could not reach the server. Please try again.',
      })
    }
  }

  // ---- DONE ----
  if (pageState.kind === 'done') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-12 space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-cethos-navy">You're all set</h1>
          <p className="text-gray-600">
            We just emailed you {pageState.choice === 'test' ? 'your translation test link(s)' : 'your quiz link(s)'}.
            Check your inbox — it should arrive within a minute or two. The
            link will be valid for 240 hours.
          </p>
          <div className="bg-cethos-bg-blue rounded-lg border border-cethos-teal p-4 text-sm text-cethos-teal">
            Don't see the email? Check spam, or reply to the original invitation.
          </div>
        </div>
      </Layout>
    )
  }

  // ---- ERROR ----
  if (pageState.kind === 'error') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-12 space-y-6">
          <div className="flex justify-center">
            {pageState.alreadyChosen ? (
              <CheckCircle className="w-16 h-16 text-green-500" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-cethos-navy">
            {pageState.alreadyChosen ? 'Choice already made' : 'Something went wrong'}
          </h1>
          <p className="text-gray-600">{pageState.message}</p>
        </div>
      </Layout>
    )
  }

  // ---- CHOOSING / SUBMITTING ----
  const isSubmitting = pageState.kind === 'submitting'
  const chosenForLoading = isSubmitting ? pageState.choice : null

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-8 space-y-8">
        <div className="text-center space-y-3">
          <div className="text-xs uppercase tracking-wider text-cethos-teal font-semibold">
            CETHOS · Vendor Recruitment
          </div>
          <h1 className="text-3xl font-bold text-cethos-navy">
            Choose your assessment
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Your pre-screen passed. To document your competence we need one of
            two short assessments — pick the path that fits you best. Either
            option is sufficient.
          </p>
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 mt-2">
            <Clock className="w-4 h-4" />
            <span>This invitation expires in 240 hours.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Translation test */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cethos-bg-blue flex items-center justify-center">
                <FileText className="w-5 h-5 text-cethos-teal" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-cethos-navy">
                  Translation test
                </h2>
                <p className="text-xs text-gray-500">Estimated 60-120 min</p>
              </div>
            </div>
            <div className="text-sm text-gray-700 space-y-2 flex-1">
              <p>One or more graded translation samples in the language pairs you applied for.</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Demonstrates applied translation skill</li>
                <li>AI-graded with staff oversight</li>
                <li>ISO 17100 §6.1.2 #1 (translation competence) directly</li>
              </ul>
              <p className="text-xs text-gray-500 pt-2">
                Best if you prefer to show your work on real source text.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleChoose('test')}
              disabled={isSubmitting}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-cethos-teal text-white font-medium px-4 py-3 rounded-lg hover:bg-cethos-teal-light disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {chosenForLoading === 'test' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending your test...
                </>
              ) : (
                <>Take the translation test</>
              )}
            </button>
          </div>

          {/* Card: ISO quiz */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cethos-bg-blue flex items-center justify-center">
                <ListChecks className="w-5 h-5 text-cethos-teal" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-cethos-navy">
                  ISO competence quiz
                </h2>
                <p className="text-xs text-gray-500">Estimated 20-30 min</p>
              </div>
            </div>
            <div className="text-sm text-gray-700 space-y-2 flex-1">
              <p>40 multiple-choice questions covering the five ISO 17100 §6.1.2 competences.</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Linguistic & textual, cultural, domain (target-language)</li>
                <li>Research and technical (cross-language baseline)</li>
                <li>Deterministic grading, immediate feedback to staff</li>
              </ul>
              <p className="text-xs text-gray-500 pt-2">
                Best if you'd rather demonstrate knowledge than produce a translation sample today.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleChoose('quiz')}
              disabled={isSubmitting}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-cethos-teal text-white font-medium px-4 py-3 rounded-lg hover:bg-cethos-teal-light disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {chosenForLoading === 'quiz' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending your quiz...
                </>
              ) : (
                <>Take the ISO quiz</>
              )}
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-gray-500 pt-4">
          Note: once you pick, the choice is locked. If you change your mind,
          email recruitment@cethos.com and a staff member can switch you.
        </div>
      </div>
    </Layout>
  )
}
