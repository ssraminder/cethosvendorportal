import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Apply } from './pages/Apply'
import { Confirmation } from './pages/Confirmation'
import { TestSubmission } from './pages/TestSubmission'
import { ChooseAssessment } from './pages/ChooseAssessment'
import { QuizSubmission } from './pages/QuizSubmission'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { ReferencesEntry } from './pages/ReferencesEntry'
import { ReferenceFeedback } from './pages/ReferenceFeedback'
import { TestFeedback } from './pages/TestFeedback'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/apply" element={<Apply />} />
        <Route path="/apply/confirmation" element={<Confirmation />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/choose/:token" element={<ChooseAssessment />} />
        <Route path="/test/:token" element={<TestSubmission />} />
        <Route path="/quiz/:token" element={<QuizSubmission />} />
        <Route path="/test-feedback/:token" element={<TestFeedback />} />
        <Route path="/references/:token" element={<ReferencesEntry />} />
        <Route path="/reference-feedback/:token" element={<ReferenceFeedback />} />
        <Route path="/" element={<Navigate to="/apply" replace />} />
        <Route path="*" element={<Navigate to="/apply" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
