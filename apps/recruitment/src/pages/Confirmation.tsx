import { useLocation, Navigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { Layout } from '../components/Layout'

export function Confirmation() {
  const location = useLocation()
  const applicationNumber = (location.state as { applicationNumber?: string })?.applicationNumber

  if (!applicationNumber) {
    return <Navigate to="/apply" replace />
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto text-center py-12 space-y-6">
        <div className="flex justify-center">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Application Received</h1>
          <p className="text-gray-600">
            Thank you for applying to join CETHOS. Your application has been submitted successfully.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Your application number</p>
          <p className="text-lg font-mono font-semibold text-gray-900">{applicationNumber}</p>
        </div>

        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-left space-y-2">
          <h3 className="text-sm font-semibold text-blue-900">What happens next?</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Your application will be reviewed by our screening system</li>
            <li>You'll receive a confirmation email shortly</li>
            <li>If selected, you'll receive a test assignment within 1-2 business days</li>
            <li>We'll notify you of the outcome by email</li>
          </ol>
        </div>

        <p className="text-sm text-gray-400">
          Please keep your application number for your records.
          Check your email (including spam) for updates.
        </p>
      </div>
    </Layout>
  )
}
