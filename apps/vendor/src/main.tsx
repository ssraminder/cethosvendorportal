import './lib/sentry'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import { installConsoleCapture } from './lib/consoleCapture'

// Install the console ring buffer at boot so the bug-report modal has
// recent output to attach when a vendor files a report. Idempotent;
// preserves original console behaviour.
installConsoleCapture()

const SentryFallback = () => (
  <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
    <h1>Something went wrong</h1>
    <p>The error has been reported. Refresh to try again.</p>
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
