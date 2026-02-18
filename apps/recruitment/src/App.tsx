import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Apply } from './pages/Apply'
import { Confirmation } from './pages/Confirmation'
import { RecruitmentQueue } from './pages/admin/RecruitmentQueue'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/apply" element={<Apply />} />
        <Route path="/apply/confirmation" element={<Confirmation />} />
        <Route path="/admin/recruitment" element={<RecruitmentQueue />} />
        <Route path="/" element={<Navigate to="/apply" replace />} />
        <Route path="*" element={<Navigate to="/apply" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
