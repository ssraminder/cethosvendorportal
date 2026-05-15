/**
 * BugReportModal
 *
 * Lets the vendor file a bug report from inside the portal. Captures:
 *   - title + description (free text)
 *   - the page URL + viewport size + user-agent (auto)
 *   - recent console logs (auto, via consoleCapture ring buffer)
 *   - optional screenshot — vendor takes one themselves with the OS
 *     tool and uploads here. (Auto-capture via html2canvas was tried
 *     but hit CORS on cross-origin images so was abandoned.)
 *
 * Submits to vendor-submit-bug-report. The function persists to
 * bug_reports + uploads the screenshot to the private bucket + emails
 * the staff support inbox.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, X as XIcon, Upload, CheckCircle2, AlertCircle, Bug, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { getConsoleLogs } from "../../lib/consoleCapture";
import { FUNCTIONS_BASE } from "../../api/functionsBase";
import { getSupabaseAnonKey } from "../../lib/env";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export function BugReportModal({ open, onClose }: Props) {
  const { sessionToken, vendor } = useVendorAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [showScreenshotHelp, setShowScreenshotHelp] = useState(false);
  const [includeConsole, setIncludeConsole] = useState(true);
  const [showConsoleHelp, setShowConsoleHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [consoleCount, setConsoleCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setShowScreenshotHelp(false);
      setIncludeConsole(true);
      setShowConsoleHelp(false);
      setError(null);
      setSubmitted(false);
      setConsoleCount(getConsoleLogs().length);
    }
  }, [open]);

  // Refresh the captured-entries counter while the modal is open so
  // the vendor sees the live buffer size, not a stale render-time read.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setConsoleCount(getConsoleLogs().length), 750);
    return () => clearInterval(id);
  }, [open]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, or WebP).");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The max is 5 MB — try cropping or saving at lower quality.`);
      return;
    }
    setError(null);
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function clearScreenshot() {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      if (screenshotFile) {
        form.append("screenshot", screenshotFile, screenshotFile.name || "screenshot.png");
      }

      const res = await fetch(`${FUNCTIONS_BASE}/vendor-submit-bug-report`, {
        method: "POST",
        headers: (() => {
          const key = getSupabaseAnonKey();
          return { apikey: key, Authorization: `Bearer ${key}` };
        })(),
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

              <div className="p-3 rounded border border-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Screenshot (optional)
                    <button
                      type="button"
                      onClick={() => setShowScreenshotHelp((s) => !s)}
                      className="text-gray-400 hover:text-gray-600"
                      title="How to take a screenshot"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {screenshotFile && (
                    <button
                      type="button"
                      onClick={clearScreenshot}
                      className="text-[11px] text-gray-500 hover:text-gray-700 underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-500 mt-1">
                  Take a screenshot with your OS tool, save it, then upload it here. Helps us see exactly what you were looking at.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {screenshotPreview ? (
                  <div className="mt-2">
                    <img
                      src={screenshotPreview}
                      alt="Bug report screenshot preview"
                      className="max-h-48 w-auto border border-gray-200 rounded"
                    />
                    <div className="text-[11px] text-gray-500 mt-1">
                      {screenshotFile?.name} ({((screenshotFile?.size ?? 0) / 1024).toFixed(0)} KB)
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100"
                  >
                    <Upload className="w-3.5 h-3.5" /> Choose screenshot
                  </button>
                )}

                {showScreenshotHelp && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-700 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowScreenshotHelp(false)}
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 font-medium"
                    >
                      <ChevronDown className="w-3 h-3" /> Hide help
                    </button>
                    <div>
                      <div className="font-semibold text-gray-900">Windows 10 / 11</div>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Press <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">Windows + Shift + S</kbd> to open Snipping Tool</li>
                        <li>Drag to select the area you want</li>
                        <li>The snip is copied — click the notification or open Snipping Tool to save it (PNG)</li>
                        <li>Click "Choose screenshot" above and pick the saved file</li>
                      </ol>
                      <p className="mt-1 text-gray-600">Or: <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">PrtScn</kbd> → paste into Paint → File → Save As → PNG.</p>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">macOS</div>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Press <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">⌘ + Shift + 4</kbd> and drag to select an area (or <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">⌘ + Shift + 3</kbd> for full screen)</li>
                        <li>The file is saved to your Desktop as <span className="font-mono">Screenshot …png</span></li>
                        <li>Click "Choose screenshot" above and pick the file</li>
                      </ol>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">iPhone / iPad</div>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Press <strong>Side button + Volume Up</strong> at the same time (or Home + Power on older devices)</li>
                        <li>Tap the thumbnail → Done → Save to Photos</li>
                        <li>Tap "Choose screenshot" above and pick from your photo library</li>
                      </ol>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Android</div>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Press <strong>Power + Volume Down</strong> together</li>
                        <li>The screenshot saves to your gallery (Screenshots album)</li>
                        <li>Tap "Choose screenshot" above and pick the image</li>
                      </ol>
                    </div>
                    <p className="text-gray-600">Max 5 MB. PNG, JPG, or WebP. Sensitive info visible in the shot will be included — review before uploading.</p>
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
                      Last 100 entries from this session ({consoleCount} captured — includes app logs and any failed network calls). Helps us debug. Doesn't include passwords or other secrets the app doesn't log.
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
