import { useState, useEffect, useCallback } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getSteps } from "../../api/vendorJobs";
import { VendorSidebar } from "./VendorSidebar";
import { VendorHeader } from "./VendorHeader";
import { Loader2 } from "lucide-react";

export function VendorShell() {
  const { vendor, sessionToken, isLoading } = useVendorAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jobOfferedCount, setJobOfferedCount] = useState(0);

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
      />
      <div className="flex-1 flex flex-col min-w-0">
        <VendorHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-5 lg:p-8 overflow-auto">
          <Outlet context={{ setJobOfferedCount }} />
        </main>
      </div>
    </div>
  );
}
