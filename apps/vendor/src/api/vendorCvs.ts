// Vendor CV upload & history.
//
// These endpoints hit Supabase Edge Functions directly (not via the
// /sb Netlify proxy) because file upload uses multipart/form-data,
// which is a CORS-safelisted Content-Type — no preflight, so direct
// calls work without the proxy. The list/download URL endpoint also
// goes direct for symmetry.

import { FUNCTIONS_BASE } from "./functionsBase";
import { convertDocxToPdf, isDocxFile, isPdfFile } from "../lib/convertDocxToPdf";

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
  const res = await fetch(`${FUNCTIONS_BASE}/vendor-upload-cv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: form,
  });
  return (await res.json()) as UploadResult;
}

export async function listCvs(sessionToken: string): Promise<ListResult> {
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
