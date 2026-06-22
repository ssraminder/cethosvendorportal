import { useState } from 'react'
import { Layout } from './Layout'
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export interface NdaTemplate {
  id: string
  title: string
  version_label: string | null
  body_html: string
}

interface NdaGateProps {
  token: string
  kind: 'quiz' | 'test'
  applicantName: string
  applicantEmail?: string | null
  nda: NdaTemplate | null
  /** Called after the NDA is accepted — re-fetch the assessment. */
  onSigned: () => void
}

/**
 * NDA-before-assessment clickwrap. Shown when cvp-get-quiz / cvp-get-test return
 * { nda_required: true }. The applicant reads the active confidentiality
 * agreement, types their full legal name, ticks agree, and continues — which
 * records an auditable e-signature (cvp-applicant-sign-nda) and re-loads the
 * assessment.
 */
export function NdaGate({ token, kind, applicantName, applicantEmail, nda, onSigned }: NdaGateProps) {
  const [fullName, setFullName] = useState(applicantName ?? '')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSign = agreed && fullName.trim().length >= 2 && !submitting

  const handleSign = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cvp-applicant-sign-nda`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, kind, fullName: fullName.trim() }),
      })
      const result = await res.json()
      if (result.success) {
        onSigned()
      } else {
        setError(result.error ?? result.message ?? 'Could not record your acceptance. Please try again.')
        setSubmitting(false)
      }
    } catch {
      setError('Could not connect to the server. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-6 h-6 text-cyan-600" />
          <h1 className="text-xl font-bold text-slate-900">Confidentiality Agreement</h1>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          Before your assessment opens, please read and accept this short confidentiality agreement (NDA).
          It protects the test materials and any client content you may see. This takes under a minute, and
          <span className="font-medium text-slate-700"> you only need to do this once</span> — it carries
          through to your assessments and, if you join, your vendor account.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">{nda?.title ?? 'Confidentiality and Non-Solicitation Agreement'}</span>
            {nda?.version_label && (
              <span className="text-xs text-slate-500">{nda.version_label}</span>
            )}
          </div>
          <div
            className="prose prose-sm max-w-none px-5 py-4 max-h-[46vh] overflow-y-auto text-slate-800"
            // Trusted, server-controlled NDA template HTML.
            dangerouslySetInnerHTML={{ __html: nda?.body_html ?? '<p>The agreement could not be loaded. Please reply to your invitation email for help.</p>' }}
          />
        </div>

        <div className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Full legal name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Type your full name to sign"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </label>
          {applicantEmail && (
            <p className="text-xs text-slate-500">Signing as <span className="font-medium text-slate-700">{applicantEmail}</span></p>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm text-slate-700">
              I have read and agree to the {nda?.title ?? 'Confidentiality Agreement'}
              {nda?.version_label ? ` (${nda.version_label})` : ''}, and I am signing electronically.
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSign}
            disabled={!canSign}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Agree &amp; continue to assessment
          </button>
        </div>
      </div>
    </Layout>
  )
}
