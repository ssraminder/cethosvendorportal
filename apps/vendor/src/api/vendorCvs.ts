// Vendor CV upload & history.
//
// These endpoints hit Supabase Edge Functions directly (not via the
// /sb Netlify proxy) because file upload uses multipart/form-data,
// which is a CORS-safelisted Content-Type — no preflight, so direct
// calls work without the proxy. The list/download URL endpoint also
// goes direct for symmetry.

import { FUNCTIONS_BASE } from "./functionsBase";

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
  const form = new FormData();
  form.append("cv", file);
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
