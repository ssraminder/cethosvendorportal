import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'

export function PrivacyPolicy() {
  const lastUpdated = 'April 22, 2026'

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <div>
          <Link to="/apply" className="text-sm text-blue-600 hover:text-blue-800">
            ← Back to application
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-3">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Who we are</h2>
          <p className="text-gray-700 leading-relaxed">
            This privacy policy applies to vendor and consultant applications
            submitted through <span className="font-medium">join.cethos.com</span>,
            operated by CETHOS Translation Services (&ldquo;CETHOS&rdquo;,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;), based in Calgary, Canada. It
            describes what personal information we collect when you apply to
            join our vendor network, how we use it, and your rights over it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">What we collect</h2>
          <p className="text-gray-700 leading-relaxed">
            When you submit an application, we collect:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Identification: full name, email address, phone number, city, country.</li>
            <li>Professional information: LinkedIn URL, years of experience, education level, professional certifications, CAT tools, language pairs, service offerings, domain specializations, and rate expectations.</li>
            <li>Uploaded documents: resume/CV and, where applicable, any clinical-research credentials you choose to provide.</li>
            <li>Clinical-research experience (only if you offer relevant services): therapy areas, instrument types, ISPOR/FDA familiarity, and related context.</li>
            <li>Application metadata: IP address, browser user-agent, timestamps, application status, and internal staff review notes.</li>
            <li>Skills-test data: the content of any test you voluntarily submit during our assessment process, along with AI-generated and human-generated assessment results.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Why we collect it</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>To assess whether your skills and experience fit the work we route to our vendor network.</li>
            <li>To run the application workflow: automated pre-screening, assignment of language-pair tests, and staff review.</li>
            <li>To communicate with you about the status of your application, including test invitations, reminders, decisions, and rate discussions.</li>
            <li>If approved, to create your vendor account and route work opportunities to you.</li>
            <li>To maintain records for compliance, fraud prevention, and quality-assurance purposes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Who we share it with</h2>
          <p className="text-gray-700 leading-relaxed">
            We share your personal information only with the service providers we rely on to operate this recruitment pipeline:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><span className="font-medium">Supabase</span> — database, file storage, and serverless function hosting.</li>
            <li><span className="font-medium">Brevo</span> — transactional email delivery (application confirmations, test invitations, status updates).</li>
            <li><span className="font-medium">Twilio</span> — SMS delivery for vendor-portal login verification (only after approval).</li>
            <li><span className="font-medium">Anthropic</span> — AI-assisted pre-screening and test assessment. Only the specific text and structured data needed for evaluation is sent; no data is used to train third-party models.</li>
            <li><span className="font-medium">Netlify</span> — web hosting for this application portal.</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            We do not sell, rent, or trade your personal information. We do not share it with marketing partners.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">How long we keep it</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>If your application is <span className="font-medium">approved</span>, your data is retained for as long as you remain an active vendor in our network, plus a reasonable period afterwards for tax, legal, and accounting records.</li>
            <li>If your application is <span className="font-medium">rejected</span> or <span className="font-medium">waitlisted</span>, we retain your application record for up to 24 months to manage the reapplication cooldown and waitlist process.</li>
            <li>If your application is <span className="font-medium">archived</span> (no test submitted within 10 days), we retain a minimal record for 12 months before deletion.</li>
            <li>You may request earlier deletion at any time — see the contact section below.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Your rights</h2>
          <p className="text-gray-700 leading-relaxed">
            Subject to applicable law (including PIPEDA in Canada, the GDPR in the European Economic Area and the UK, and the California Consumer Privacy Act), you have the right to:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Access the personal information we hold about you.</li>
            <li>Correct inaccurate or incomplete information.</li>
            <li>Request deletion of your application data.</li>
            <li>Withdraw consent for future processing (noting that this will end your application).</li>
            <li>Lodge a complaint with a data-protection authority.</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            To exercise any of these rights, email us at{' '}
            <a href="mailto:privacy@cethos.com" className="text-blue-600 hover:text-blue-800">
              privacy@cethos.com
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Security</h2>
          <p className="text-gray-700 leading-relaxed">
            Data is transmitted over TLS and stored in Supabase&rsquo;s managed Postgres database with row-level security. Uploaded files are stored in object storage with access granted only via short-lived signed URLs. Access to production data is limited to authorized CETHOS staff on a need-to-know basis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Cross-border transfers</h2>
          <p className="text-gray-700 leading-relaxed">
            Our primary infrastructure is hosted in North America. If you apply from outside North America, your personal information will be transferred to, stored in, and processed in the United States and Canada, where data-protection laws may differ from those in your jurisdiction. By submitting your application you consent to this transfer.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Changes to this policy</h2>
          <p className="text-gray-700 leading-relaxed">
            We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the top reflects the most recent change. Material changes will be communicated to applicants with active records by email.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Contact</h2>
          <p className="text-gray-700 leading-relaxed">
            Questions about this policy or about your data can be directed to{' '}
            <a href="mailto:privacy@cethos.com" className="text-blue-600 hover:text-blue-800">
              privacy@cethos.com
            </a>
            . For recruitment questions, email{' '}
            <a href="mailto:recruiting@cethos.com" className="text-blue-600 hover:text-blue-800">
              recruiting@cethos.com
            </a>
            .
          </p>
        </section>

        <div className="pt-6 border-t border-gray-200">
          <Link to="/apply" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to application
          </Link>
        </div>
      </div>
    </Layout>
  )
}
