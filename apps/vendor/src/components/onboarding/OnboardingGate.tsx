/**
 * OnboardingGate
 *
 * Wraps post-auth routes that require the vendor to have completed
 * onboarding (CV + NDA). When either gate fails, redirects to
 * /onboarding. Routes a vendor needs to actually COMPLETE onboarding
 * — /profile, /nda, /onboarding itself — must be reachable without
 * passing through this gate; they're mounted outside the wrapper in
 * App.tsx.
 */

import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOnboardingGate } from "../../hooks/useOnboardingGate";

export function OnboardingGate() {
  const { loading, passes } = useOnboardingGate();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!passes) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
