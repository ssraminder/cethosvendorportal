import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Layout } from '../components/Layout'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface Nda {
  id: string
  title: string
  version_label: string | null
  body_html: string
}

/**
 * Public, login-less clinician NDA signing page. Reached via the emailed link
 * (/sign-nda/:token) that clinician-nda-send mails to off-portal clinicians.
 * Fetches + records the signature through clinician-nda-token.
 */
export function ClinicianNdaSign() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [nda, setNda] = useState<Nda | null>(null)
  const [vendorName, setVendorName] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [fullName, setFullName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)

  const api = (body: Record<string, unknown>) =>
    fetch(`${SUPABASE_URL}/functions/v1/clinician-nda-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    }).then((r) => r.json())

  useEffect(() => {
    if (!token) { setLoadError('This signing link is invalid.'); setLoading(false); return }
    let cancelled = false
    void (async () => {
      try {
        const data = await api({ token })
        if (cancelled) return
        if (data.success) {
          setNda(data.nda ?? null)
          setVendorName(data.vendorName ?? null)
          setAlreadySigned(!!data.alreadySigned)
          if (data.vendorName) setFullName(data.vendorName)
        } else {
          setLoadError(data.error ?? 'This signing link could not be loaded.')
        }
      } catch {
        if (!cancelled) setLoadError('Could not connect to the server. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const canSign = agreed && fullName.trim().length >= 2 && !submitting

  const handleSign = async () => {
    setSubmitting(true)
    setSignError(null)
    try {
      const data = await api({ token, action: 'sign', fullName: fullName.trim() })
      if (data.success) setSigned(true)
      else { setSignError(data.error ?? 'Could not record your signature. Please try again.'); setSubmitting(false) }
    } catch {
      setSignError('Could not connect to the server. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        </div>
      </Layout>
    )
  }

  if (signed || alreadySigned) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Thank you — your agreement is signed</h1>
          <p className="text-sm text-slate-600">
            Your Confidentiality &amp; Non-Disclosure Agreement is on file. You can close this page.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-6 h-6 text-cyan-600" />
          <h1 className="text-xl font-bold text-slate-900">Confidentiality &amp; Non-Disclosure Agreement</h1>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          {vendorName ? `Dear ${vendorName}, ` : ''}please read and sign the agreement below to complete your onboarding as a Cethos clinician reviewer.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">{nda?.title ?? 'Confidentiality & Non-Disclosure Agreement'}</span>
            {nda?.version_label && (<span className="text-xs text-slate-500">{nda.version_label}</span>)}
          </div>
          <div
            className="prose prose-sm max-w-none px-5 py-4 max-h-[46vh] overflow-y-auto text-slate-800"
            dangerouslySetInnerHTML={{ __html: nda?.body_html ?? '<p>The agreement could not be loaded.</p>' }}
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

          {signError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{signError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSign}
            disabled={!canSign}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Agree &amp; sign
          </button>
        </div>
      </div>
    </Layout>
  )
}
