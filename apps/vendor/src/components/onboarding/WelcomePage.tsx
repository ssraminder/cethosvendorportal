import { useNavigate, Navigate } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import {
  PartyPopper,
  User,
  KeyRound,
  ChevronRight,
  Briefcase,
} from "lucide-react";

export function WelcomePage() {
  const { vendor, needsPassword, isFirstLogin, markWelcomeComplete } =
    useVendorAuth();
  const navigate = useNavigate();

  if (!vendor) {
    return <Navigate to="/login" replace />;
  }

  // If not first login, go to dashboard
  if (!isFirstLogin) {
    return <Navigate to="/" replace />;
  }

  function handleGetStarted() {
    markWelcomeComplete();
    navigate("/");
  }

  function handleGoToProfile() {
    markWelcomeComplete();
    navigate("/profile");
  }

  function handleGoToSecurity() {
    markWelcomeComplete();
    navigate("/security");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <PartyPopper className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to CETHOS!
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            Hi {vendor.full_name}, your vendor account is ready.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Intro */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-sm text-gray-600 leading-relaxed">
              You&apos;ve been approved as a vendor on the CETHOS platform.
              Here&apos;s what you can do to get set up:
            </p>
          </div>

          {/* Steps */}
          <div className="divide-y divide-gray-50">
            <button
              onClick={handleGoToProfile}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  Complete your profile
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add your phone number, country, and other details
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </button>

            {needsPassword && (
              <button
                onClick={handleGoToSecurity}
                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Set up a password
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Optional &mdash; for faster sign-in next time
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            )}

            <div className="px-6 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  Start receiving assignments
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Once your profile is complete, you&apos;ll be matched with
                  projects
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-6 py-5 bg-gray-50 border-t border-gray-100">
            <button
              onClick={handleGetStarted}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              You can always access these from the sidebar menu.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Questions?{" "}
          <a
            href="mailto:support@cethos.com"
            className="text-blue-600 hover:text-blue-700"
          >
            Contact support@cethos.com
          </a>
        </p>
      </div>
    </div>
  );
}
