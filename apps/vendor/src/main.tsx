import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { installConsoleCapture } from './lib/consoleCapture'

// Install the console ring buffer at boot so the bug-report modal has
// recent output to attach when a vendor files a report. Idempotent;
// preserves original console behaviour.
installConsoleCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
