import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getFullProfile } from "../../api/vendorProfile";
import { getJobs, type VendorJob } from "../../api/vendorJobs";
import { getInvoices } from "../../api/vendorInvoices";
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
} from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    active: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", label: "Active" },
    onboarding: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Onboarding" },
    suspended: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Suspended" },
    inactive: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: "Inactive" },
  };
  const s = map[status] ?? { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function availabilityLabel(status: string | null) {
  if (!status) return "Not set";
  const map: Record<string, string> = {
    available: "Available",
    busy: "Busy",
    unavailable: "Unavailable",
    vacation: "On vacation",
    on_leave: "On leave",
  };
  return map[status] ?? status;
}

export function VendorDashboard() {
  const { vendor, sessionToken, needsPassword } = useVendorAuth();
  const [languagePairCount, setLanguagePairCount] = useState<number | null>(null);
  const [profileCompleteness, setProfileCompleteness] = useState<number | null>(null);
  const [offeredJobs, setOfferedJobs] = useState<VendorJob[]>([]);
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [completedJobCount, setCompletedJobCount] = useState(0);
  const [pendingPayment, setPendingPayment] = useState(0);

  const loadDashboardData = useCallback(async () => {
    if (!sessionToken) return;
    try {
      // Load profile data
      const profileResult = await getFullProfile(sessionToken);
      if (profileResult.language_pairs) {
        setLanguagePairCount(profileResult.language_pairs.filter((lp) => lp.is_active).length);
      }
      if (profileResult.profile_completeness !== undefined) {
        setProfileCompleteness(profileResult.profile_completeness);
      }

      // Load jobs
      const jobsResult = await getJobs(sessionToken);
      if (jobsResult.jobs) {
        setOfferedJobs(jobsResult.jobs.filter((j) => j.status === "offered"));
        setActiveJobCount(
          jobsResult.jobs.filter((j) =>
            ["accepted", "in_progress", "delivered", "under_review", "revision_requested"].includes(j.status)
          ).length
        );
        setCompletedJobCount(
          jobsResult.jobs.filter((j) => ["approved", "completed"].includes(j.status)).length
        );
      }

      // Load invoice summary
      const invoiceResult = await getInvoices(sessionToken);
      if (invoiceResult.summary) {
        setPendingPayment(invoiceResult.summary.pending_amount);
      }
    } catch {
      // Dashboard data is supplementary — don't block on errors
    }
  }, [sessionToken]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (!vendor) return null;

  const initials = vendor.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
    { icon: CircleDot, label: "Availability", value: availabilityLabel(vendor.availability_status) },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F9DA0] to-[#0d7f82] px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="text-lg font-bold text-white">{initials}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Welcome back, {vendor.full_name}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                {statusBadge(vendor.status)}
                <span className="text-sm text-white/70">{vendor.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link to="/languages" className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Globe className="h-3.5 w-3.5" />
            Language Pairs
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {languagePairCount !== null ? languagePairCount : "—"}
          </p>
        </Link>
        <Link to="/jobs" className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Briefcase className="h-3.5 w-3.5" />
            Active Jobs
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeJobCount}</p>
        </Link>
        <Link to="/jobs" className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <FileText className="h-3.5 w-3.5" />
            Completed
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedJobCount}</p>
        </Link>
        <Link to="/invoices" className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            Pending
          </div>
          <p className="text-2xl font-bold text-amber-600">
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
            <span className="text-sm font-medium text-gray-700">Profile Completeness</span>
            <span className="text-sm font-bold text-teal-600">{profileCompleteness}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all"
              style={{ width: `${profileCompleteness}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Complete your profile to improve your chances of receiving job assignments.
          </p>
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
            <h2 className="text-sm font-semibold text-gray-900">
              Job Offers ({offeredJobs.length})
            </h2>
            <Link
              to="/jobs"
              className="text-xs text-[#0F9DA0] hover:text-[#0d7f82] font-medium"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {offeredJobs.slice(0, 3).map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {job.source_language?.name || "—"} → {job.target_language?.name || "—"}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {job.domain && <span className="capitalize">{job.domain}</span>}
                    {job.word_count && <span>{job.word_count.toLocaleString()} words</span>}
                    {job.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(job.deadline).toLocaleDateString("en-CA")}
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
            <h2 className="text-sm font-semibold text-gray-900">
              Profile Summary
            </h2>
            <Link
              to="/profile"
              className="text-xs text-[#0F9DA0] hover:text-[#0d7f82] font-medium"
            >
              View full profile
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
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <Link
            to="/profile"
            className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0F9DA0]/10 flex items-center justify-center mb-3">
              <User className="w-5 h-5 text-[#0F9DA0]" />
            </div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0F9DA0] transition-colors">
              My Profile
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              View your account details
            </p>
          </Link>

          <Link
            to="/security"
            className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0F9DA0]/10 flex items-center justify-center mb-3">
              <Shield className="w-5 h-5 text-[#0F9DA0]" />
            </div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0F9DA0] transition-colors">
              Security
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {needsPassword ? "Set up your password" : "Manage password"}
            </p>
          </Link>

          <Link
            to="/jobs"
            className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0F9DA0]/10 flex items-center justify-center mb-3">
              <Briefcase className="w-5 h-5 text-[#0F9DA0]" />
            </div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0F9DA0] transition-colors">
              Jobs
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {offeredJobs.length > 0
                ? `${offeredJobs.length} job offer${offeredJobs.length !== 1 ? "s" : ""} waiting`
                : "View your job assignments"}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
