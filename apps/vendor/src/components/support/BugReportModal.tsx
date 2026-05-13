/**
 * BugReportModal
 *
 * Lets the vendor file a bug report from inside the portal. Captures:
 *   - title + description (free text)
 *   - the page URL + viewport size + user-agent (auto)
 *   - recent console logs (auto, via consoleCapture ring buffer)
 *   - optional PNG screenshot (auto-captured via html2canvas)
 *
 * Submits to vendor-submit-bug-report. The function persists to
 * bug_reports + uploads the screenshot to the private bucket + emails
 * the staff support inbox.
 */

import { useEffect, useState } from "react";
import { Loader2, X as XIcon, Camera, CheckCircle2, AlertCircle, Bug, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getConsoleLogs } from "../../lib/consoleCapture";
import { FUNCTIONS_BASE } from "../../api/functionsBase";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Screenshot data-URL pre-captured by the caller before opening the
   *  modal. Pre-capture avoids needing the modal to hide itself during
   *  the snap, which previously felt like the modal was closing. */
  initialScreenshot?: string | null;
}

const ANON_KEY: string =
  (import.meta as { env?: { VITE_SUPABASE_ANON_KEY?: string } }).env?.VITE_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtem95ZXp2c2pnc3h2ZW9ha2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDkzNTIsImV4cCI6MjA4NDQyNTM1Mn0.6XtRrAuganzIb65FbG_NKQ8JuOxoPLSXBYsffZg2Y3c";

export function BugReportModal({ open, onClose, initialScreenshot }: Props) {
  const { sessionToken, vendor } = useVendorAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeConsole, setIncludeConsole] = useState(true);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [showConsoleHelp, setShowConsoleHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Reset state on each open; absorb the caller-supplied pre-captured
  // screenshot if one was passed.
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setIncludeScreenshot(true);
      setIncludeConsole(true);
      setScreenshotDataUrl(initialScreenshot ?? null);
      setShowConsoleHelp(false);
      setError(null);
      setSubmitted(false);
    }
  }, [open, initialScreenshot]);

  async function handleSubmit() {
    if (!sessionToken) { setError("Please sign in first."); return; }
    if (title.trim().length < 3) { setError("Title is required."); return; }
    if (description.trim().length < 10) { setError("Please describe what happened (10+ chars)."); return; }

    setSubmitting(true);
    setError(null);
    try {
      const consoleLogs = includeConsole ? getConsoleLogs() : null;
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      };

      const form = new FormData();
      form.append("session_token", sessionToken);
      form.append("title", title.trim());
      form.append("description", description.trim());
      form.append("url", window.location.href);
      form.append("user_agent", navigator.userAgent);
      form.append("viewport", JSON.stringify(viewport));
      if (consoleLogs) form.append("console_logs", JSON.stringify(consoleLogs));
      if (includeScreenshot && screenshotDataUrl) {
        // Strip the data-URL prefix and convert to Blob for upload.
        const base64 = screenshotDataUrl.split(",")[1] ?? "";
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        form.append("screenshot", new Blob([bytes], { type: "image/png" }), "screenshot.png");
      }

      const res = await fetch(`${FUNCTIONS_BASE}/vendor-submit-bug-report`, {
        method: "POST",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div id="bug-report-modal-root" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-semibold text-gray-900">Report a bug</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {submitted ? (
            <div className="flex items-start gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm text-emerald-900">
                <strong>Thanks — bug report sent.</strong>
                <p className="mt-1 text-emerald-800">
                  We've logged it with the page URL, your browser info, and the recent console output. If we need more detail we'll reach out at <span className="font-mono">{vendor?.email}</span>.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Short title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Upload PDF button does nothing"
                  maxLength={120}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">What happened? *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="What were you trying to do, what did you expect, and what actually happened? Steps to reproduce help us a lot."
                  maxLength={4000}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                />
              </div>

              <div className="p-2.5 rounded border border-gray-200">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeScreenshot}
                    onChange={(e) => setIncludeScreenshot(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> Include a screenshot of this page
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Captured automatically when you opened this dialog. Sensitive fields visible on the page will be in the image — review before sending.
                    </p>
                  </div>
                </label>
                {includeScreenshot && screenshotDataUrl && (
                  <div className="mt-2 ml-6">
                    <img
                      src={screenshotDataUrl}
                      alt="Bug report screenshot preview"
                      className="max-h-48 w-auto border border-gray-200 rounded"
                    />
                  </div>
                )}
                {includeScreenshot && !screenshotDataUrl && (
                  <div className="mt-2 ml-6 text-[11px] text-amber-700">
                    Screenshot capture didn't succeed for this page. The report will go through without an image.
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded border border-gray-200">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeConsole}
                    onChange={(e) => setIncludeConsole(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                      Include recent console output
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowConsoleHelp((s) => !s); }}
                        className="text-gray-400 hover:text-gray-600"
                        title="How to copy console output manually"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Last 100 entries from this session ({getConsoleLogs().length} captured). Helps us debug. Doesn't include passwords or other secrets the app doesn't log.
                    </p>
                  </div>
                </label>
                {showConsoleHelp && (
                  <div className="mt-2 ml-6 p-3 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-700 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowConsoleHelp(false)}
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
                    >
                      <ChevronDown className="w-3 h-3" /> Hide help
                    </button>
                    <p>
                      <strong>The checkbox above captures console output automatically.</strong> If you'd rather paste it in by hand (e.g. to add extra error context), here's how:
                    </p>
                    <div>
                      <div className="font-semibold text-gray-900">Chrome / Edge / Brave</div>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Press <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">F12</kbd> (Windows/Linux) or <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">⌘+Opt+I</kbd> (Mac)</li>
                        <li>Click the <strong>Console</strong> tab</li>
                        <li>Right-click anywhere in the console area → <strong>Save as…</strong> (or select all + <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">⌘/Ctrl+C</kbd>)</li>
                        <li>Paste it into the description above</li>
                      </ol>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Firefox</div>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Press <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">F12</kbd> or <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">⌘+Opt+K</kbd></li>
                        <li>Click the <strong>Console</strong> tab</li>
                        <li>Right-click → <strong>Export Visible Messages To</strong> → File or Clipboard</li>
                      </ol>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Safari</div>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Enable the Develop menu: <strong>Safari → Settings → Advanced → Show Develop menu</strong></li>
                        <li>Press <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">⌘+Opt+C</kbd> to open the Console</li>
                        <li>Select messages and copy with <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">⌘+C</kbd></li>
                      </ol>
                    </div>
                  </div>
                )}
                {!showConsoleHelp && (
                  <button
                    type="button"
                    onClick={() => setShowConsoleHelp(true)}
                    className="mt-1.5 ml-6 inline-flex items-center gap-1 text-[11px] text-teal-700 hover:text-teal-900"
                  >
                    <ChevronRight className="w-3 h-3" /> How do I copy console output myself?
                  </button>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-100">
          {submitted ? (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !sessionToken}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Send report
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
