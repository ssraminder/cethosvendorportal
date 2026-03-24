import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { VendorAuthProvider } from "./context/VendorAuthContext";
import { LoginPage } from "./components/auth/LoginPage";
import { ActivatePage } from "./components/auth/ActivatePage";
import { WelcomePage } from "./components/onboarding/WelcomePage";
import { VendorShell } from "./components/layout/VendorShell";
import { VendorDashboard } from "./components/dashboard/VendorDashboard";
import { VendorProfile } from "./components/profile/VendorProfile";
import { SetPasswordForm } from "./components/profile/SetPasswordForm";

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
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </VendorAuthProvider>
  );
}

export default App;
