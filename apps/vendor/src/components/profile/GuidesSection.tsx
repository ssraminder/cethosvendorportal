import { useState, useEffect, useCallback } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { listGuides, type VendorGuide } from "../../api/vendorGuides";
import { BookOpen, Download, Loader2 } from "lucide-react";

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GuidesSection() {
  const { sessionToken } = useVendorAuth();
  const [guides, setGuides] = useState<VendorGuide[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await listGuides(sessionToken);
      setGuides(res.documents ?? []);
    } catch {
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  // Hide the card entirely when there are no guides to show.
  if (!loading && guides.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-600" /> Guides &amp; Manuals
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Reference documents from Cethos for vendors.</p>
      </div>
      {loading ? (
        <div className="px-6 py-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {guides.map((g) => (
            <div key={g.id} className="px-6 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{g.title}</p>
                {g.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{g.description}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {g.doc_code ? `${g.doc_code} · ` : ""}{g.version ? `v${g.version}` : ""}
                  {g.file_size ? ` · ${fmtSize(g.file_size)}` : ""}
                </p>
              </div>
              {g.url ? (
                <a href={g.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 shrink-0">
                  <Download className="w-3.5 h-3.5" /> View
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
