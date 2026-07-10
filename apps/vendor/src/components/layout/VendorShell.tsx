import { useState, useEffect, useCallback } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getSteps } from "../../api/vendorJobs";
import { getMyInterviews } from "../../api/vendorInterviews";
import { VendorSidebar } from "./VendorSidebar";
import { VendorHeader } from "./VendorHeader";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { BugReportFab } from "../support/BugReportFab";
import { AgreementGateModal } from "../agreements/AgreementGateModal";
import { VersionBadge } from "../shared/VersionBadge";
import { WhatsNewModal } from "../shared/WhatsNewModal";
import { Loader2 } from "lucide-react";

export function VendorShell() {
  const { vendor, sessionToken, isLoading } = useVendorAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jobOfferedCount, setJobOfferedCount] = useState(0);
  // Only moderators (vendors with an rp_interviewers record) get the Interviews
  // nav item; most vendors aren't moderators, so gate it on having ≥1 session.
  const [hasInterviews, setHasInterviews] = useState(false);

  const fetchOfferedCount = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const result = await getSteps(sessionToken, "offered");
      if (result.counts) {
        setJobOfferedCount(result.counts.offered);
      }
    } catch {
      // non-critical
    }
    try {
      // Sessions OR an open availability request both warrant the nav item —
      // a moderator asked for timings has zero sessions yet.
      const mine = await getMyInterviews(sessionToken);
      setHasInterviews(mine.sessions.length > 0 || mine.availabilityRequests.length > 0);
    } catch {
      // non-critical
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchOfferedCount();
  }, [fetchOfferedCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-[#0F9DA0] animate-spin" />
      </div>
    );
  }

  if (!vendor) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex">
      <VendorSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        jobOfferedCount={jobOfferedCount}
        hasInterviews={hasInterviews}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <ImpersonationBanner />
        <VendorHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-5 lg:p-8 overflow-auto">
          <Outlet context={{ setJobOfferedCount }} />
        </main>
        <footer className="border-t border-gray-200 bg-white py-3 px-5 lg:px-8 flex items-center justify-between text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} Cethos Solutions Inc.</span>
          <VersionBadge to="/about" />
        </footer>
      </div>
      <BugReportFab />
      <AgreementGateModal />
      <WhatsNewModal aboutTo="/about" />
    </div>
  );
}
