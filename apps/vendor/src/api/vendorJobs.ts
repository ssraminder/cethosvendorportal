const BASE = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

// --- Types ---

export type TabKey = "offered" | "active" | "completed";

export interface VendorStep {
  id: string;
  step_number: number;
  name: string;
  actor_type: string;
  status: string;
  service_id: string | null;
  service_name: string | null;
  order_id: string | null;
  order_number: string | null;
  customer_name: string | null;
  vendor_rate: number | null;
  vendor_rate_unit: string | null;
  vendor_total: number | null;
  vendor_currency: string;
  source_language: string | null;
  target_language: string | null;
  offered_at: string;
  accepted_at: string | null;
  started_at: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  deadline: string | null;
  instructions: string | null;
  source_file_paths: string[] | null;
  delivered_file_paths: string[] | null;
  rejection_reason: string | null;
  revision_count: number;
  requires_file_upload: boolean;
  offer_count: number;
}

/** @deprecated Use VendorStep instead */
export type VendorJob = VendorStep;

export interface StepJobsResponse {
  success?: boolean;
  jobs: VendorStep[];
  counts: { offered: number; active: number; completed: number };
  error?: string;
}

export interface StepActionResponse {
  success?: boolean;
  step_id?: string;
  step_name?: string;
  new_status?: string;
  message?: string;
  files_uploaded?: number;
  upload_errors?: string[];
  error?: string;
}

interface SourceFilesResponse {
  success?: boolean;
  signed_urls?: { path: string; url: string }[];
  error?: string;
}

// --- API Functions ---

export async function getSteps(
  token: string,
  tab: TabKey
): Promise<StepJobsResponse> {
  const res = await fetch(`${BASE}/vendor-get-jobs?tab=${tab}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/** @deprecated Use getSteps instead */
export const getJobs = (token: string) => getSteps(token, "offered");

export async function acceptStep(
  token: string,
  stepId: string
): Promise<StepActionResponse> {
  const res = await fetch(`${BASE}/vendor-accept-step`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ step_id: stepId }),
  });
  return res.json();
}

export async function declineStep(
  token: string,
  stepId: string,
  reason?: string
): Promise<StepActionResponse> {
  const res = await fetch(`${BASE}/vendor-decline-step`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ step_id: stepId, reason: reason || null }),
  });
  return res.json();
}

export async function deliverStep(
  token: string,
  stepId: string,
  files: File[],
  notes?: string
): Promise<StepActionResponse> {
  const formData = new FormData();
  formData.append("step_id", stepId);
  if (notes) formData.append("notes", notes);
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(`${BASE}/vendor-deliver-step`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // Do NOT set Content-Type — browser sets it with boundary for multipart
    },
    body: formData,
  });
  return res.json();
}

export async function getSourceFiles(
  token: string,
  stepId: string
): Promise<SourceFilesResponse> {
  const res = await fetch(`${BASE}/vendor-get-source-files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ step_id: stepId }),
  });
  return res.json();
}
