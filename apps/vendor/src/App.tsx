import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { VendorAuthProvider } from "./context/VendorAuthContext";
import { LoginPage } from "./components/auth/LoginPage";
import { ActivatePage } from "./components/auth/ActivatePage";
import { WelcomePage } from "./components/onboarding/WelcomePage";
import { VendorShell } from "./components/layout/VendorShell";
import { VendorDashboard } from "./components/dashboard/VendorDashboard";
import { VendorProfile } from "./components/profile/VendorProfile";
import { SetPasswordForm } from "./components/profile/SetPasswordForm";
import { LanguagePairs } from "./components/profile/LanguagePairs";
import { VendorRates } from "./components/profile/VendorRates";
import { PaymentInfo } from "./components/profile/PaymentInfo";
import { RequestTest } from "./components/profile/RequestTest";
import { JobBoard } from "./components/jobs/JobBoard";
import { JobDetail } from "./components/jobs/JobDetail";
import { InvoiceList } from "./components/invoices/InvoiceList";
import { InvoiceDetail } from "./components/invoices/InvoiceDetail";

function App() {
  return (
    <VendorAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/" element={<VendorShell />}>
            <Route index element={<VendorDashboard />} />
            <Route path="profile" element={<VendorProfile />} />
            <Route path="security" element={<SetPasswordForm />} />
            <Route path="languages" element={<LanguagePairs />} />
            <Route path="rates" element={<VendorRates />} />
            <Route path="payment" element={<PaymentInfo />} />
            <Route path="request-test" element={<RequestTest />} />
            <Route path="jobs" element={<JobBoard />} />
            <Route path="jobs/:id" element={<JobDetail />} />
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </VendorAuthProvider>
  );
}

export default App;
