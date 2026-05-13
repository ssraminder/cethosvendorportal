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
import html2canvas from "html2canvas";
import { Loader2, X as XIcon, Camera, CheckCircle2, AlertCircle, Bug } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getConsoleLogs } from "../../lib/consoleCapture";
import { FUNCTIONS_BASE } from "../../api/functionsBase";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ANON_KEY: string =
  (import.meta as { env?: { VITE_SUPABASE_ANON_KEY?: string } }).env?.VITE_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtem95ZXp2c2pnc3h2ZW9ha2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDkzNTIsImV4cCI6MjA4NDQyNTM1Mn0.6XtRrAuganzIb65FbG_NKQ8JuOxoPLSXBYsffZg2Y3c";

export function BugReportModal({ open, onClose }: Props) {
  const { sessionToken, vendor } = useVendorAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeConsole, setIncludeConsole] = useState(true);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Reset state on each open
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setIncludeScreenshot(true);
      setIncludeConsole(true);
      setScreenshotDataUrl(null);
      setError(null);
      setSubmitted(false);
    }
  }, [open]);

  async function captureScreenshot() {
    setCapturing(true);
    setError(null);
    try {
      // Hide the modal itself during capture so the screenshot reflects
      // what the user was actually seeing, not this dialog.
      const root = document.getElementById("bug-report-modal-root");
      const prev = root?.style.visibility;
      if (root) root.style.visibility = "hidden";
      // Small delay so the browser repaints without the modal first.
      await new Promise((r) => setTimeout(r, 80));
      const canvas = await html2canvas(document.body, {
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      if (root) root.style.visibility = prev ?? "";
      // Cap dimensions to keep PNG size sane.
      const MAX_W = 1600;
      const target = document.createElement("canvas");
      const scale = canvas.width > MAX_W ? MAX_W / canvas.width : 1;
      target.width = Math.round(canvas.width * scale);
      target.height = Math.round(canvas.height * scale);
      const ctx = target.getContext("2d");
      if (ctx) ctx.drawImage(canvas, 0, 0, target.width, target.height);
      setScreenshotDataUrl(target.toDataURL("image/png"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screenshot capture failed");
    } finally {
      setCapturing(false);
    }
  }

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

              <label className="flex items-start gap-2 p-2.5 rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={includeScreenshot}
                  onChange={(e) => {
                    setIncludeScreenshot(e.target.checked);
                    if (!e.target.checked) setScreenshotDataUrl(null);
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Include a screenshot of this page
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Captured client-side. Sensitive fields visible on the page will be in the image — review before sending.
                  </p>
                  {includeScreenshot && !screenshotDataUrl && (
                    <button
                      type="button"
                      onClick={captureScreenshot}
                      disabled={capturing}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
                    >
                      {capturing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                      {capturing ? "Capturing…" : "Capture screenshot"}
                    </button>
                  )}
                  {includeScreenshot && screenshotDataUrl && (
                    <div className="mt-2 space-y-1">
                      <img
                        src={screenshotDataUrl}
                        alt="Bug report screenshot preview"
                        className="max-h-48 w-auto border border-gray-200 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshotDataUrl(null)}
                        className="text-[11px] text-gray-500 hover:text-gray-700"
                      >
                        Discard and recapture
                      </button>
                    </div>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2 p-2.5 rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={includeConsole}
                  onChange={(e) => setIncludeConsole(e.target.checked)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">Include recent console output</div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Last 100 entries from this session ({getConsoleLogs().length} captured). Helps us debug. Doesn't include passwords or other secrets the app doesn't log.
                  </p>
                </div>
              </label>

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
