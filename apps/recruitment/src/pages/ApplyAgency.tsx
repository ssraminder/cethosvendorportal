import { Layout } from '../components/Layout'
import { AgencyForm } from '../components/AgencyForm'

export function ApplyAgency() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-cethos-navy">Apply as an Agency</h1>
          <p className="mt-2 text-gray-600">
            Translation companies and LSPs: tell us about your business and the
            services you offer. After approval, you'll build a private roster of
            your linguists inside your vendor profile, and pick from that roster
            when delivering each job. Your roster stays private to your agency —
            Cethos sees only the AI completeness check and a roster identifier.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Applying as an individual instead?{' '}
            <a href="/apply" className="text-cethos-teal hover:text-cethos-teal-light underline">
              Use the freelancer application
            </a>.
          </p>
        </div>
        <AgencyForm />
      </div>
    </Layout>
  )
}
