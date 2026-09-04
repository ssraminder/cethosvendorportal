// Rate-offer action page — /rate-offer/:token
//
// The hourly-rate offer email links here so applicants respond in one click
// instead of replying by email: ACCEPT (for QA Reviewers this immediately
// triggers the report-QA assessment email), COUNTER (propose a different
// rate in their own currency), or DECLINE (optional note). Every action
// updates the application in real time via cvp-respond-rate-offer; the token
// is the credential and each offer link is single-use (idempotent replays
// just show the recorded outcome).

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { CheckCircle, XCircle, Loader2, HandCoins, MessageSquare } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface OfferData {
  applicationNumber: string
  applicantFirstName: string
  offeredRate: number
  offeredCurrency: string
  offeredCadEquivalent: number
  quotedRate: string | null
  quotedCurrency: string | null
  status: string
  respondedAt: string | null
  counterRate: number | null
  expiresAt: string
  assessmentSent?: boolean
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; error: string }
  | { kind: 'loaded'; data: OfferData }

async function callOffer(body: Record<string, unknown>): Promise<{ success: boolean; data?: OfferData; error?: string; message?: string; idempotent?: boolean }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cvp-respond-rate-offer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

export function RateOffer() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [mode, setMode] = useState<'choose' | 'counter' | 'decline'>('choose')
  const [counterRate, setCounterRate] = useState('')
  const [counterNote, setCounterNote] = useState('')
  const [declineNote, setDeclineNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!token) { setPageState({ kind: 'error', error: 'No offer token provided.' }); return }
    setPageState({ kind: 'loading' })
    callOffer({ token, action: 'get' })
      .then((r) => {
        if (r.success && r.data) setPageState({ kind: 'loaded', data: r.data })
        else setPageState({ kind: 'error', error: r.message ?? (r.error === 'invalid_link' ? 'This link is not valid.' : r.error ?? 'Could not load the offer.') })
      })
      .catch(() => setPageState({ kind: 'error', error: 'Could not connect to the server. Please try again.' }))
  }, [token])

  useEffect(() => { load() }, [load])

  const respond = async (response: 'accept' | 'decline' | 'counter') => {
    if (!token) return
    setBusy(true)
    try {
      const r = await callOffer({
        token,
        action: 'respond',
        response,
        ...(response === 'counter' ? { counterRate, counterNote } : {}),
        ...(response === 'decline' ? { declineNote } : {}),
      })
      if (r.success && r.data) setPageState({ kind: 'loaded', data: r.data })
      else alert(r.message ?? r.error ?? 'Something went wrong — please try again.')
    } catch {
      alert('Could not connect to the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (pageState.kind === 'loading') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-500">Loading your offer…</p>
        </div>
      </Layout>
    )
  }

  if (pageState.kind === 'error') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-16 text-center space-y-3">
          <XCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-cethos-navy">Link problem</h1>
          <p className="text-gray-600">{pageState.error}</p>
          <p className="text-sm text-gray-500">Need help? Email vm@cethos.com and mention your application number.</p>
        </div>
      </Layout>
    )
  }

  const d = pageState.data
  const rateLabel = `${d.offeredCurrency} ${Number(d.offeredRate).toFixed(2)} / hour`

  // ---- settled states ----
  if (d.status !== 'pending') {
    const settled = {
      accepted: {
        icon: <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />,
        title: 'Rate accepted — thank you!',
        body: d.assessmentSent
          ? `You've accepted ${rateLabel}. The next step — a short knowledge assessment — has just been emailed to you. It takes about 15 minutes.`
          : `You've accepted ${rateLabel}. We'll follow up by email with the next step shortly.`,
      },
      countered: {
        icon: <MessageSquare className="w-10 h-10 text-cethos-teal mx-auto" />,
        title: 'Counter-proposal received',
        body: `You proposed ${d.offeredCurrency} ${Number(d.counterRate ?? 0).toFixed(2)} / hour. Our team will review it and come back to you by email.`,
      },
      declined: {
        icon: <XCircle className="w-10 h-10 text-gray-400 mx-auto" />,
        title: 'Offer declined',
        body: 'Thank you for letting us know — we completely understand, and we appreciate your interest in Cethos. If circumstances change, you are welcome to get in touch.',
      },
      expired: {
        icon: <XCircle className="w-10 h-10 text-amber-400 mx-auto" />,
        title: 'This offer link has expired',
        body: 'If you are still interested, reply to our email or write to vm@cethos.com and we will send a fresh link.',
      },
      superseded: {
        icon: <XCircle className="w-10 h-10 text-amber-400 mx-auto" />,
        title: 'A newer offer replaces this one',
        body: 'Please use the link in our most recent email. If you cannot find it, write to vm@cethos.com.',
      },
    }[d.status] ?? { icon: null, title: d.status, body: '' }

    return (
      <Layout>
        <div className="max-w-lg mx-auto py-16 text-center space-y-3">
          {settled.icon}
          <h1 className="text-xl font-bold text-cethos-navy">{settled.title}</h1>
          <p className="text-gray-600">{settled.body}</p>
          <p className="text-sm text-gray-400">Application {d.applicationNumber}</p>
        </div>
      </Layout>
    )
  }

  // ---- pending: the action card ----
  return (
    <Layout>
      <div className="max-w-lg mx-auto py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <HandCoins className="w-10 h-10 text-cethos-teal mx-auto" />
            <h1 className="text-xl font-bold text-cethos-navy">Our rate offer{d.applicantFirstName ? ` for ${d.applicantFirstName}` : ''}</h1>
            <p className="text-sm text-gray-500">Application {d.applicationNumber}</p>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-5 text-center">
            <div className="text-3xl font-bold text-cethos-navy">{rateLabel}</div>
            {d.offeredCurrency !== 'CAD' && (
              <div className="text-xs text-gray-500 mt-1">equivalent to our standard CAD {Number(d.offeredCadEquivalent).toFixed(2)} / hour</div>
            )}
            <div className="text-xs text-gray-500 mt-2">
              Hours are allocated per assignment from volume (≈750 words reviewed per hour, per language). Fully remote, flexible scheduling.
            </div>
          </div>

          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => respond('accept')}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Accept {rateLabel}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('counter')}
                  disabled={busy}
                  className="px-4 py-2.5 border-2 border-cethos-teal text-cethos-teal font-medium rounded-lg hover:bg-teal-50 disabled:opacity-50"
                >
                  Propose a different rate
                </button>
                <button
                  onClick={() => setMode('decline')}
                  disabled={busy}
                  className="px-4 py-2.5 border-2 border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {mode === 'counter' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Your proposed hourly rate ({d.offeredCurrency})
                <input
                  type="number"
                  min={1}
                  step="0.5"
                  value={counterRate}
                  onChange={(e) => setCounterRate(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cethos-teal"
                  placeholder={`e.g. ${Math.round(Number(d.offeredRate) * 1.2)}`}
                  autoFocus
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Anything you'd like to add? (optional)
                <textarea
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal"
                />
              </label>
              <div className="flex gap-3">
                <button onClick={() => setMode('choose')} className="px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg">Back</button>
                <button
                  onClick={() => respond('counter')}
                  disabled={busy || !counterRate}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cethos-teal text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
                  Send counter-proposal
                </button>
              </div>
            </div>
          )}

          {mode === 'decline' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Care to tell us why? (optional)
                <textarea
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal"
                  autoFocus
                />
              </label>
              <div className="flex gap-3">
                <button onClick={() => setMode('choose')} className="px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg">Back</button>
                <button
                  onClick={() => respond('decline')}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-gray-400 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                  Confirm decline
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Questions before deciding? Email vm@cethos.com — this link stays valid until {new Date(d.expiresAt).toLocaleDateString()}.
          </p>
        </div>
      </div>
    </Layout>
  )
}
