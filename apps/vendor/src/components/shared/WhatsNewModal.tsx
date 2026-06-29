import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RELEASE_NOTES, CURRENT_VERSION } from "../../lib/releaseNotes";

const STORAGE_KEY = "cethos_vendor_portal_seen_version";

/**
 * Shows a one-time "What's new" panel after the portal is updated to a new
 * version. We remember the last version the user acknowledged in localStorage,
 * so it appears once per user per release and never nags afterwards.
 */
export function WhatsNewModal({ aboutTo }: { aboutTo?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen && seen !== CURRENT_VERSION) {
        setOpen(true);
      } else if (!seen) {
        localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
      }
    } catch {
      // localStorage unavailable — skip silently.
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  const latest = RELEASE_NOTES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">What's new</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Version {latest.version} · {latest.date}
            </p>
          </div>
          <span className="px-2.5 py-1 bg-[#0F9DA0]/10 text-[#0F9DA0] rounded-full text-xs font-semibold">
            Updated
          </span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 mb-3">{latest.summary}</p>
          <ul className="space-y-2">
            {latest.changes.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-[#0F9DA0] mt-0.5">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          {aboutTo ? (
            <Link
              to={aboutTo}
              onClick={dismiss}
              className="text-sm text-[#0F9DA0] hover:underline font-medium"
            >
              View all updates →
            </Link>
          ) : (
            <span />
          )}
          <button
            onClick={dismiss}
            className="px-4 py-2 bg-[#0F9DA0] text-white rounded-lg hover:bg-[#0d8a8c] text-sm font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsNewModal;
