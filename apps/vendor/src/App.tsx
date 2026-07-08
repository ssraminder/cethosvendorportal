import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { VendorAuthProvider } from "./context/VendorAuthContext";
import { LoginPage } from "./components/auth/LoginPage";
import { ActivatePage } from "./components/auth/ActivatePage";
import { WelcomePage } from "./components/onboarding/WelcomePage";
import { VendorShell } from "./components/layout/VendorShell";
import { VendorDashboard } from "./components/dashboard/VendorDashboard";
import { VendorProfile } from "./components/profile/VendorProfile";
import { LanguagePairs } from "./components/profile/LanguagePairs";
import { VendorRates } from "./components/profile/VendorRates";
import { PaymentInfo } from "./components/profile/PaymentInfo";
import { RequestTest } from "./components/profile/RequestTest";
import { JobBoard } from "./components/jobs/JobBoard";
import { JobDetail } from "./components/jobs/JobDetail";
import { InvoiceList } from "./components/invoices/InvoiceList";
import { InvoiceDetail } from "./components/invoices/InvoiceDetail";
import { PurchaseOrderList } from "./components/purchase-orders/PurchaseOrderList";
import { QualityActionsList } from "./components/quality-actions/QualityActionsList";
import { UnsubscribePage } from "./components/unsubscribe/UnsubscribePage";
import { NDAPage, GVSAPage } from "./components/nda/NDAPage";
import { VendorReferencesEntry } from "./components/references/VendorReferencesEntry";
import { VendorReferenceFeedback } from "./components/references/VendorReferenceFeedback";
import { IsoEvidencePage } from "./components/iso-evidence/IsoEvidencePage";
import { VendorDocuments } from "./components/documents/VendorDocuments";
import { RosterManager } from "./components/roster/RosterManager";
import { TrainingsList } from "./components/trainings/TrainingsList";
import { TrainingDetail } from "./components/trainings/TrainingDetail";
import { GuidesPage } from "./components/guides/GuidesPage";
import { MyInterviewsPage } from "./components/interviews/MyInterviewsPage";
import { OnboardingGate } from "./components/onboarding/OnboardingGate";
import { OnboardingPage } from "./components/onboarding/OnboardingPage";
import { OnboardingPackagePage } from "./components/onboarding/OnboardingPackagePage";
import { OnboardingSignTokenPage } from "./components/onboarding/OnboardingSignTokenPage";
import { AboutSoftware } from "./components/about/AboutSoftware";

function App() {
  return (
    <VendorAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/vendor-references/:token" element={<VendorReferencesEntry />} />
          <Route path="/vendor-reference-feedback/:token" element={<VendorReferenceFeedback />} />
          <Route path="/iso-evidence/:token" element={<IsoEvidencePage />} />
          <Route path="/onboarding-sign/:token" element={<OnboardingSignTokenPage />} />
          <Route path="/about" element={<AboutSoftware />} />
          <Route path="/" element={<VendorShell />}>
            {/* Routes the vendor needs in order to complete onboarding —
                accessible regardless of gate state. */}
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="onboarding-package" element={<OnboardingPackagePage />} />
            <Route path="profile" element={<VendorProfile />} />
            <Route path="nda" element={<NDAPage />} />
            <Route path="gvsa" element={<GVSAPage />} />

            {/* Gated routes — vendor must have CV + NDA on file. */}
            <Route element={<OnboardingGate />}>
              <Route index element={<VendorDashboard />} />
              <Route path="languages" element={<LanguagePairs />} />
              <Route path="roster" element={<RosterManager />} />
              <Route path="rates" element={<VendorRates />} />
              <Route path="payment" element={<PaymentInfo />} />
              <Route path="documents" element={<VendorDocuments />} />
              <Route path="request-test" element={<RequestTest />} />
              <Route path="jobs" element={<JobBoard />} />
              <Route path="jobs/:id" element={<JobDetail />} />
              <Route path="purchase-orders" element={<PurchaseOrderList />} />
              <Route path="invoices" element={<InvoiceList />} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="trainings" element={<TrainingsList />} />
              <Route path="trainings/:id" element={<TrainingDetail />} />
              <Route path="guides" element={<GuidesPage />} />
              <Route path="interviews" element={<MyInterviewsPage />} />
              <Route path="quality-actions" element={<QualityActionsList />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </VendorAuthProvider>
  );
}

export default App;
