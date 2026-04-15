import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getFullProfile, updateAvailability } from "../../api/vendorProfile";
import { getSteps, type VendorStep } from "../../api/vendorJobs";
import { getInvoices } from "../../api/vendorInvoices";
import { LANGUAGES } from "../../data/languages";
import {
  User,
  Shield,
  Mail,
  Globe,
  Phone,
  CircleDot,
  KeyRound,
  Briefcase,
  DollarSign,
  Clock,
  FileText,
  ChevronRight,
  Camera,
  CalendarCheck,
  Languages,
  Settings,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

function getLanguageName(code: string | null): string {
  if (!code) return "—";
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; dot: string; border: string; label: string }> = {
    active: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", border: "border-green-100", label: "Active" },
    onboarding: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-100", label: "Onboarding" },
    suspended: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", border: "border-red-100", label: "Suspended" },
    inactive: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", border: "border-gray-200", label: "Inactive" },
  };
  const s = map[status] ?? { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", border: "border-gray-200", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text} border ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "unavailable", label: "Unavailable" },
  { value: "vacation", label: "On vacation" },
  { value: "on_leave", label: "On leave" },
] as const;

const PROFILE_STEPS = [
  { key: "photo", label: "Add a profile photo", icon: Camera },
  { key: "availability", label: "Set your availability", icon: CalendarCheck },
  { key: "languages", label: "Add language pairs", icon: Languages },
  { key: "rates", label: "Configure services & rates", icon: Settings },
  { key: "payment", label: "Add payment information", icon: CreditCard },
] as const;

export function VendorDashboard() {
  const { vendor, sessionToken, needsPassword, setVendor } = useVendorAuth();
  const [languagePairCount, setLanguagePairCount] = useState<number | null>(null);
  const [profileCompleteness, setProfileCompleteness] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [offeredJobs, setOfferedJobs] = useState<VendorStep[]>([]);
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [completedJobCount, setCompletedJobCount] = useState(0);
  const [pendingPayment, setPendingPayment] = useState(0);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const profileResult = await getFullProfile(sessionToken);
      if (profileResult.language_pairs) {
        setLanguagePairCount(profileResult.language_pairs.filter((lp: { is_active: boolean }) => lp.is_active).length);
      }
      if (profileResult.profile_completeness !== undefined) {
        setProfileCompleteness(profileResult.profile_completeness);
      }
      if (profileResult.completed_steps) {
        setCompletedSteps(profileResult.completed_steps);
      }

      const [offeredResult, activeResult, completedResult] = await Promise.all([
        getSteps(sessionToken, "offered"),
        getSteps(sessionToken, "active"),
        getSteps(sessionToken, "completed"),
      ]);

      if (offeredResult.jobs) setOfferedJobs(offeredResult.jobs);
      if (activeResult.counts) setActiveJobCount(activeResult.counts.active);
      if (completedResult.counts) setCompletedJobCount(completedResult.counts.completed);

      const invoiceResult = await getInvoices(sessionToken);
      if (invoiceResult.summary) {
        setPendingPayment(invoiceResult.summary.pending_amount);
      }
    } catch {
      // Dashboard data is supplementary
    }
  }, [sessionToken]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (!vendor) return null;

  const handleAvailabilityChange = async (newStatus: string) => {
    if (!sessionToken) return;
    setUpdatingAvailability(true);
    try {
      const result = await updateAvailability(sessionToken, newStatus);
      if (result.success && result.availability_status) {
        setVendor({ ...vendor, availability_status: result.availability_status });
      }
    } catch {
      // Non-critical
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const alerts: { icon: typeof KeyRound; message: string; link: string; linkText: string; color: string }[] = [];

  if (needsPassword) {
    alerts.push({
      icon: KeyRound,
      message: "Set up a password for faster sign-in (optional)",
      link: "/security",
      linkText: "Set password",
      color: "amber",
    });
  }
  if (!vendor.phone) {
    alerts.push({
      icon: Phone,
      message: "Add a phone number for SMS verification",
      link: "/profile",
      linkText: "View profile",
      color: "blue",
    });
  }

  const infoItems = [
    { icon: Mail, label: "Email", value: vendor.email },
    { icon: Phone, label: "Phone", value: vendor.phone || "Not provided" },
    { icon: Globe, label: "Country", value: vendor.country || "Not provided" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {vendor.full_name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s what&apos;s happening with your account
          </p>
        </div>
        {statusBadge(vendor.status)}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link to="/languages" className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Language Pairs</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Globe className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {languagePairCount !== null ? languagePairCount : "—"}
          </p>
        </Link>
        <Link to="/jobs" className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Jobs</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeJobCount}</p>
        </Link>
        <Link to="/jobs" className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedJobCount}</p>
        </Link>
        <Link to="/invoices" className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className={`text-2xl font-bold ${pendingPayment > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {pendingPayment > 0
              ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(pendingPayment)
              : "$0"}
          </p>
        </Link>
      </div>

      {/* Profile Completeness */}
      {profileCompleteness !== null && profileCompleteness < 100 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-800">Profile Completeness</h2>
            <span className="text-sm font-semibold text-teal-600">{profileCompleteness}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all"
              style={{ width: `${profileCompleteness}%` }}
            />
          </div>
          <div className="space-y-2">
            {PROFILE_STEPS.map(({ key, label, icon: StepIcon }) => {
              const done = !!completedSteps[key];
              return (
                <div key={key} className="flex items-center gap-2.5 text-sm text-gray-500">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                  )}
                  <StepIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className={done ? "line-through text-gray-400" : ""}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(({ icon: Icon, message, link, linkText, color }) => (
            <div
              key={message}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                color === "amber"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  color === "amber" ? "text-amber-600" : "text-blue-600"
                }`}
              />
              <p
                className={`text-sm flex-1 ${
                  color === "amber" ? "text-amber-800" : "text-blue-800"
                }`}
              >
                {message}
              </p>
              <Link
                to={link}
                className={`text-xs font-medium whitespace-nowrap ${
                  color === "amber"
                    ? "text-amber-700 hover:text-amber-900"
                    : "text-blue-700 hover:text-blue-900"
                }`}
              >
                {linkText} &rarr;
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Offered Jobs */}
      {offeredJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">
              Job Offers ({offeredJobs.length})
            </h2>
            <Link
              to="/jobs"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {offeredJobs.slice(0, 3).map((step) => (
              <Link
                key={step.id}
                to={`/jobs/${step.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {getLanguageName(step.source_language)} → {getLanguageName(step.target_language)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {step.service_name && <span>{step.service_name}</span>}
                    {step.order_number && <span>#{step.order_number}</span>}
                    {step.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(step.deadline).toLocaleDateString("en-CA")}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile summary */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">
              Profile Summary
            </h2>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-50 transition-colors"
            >
              Edit Profile
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {infoItems.map(({ icon: Icon, label, value }) => {
              const isEmpty = value === "Not provided" || value === "Not set";
              return (
                <div
                  key={label}
                  className="px-5 py-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">{label}</span>
                  </div>
                  <span
                    className={`text-sm ${isEmpty ? "text-gray-400 italic" : "font-medium text-gray-900"}`}
                  >
                    {value}
                  </span>
                </div>
              );
            })}
            {/* Availability toggle */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CircleDot className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Availability</span>
              </div>
              <select
                value={vendor.availability_status || "available"}
                onChange={(e) => handleAvailabilityChange(e.target.value)}
                disabled={updatingAvailability}
                className="text-sm font-medium text-gray-900 bg-transparent border border-gray-200 rounded-lg px-2 py-1 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
              >
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Quick Links</h2>
          </div>
          <div className="divide-y divide-gray-50">
            <Link
              to="/profile"
              className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer group transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <User className="w-4.5 h-4.5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                  My Profile
                </p>
                <p className="text-xs text-gray-400">View your account details</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
            </Link>

            <Link
              to="/security"
              className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer group transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                  Security
                </p>
                <p className="text-xs text-gray-400">
                  {needsPassword ? "Set up your password" : "Manage password"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
            </Link>

            <Link
              to="/jobs"
              className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer group transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <Briefcase className="w-4.5 h-4.5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                  Jobs
                </p>
                <p className="text-xs text-gray-400">
                  {offeredJobs.length > 0
                    ? `${offeredJobs.length} job offer${offeredJobs.length !== 1 ? "s" : ""} waiting`
                    : "View your job assignments"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
