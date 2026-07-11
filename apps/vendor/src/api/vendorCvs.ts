// Vendor CV upload & history.
//
// Routed through the same-origin /sb/* Netlify proxy so vendors in
// geo-blocked regions (Pakistan confirmed 2026-05-16) can still
// upload their CV — the previous direct fetch to api.cethos.com hit
// a network-level "Failed to fetch" for those users. The Lambda's
// outbound call to the Supabase edge function isn't subject to the
// browser-side geo restriction.
//
// Local dev (no Netlify proxy) falls back to FUNCTIONS_BASE.

import { FUNCTIONS_BASE } from "./functionsBase";
import { convertDocxToPdf, isDocxFile, isPdfFile } from "../lib/convertDocxToPdf";

const SB_BASE =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "/sb"
    : null;

export interface VendorCv {
  id: string;
  version: number;
  file_name: string;
  file_size_bytes: number | null;
  content_type: string | null;
  uploaded_by_vendor: boolean;
  uploaded_by_staff_id: string | null;
  notes: string | null;
  is_current: boolean;
  superseded_at: string | null;
  created_at: string;
  download_url: string | null;
  preview_url: string | null;
}

export interface UploadResult {
  success: boolean;
  cv?: {
    id: string;
    version: number;
    file_name: string;
    file_size_bytes: number | null;
    notes: string | null;
    created_at: string;
  };
  error?: string;
  detail?: string;
}

export interface ListResult {
  success: boolean;
  cvs?: VendorCv[];
  error?: string;
}

export async function uploadCv(
  sessionToken: string,
  file: File,
  notes: string | null,
): Promise<UploadResult> {
  // The backend stores the PDF as the primary CV blob. If the vendor
  // picks a .docx we convert in the browser AND ship the original docx
  // alongside, so the source is preserved (re-render if conversion
  // improves; staff fallback if rendering loses anything).
  // Hard size guard. The UI advertises 10 MB, and the Netlify proxy path
  // rejects oversized bodies at the platform layer with a non-JSON error
  // page — which previously surfaced as a silent/opaque failure (bug
  // reports: "picked my PDF and nothing happened").
  const MAX_CV_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_CV_BYTES) {
    return {
      success: false,
      error: `Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB. Try compressing the PDF or exporting it at a lower quality.`,
    };
  }

  let toUpload = file;
  let sourceDocx: File | null = null;
  if (isDocxFile(file)) {
    try {
      toUpload = await convertDocxToPdf(file);
      sourceDocx = file;
    } catch (e) {
      return {
        success: false,
        error: "Couldn't convert your Word file to PDF. Please save the document as PDF and upload that instead.",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  } else if (!isPdfFile(file)) {
    return {
      success: false,
      error: "Please upload your CV as a PDF or Word (.docx) file.",
    };
  }

  const form = new FormData();
  form.append("cv", toUpload);
  if (sourceDocx) form.append("source_docx", sourceDocx);
  if (notes) form.append("notes", notes);
  // multipart/form-data is CORS-safelisted; the browser sets the
  // boundary header itself. Don't set Content-Type manually.
  const url = SB_BASE
    ? `${SB_BASE}/upload-cv`
    : `${FUNCTIONS_BASE}/vendor-upload-cv`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: form,
  });
  // The proxy (or the platform in front of it) can answer with a non-JSON
  // error page — e.g. when the request body exceeds the Lambda payload cap.
  // An unguarded res.json() here used to throw and swallow the real cause.
  let parsed: UploadResult | null = null;
  try {
    parsed = (await res.json()) as UploadResult;
  } catch {
    parsed = null;
  }
  if (parsed) return parsed;
  return {
    success: false,
    error:
      res.status === 413 || res.status === 502
        ? "The upload was rejected because the file is too large for our upload service. Please compress the PDF (under ~4 MB is safest) and try again."
        : `Upload failed (HTTP ${res.status}). Please try again, or email your CV to vm@cethos.com if it keeps failing.`,
  };
}

export async function listCvs(sessionToken: string): Promise<ListResult> {
  // /sb/list-cvs is the Netlify proxy; it expects session_token in the
  // body (text/plain → CORS-simple) and forwards as Authorization:
  // Bearer to the upstream Supabase edge function.
  if (SB_BASE) {
    const res = await fetch(`${SB_BASE}/list-cvs`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ session_token: sessionToken }),
    });
    return (await res.json()) as ListResult;
  }
  const res = await fetch(`${FUNCTIONS_BASE}/vendor-list-cvs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  return (await res.json()) as ListResult;
}
