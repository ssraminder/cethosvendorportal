import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryBig, Download, Loader2, FileText } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { listGuides, type VendorGuide } from "../../api/vendorGuides";

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const UNCATEGORIZED = "Other";

// A guide is "showable" if it has something to render: an embed or a file URL.
function isShowable(g: VendorGuide): boolean {
  return Boolean(g.embed_url || g.url);
}

export function GuidesPage() {
  const { sessionToken } = useVendorAuth();
  const [guides, setGuides] = useState<VendorGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listGuides(sessionToken);
      if (res.success === false) throw new Error(res.error || "Failed to load guides");
      setGuides((res.guides ?? []).filter(isShowable));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load guides");
    }
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  // Group guides by category so vendors can scan the library by topic.
  // vendor-list-guides already returns rows ordered by category → sort_order →
  // title, so insertion order preserves that ordering within each group.
  const groups = useMemo(() => {
    const byCategory = new Map<string, VendorGuide[]>();
    for (const g of guides) {
      const key = g.category?.trim() || UNCATEGORIZED;
      const bucket = byCategory.get(key) ?? [];
      bucket.push(g);
      byCategory.set(key, bucket);
    }
    return Array.from(byCategory.entries());
  }, [guides]);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-1">
        <LibraryBig className="w-6 h-6 text-teal-600" />
        <h1 className="text-xl font-semibold text-gray-900">Guides</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        How-to guides and reference materials from Cethos. Watch a walkthrough or open a document.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : guides.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No guides available yet.</div>
      ) : (
        <div className="space-y-8">
          {groups.map(([category, items]) => (
            <section key={category}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{category}</h2>
              <div className="space-y-4">
                {items.map((g) => (
                  <article key={g.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-5 pt-4 pb-3">
                      <h3 className="text-sm font-semibold text-gray-900">{g.title}</h3>
                      {g.description && <p className="text-sm text-gray-500 mt-1">{g.description}</p>}
                    </div>

                    {g.embed_url ? (
                      <div className="relative w-full aspect-video bg-gray-900">
                        <iframe
                          src={g.embed_url}
                          title={g.title}
                          className="absolute inset-0 w-full h-full"
                          frameBorder={0}
                          referrerPolicy="unsafe-url"
                          allow="clipboard-write; fullscreen; encrypted-media; picture-in-picture"
                          allowFullScreen
                          sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-forms allow-same-origin allow-presentation"
                        />
                      </div>
                    ) : null}

                    {/* A file may accompany an embed, or stand alone. */}
                    {g.url ? (
                      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0 text-gray-500">
                          <FileText className="w-4 h-4 shrink-0 text-gray-400" />
                          <span className="text-xs truncate">
                            {g.file_name ?? "Document"}{g.file_size ? ` · ${fmtSize(g.file_size)}` : ""}
                          </span>
                        </div>
                        <a href={g.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 shrink-0">
                          <Download className="w-3.5 h-3.5" /> View
                        </a>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
