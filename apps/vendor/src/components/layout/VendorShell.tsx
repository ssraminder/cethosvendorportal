import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { VendorSidebar } from "./VendorSidebar";
import { VendorHeader } from "./VendorHeader";
import { Loader2 } from "lucide-react";

export function VendorShell() {
  const { vendor, isLoading } = useVendorAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!vendor) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <VendorSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <VendorHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
