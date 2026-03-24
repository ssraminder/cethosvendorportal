const BASE = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

// --- Types ---

interface JobLanguage {
  id: string;
  name: string;
  code: string;
}

export interface VendorJob {
  id: string;
  job_reference: string | null;
  source_language: JobLanguage | null;
  target_language: JobLanguage | null;
  domain: string | null;
  service_type: string | null;
  word_count: number | null;
  deadline: string | null;
  instructions: string | null;
  source_file_paths: string[];
  rate: number | null;
  rate_unit: string | null;
  currency: string;
  estimated_total: number | null;
  status: string;
  offered_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  delivery_file_paths: string[];
  delivery_notes: string | null;
  reviewer_notes: string | null;
  quality_score: number | null;
  created_at: string;
}

interface JobsResponse {
  success?: boolean;
  jobs?: VendorJob[];
  total?: number;
  error?: string;
}

interface JobActionResponse {
  success?: boolean;
  job?: VendorJob;
  error?: string;
}

interface SourceFilesResponse {
  success?: boolean;
  signed_urls?: { path: string; url: string }[];
  error?: string;
}

export type { JobsResponse, JobActionResponse, SourceFilesResponse };

// --- API Functions ---

export async function getJobs(
  token: string,
  filter?: { status?: string; page?: number; limit?: number }
): Promise<JobsResponse> {
  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.page) params.set("page", filter.page.toString());
  if (filter?.limit) params.set("limit", filter.limit.toString());

  const qs = params.toString();
  const res = await fetch(`${BASE}/vendor-get-jobs${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function acceptJob(
  token: string,
  jobId: string
): Promise<JobActionResponse> {
  const res = await fetch(`${BASE}/vendor-accept-job`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_id: jobId }),
  });
  return res.json();
}

export async function declineJob(
  token: string,
  jobId: string,
  reason?: string
): Promise<JobActionResponse> {
  const res = await fetch(`${BASE}/vendor-decline-job`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_id: jobId, reason }),
  });
  return res.json();
}

export async function uploadDelivery(
  token: string,
  jobId: string,
  fileBase64: string,
  fileName: string,
  fileType: string,
  notes?: string
): Promise<JobActionResponse> {
  const res = await fetch(`${BASE}/vendor-upload-delivery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_id: jobId,
      file_base64: fileBase64,
      file_name: fileName,
      file_type: fileType,
      notes,
    }),
  });
  return res.json();
}

export async function getSourceFiles(
  token: string,
  jobId: string
): Promise<SourceFilesResponse> {
  const res = await fetch(`${BASE}/vendor-get-source-files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_id: jobId }),
  });
  return res.json();
}
