import { useState } from "react";
import { OtpLoginForm } from "./OtpLoginForm";
import { PasswordLoginForm } from "./PasswordLoginForm";

type LoginTab = "otp" | "password";

export function LoginPage() {
  const [activeTab, setActiveTab] = useState<LoginTab>("otp");

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              CETHOS
            </h1>
            <p className="text-gray-500 mt-1">Vendor Portal</p>
          </div>

          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab("otp")}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === "otp"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Email Code
            </button>
            <button
              onClick={() => setActiveTab("password")}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === "password"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Password
            </button>
          </div>

          {activeTab === "otp" ? (
            <OtpLoginForm />
          ) : (
            <PasswordLoginForm onSwitchToOtp={() => setActiveTab("otp")} />
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Need access?{" "}
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
