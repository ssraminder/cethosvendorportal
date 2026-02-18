import { useState, useEffect, useCallback } from 'react'
import { Loader2, Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type TabKey = 'needs_attention' | 'in_progress' | 'decided' | 'waitlist'

interface ApplicationRow {
  id: string
  application_number: string
  full_name: string
  email: string
  role_type: 'translator' | 'cognitive_debriefing'
  status: string
  ai_prescreening_score: number | null
  assigned_tier: string | null
  country: string
  created_at: string
  updated_at: string
}

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

const TIER_LABELS: Record<string, string> = {
  standard: 'Standard',
  senior: 'Senior',
  expert: 'Expert',
}

const TAB_FILTERS: Record<TabKey, string[]> = {
  needs_attention: ['staff_review', 'info_requested'],
  in_progress: [
    'submitted', 'prescreening', 'prescreened', 'test_pending', 'test_sent',
    'test_in_progress', 'test_submitted', 'test_assessed', 'negotiation',
  ],
  decided: ['approved', 'rejected', 'archived'],
  waitlist: ['waitlisted'],
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function RecruitmentQueue() {
  const [activeTab, setActiveTab] = useState<TabKey>('needs_attention')
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'created_at' | 'ai_prescreening_score' | 'full_name'>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [tabCounts, setTabCounts] = useState<Record<TabKey, number>>({
    needs_attention: 0,
    in_progress: 0,
    decided: 0,
    waitlist: 0,
  })

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    setError(null)

    const statuses = TAB_FILTERS[activeTab]

    const { data, error: fetchError } = await supabase
      .from('cvp_applications')
      .select('id, application_number, full_name, email, role_type, status, ai_prescreening_score, assigned_tier, country, created_at, updated_at')
      .in('status', statuses)
      .order(sortField, { ascending: sortAsc })

    if (fetchError) {
      setError('Failed to load applications.')
      console.error('Error fetching applications:', fetchError)
    } else {
      setApplications(data ?? [])
    }

    setLoading(false)
  }, [activeTab, sortField, sortAsc])

  const fetchCounts = useCallback(async () => {
    const counts: Record<TabKey, number> = {
      needs_attention: 0,
      in_progress: 0,
      decided: 0,
      waitlist: 0,
    }

    for (const [tab, statuses] of Object.entries(TAB_FILTERS)) {
      const { count } = await supabase
        .from('cvp_applications')
        .select('*', { count: 'exact', head: true })
        .in('status', statuses)

      counts[tab as TabKey] = count ?? 0
    }

    setTabCounts(counts)
  }, [])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const filteredApplications = searchQuery
    ? applications.filter(
        (a) =>
          a.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.application_number.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : applications

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null
    return sortAsc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'needs_attention', label: 'Needs Attention' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'decided', label: 'Decided' },
    { key: 'waitlist', label: 'Waitlist' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Recruitment Queue</h1>
          <p className="mt-1 text-sm text-gray-500">Manage vendor applications</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or application #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500 text-sm">Loading...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            No applications in this tab.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Application</th>
                    <th
                      className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('full_name')}
                    >
                      Name <SortIcon field="full_name" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Country</th>
                    <th
                      className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('ai_prescreening_score')}
                    >
                      AI Score <SortIcon field="ai_prescreening_score" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tier</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th
                      className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('created_at')}
                    >
                      Applied <SortIcon field="created_at" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Days</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {app.application_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{app.full_name}</div>
                        <div className="text-xs text-gray-400">{app.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          app.role_type === 'translator'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}>
                          {app.role_type === 'translator' ? 'Translator' : 'Cog. Debrief'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{app.country}</td>
                      <td className="px-4 py-3">
                        {app.ai_prescreening_score !== null ? (
                          <span className={`font-medium ${
                            app.ai_prescreening_score >= 70
                              ? 'text-green-600'
                              : app.ai_prescreening_score >= 50
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}>
                            {app.ai_prescreening_score}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {app.assigned_tier ? TIER_LABELS[app.assigned_tier] ?? app.assigned_tier : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-600'
                        }`}>
                          {STATUS_LABELS[app.status] ?? app.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(app.created_at).toLocaleDateString('en-CA')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {daysSince(app.updated_at)}d
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/admin/recruitment/${app.id}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="View detail"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
