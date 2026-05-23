import { FUNCTIONS_BASE } from "./functionsBase";

const BASE = FUNCTIONS_BASE;

// Post-login data endpoints route through the same-origin /sb/* proxy
// (Netlify Function → Postgres). Same trick as the auth flow: session_token
// in the body keeps it a CORS simple-request and bypasses regions where
// *.supabase.co is blocked.
const SB_BASE = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "/sb"
  : null;

async function postSb<T>(sbPath: string, body: unknown): Promise<T> {
  if (SB_BASE) {
    const res = await fetch(`${SB_BASE}/${sbPath}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  }
  // Local dev fallback: not used; the live deploy always has SB_BASE.
  // Throwing here would break `vite dev`, so we just route to BASE with
  // the same body. The dev-time Supabase function honours session_token
  // either way.
  const res = await fetch(`${BASE}/${sbPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

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
  pricing_mode?: "per_unit" | "target";
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
  offer_id: string | null;
  expires_at: string | null;
  is_rush: boolean;
  negotiation_allowed: boolean;
  counter_status: string; // 'none' | 'proposed' | 'accepted' | 'rejected'
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

// --- Job Detail Types ---

export interface JobDetailJob {
  step_id: string;
  step_number: number;
  step_name: string;
  status: string;
  actor_type: string;
  workflow_position: string;
  workflow_template: string;
  total_steps: number;
  order_number: string;
  is_rush: boolean;
  estimated_delivery_date: string | null;
  // Full-instant promised delivery (TIMESTAMPTZ). Preferred over the
  // DATE-only field when present; legacy orders still only carry the date.
  estimated_delivery_at: string | null;
  service_name: string;
  source_language: string | null;
  target_language: string | null;
  vendor_rate: number | null;
  vendor_rate_unit: string | null;
  vendor_total: number | null;
  vendor_currency: string;
  pricing_mode?: "per_unit" | "target";
  deadline: string | null;
  expires_at: string | null;
  offered_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  instructions: string | null;
  rejection_reason: string | null;
  notes_from_vendor: string | null;
  revision_count: number;
  requires_file_upload: boolean;
  offer_id: string | null;
  offer_status: string | null;
  customer_name: string | null;
  negotiation_allowed: boolean;
  counter_status: string; // 'none' | 'proposed' | 'accepted' | 'rejected'
}

export interface VolumeDocument {
  filename: string;
  word_count: number;
  page_count: number;
}

export interface JobDetailVolume {
  total_files: number;
  total_word_count: number;
  total_page_count: number;
  documents: VolumeDocument[];
}

export interface JobDetailFile {
  filename: string;
  storage_path: string;
  file_size?: number;
  mime_type?: string;
  download_url: string;
  source?: string;
  file_label?: string | null;
}

export interface JobDetailProject {
  project_number: string;
  vendor_notes: string | null;
  prior_task_count: number;
}

export interface JobDetailResponse {
  success: boolean;
  job: JobDetailJob;
  project?: JobDetailProject | null;
  volume: JobDetailVolume | null;
  source_files: JobDetailFile[];
  reference_files: JobDetailFile[];
  delivered_files: JobDetailFile[];
  error?: string;
}

// --- API Functions ---

export async function getSteps(
  token: string,
  tab: TabKey
): Promise<StepJobsResponse> {
  return postSb<StepJobsResponse>("get-jobs", { session_token: token, tab });
}

/** @deprecated Use getSteps instead */
export const getJobs = (token: string) => getSteps(token, "offered");

export async function acceptStep(
  token: string,
  stepId: string,
  offerId?: string | null
): Promise<{ status: number; data: StepActionResponse }> {
  // postSb doesn't expose status; the caller only branches on data.success
  // for /sb routes. We keep the same return shape for compatibility.
  const data = await postSb<StepActionResponse>("accept-step", {
    session_token: token,
    step_id: stepId,
    offer_id: offerId || null,
  });
  return { status: data.success ? 200 : 400, data };
}

export async function acceptDirectAssign(
  token: string,
  stepId: string
): Promise<{ status: number; data: StepActionResponse }> {
  const data = await postSb<StepActionResponse>("accept-direct-assign", {
    session_token: token,
    step_id: stepId,
  });
  return { status: data.success ? 200 : 400, data };
}

export async function declineStep(
  token: string,
  stepId: string,
  reason?: string,
  offerId?: string | null
): Promise<StepActionResponse> {
  return postSb<StepActionResponse>("decline-step", {
    session_token: token,
    step_id: stepId,
    reason: reason || null,
    offer_id: offerId || null,
  });
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

export async function getJobDetail(
  token: string,
  stepId: string,
  offerId: string | null
): Promise<JobDetailResponse> {
  return postSb<JobDetailResponse>("get-job-detail", {
    session_token: token,
    step_id: stepId,
    offer_id: offerId,
  });
}

// --- Counter-Offer Types & API ---

export interface CounterOfferPayload {
  offer_id: string;
  step_id: string;
  counter_rate: number | null;
  counter_rate_unit: string | null;
  counter_total: number | null;
  counter_currency: string;
  counter_deadline: string | null;
  counter_note: string;
}

export interface CounterOfferResponse {
  success: boolean;
  auto_accepted?: boolean;
  auto_assigned?: boolean;
  error?: string;
}

export async function submitCounterOffer(
  token: string,
  payload: CounterOfferPayload
): Promise<{ status: number; data: CounterOfferResponse }> {
  const res = await fetch(`${BASE}/vendor-counter-offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data: CounterOfferResponse = await res.json();
  return { status: res.status, data };
}
