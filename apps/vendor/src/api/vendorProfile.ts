import { FUNCTIONS_BASE } from "./functionsBase";

const BASE = FUNCTIONS_BASE;

// Profile + rates endpoints route through the same-origin /sb/* proxy
// (Netlify Function → Postgres). session_token in the body keeps it a
// CORS simple-request and bypasses regions where *.supabase.co (or
// api.cethos.com, same CF backend) is blocked.
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
  // Local dev: hit Supabase Edge Function directly.
  const res = await fetch(`${BASE}/${sbPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

// --- Types ---

interface LanguagePair {
  id: string;
  source_language: string;
  target_language: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface ServiceInfo {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface VendorRate {
  id: string;
  service_id: string;
  language_pair_id: string | null;
  calculation_unit: string;
  rate: number;
  currency: string;
  rate_cad: number | null;
  minimum_charge: number | null;
  minimum_charge_unit: string | null;
  source: string;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  service: ServiceInfo | null;
}

interface PaymentInfo {
  id: string;
  payment_currency: string;
  payment_method: string | null;
  invoice_notes: string | null;
  updated_at: string;
}

interface TranslatorProfile {
  id: string;
  tier: string | null;
  profile_completeness: number;
  bio: string | null;
  approved_combinations: unknown[];
  cat_tools: string[];
  profile_photo_url: string | null;
}

interface CertificationEntry {
  name: string;
  expiry_date: string | null;
  storage_path: string | null;
  added_at: string;
  verified: boolean;
}

interface VendorFullProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  vendor_type: string | null;
  country: string | null;
  province_state: string | null;
  city: string | null;
  availability_status: string;
  certifications: CertificationEntry[] | null;
  years_experience: number | null;
  rate_per_page: number | null;
  rate_currency: string;
  specializations: unknown;
  minimum_rate: number | null;
  total_projects: number;
  last_project_date: string | null;
  rating: number | null;
  tax_id: string | null;
  tax_name: string | null;
  tax_rate: number | null;
  preferred_rate_currency: string | null;
  native_languages: string[] | null;
  contractor_type: "individual" | "business";
}

interface ContractorUpgradeRequest {
  id: string;
  from_type: string;
  to_type: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requested_at: string;
  vendor_justification: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
}

interface ContractorUpgradeResponse extends SimpleResponse {
  request?: ContractorUpgradeRequest;
}

interface FullProfileResponse {
  vendor: VendorFullProfile;
  language_pairs: LanguagePair[];
  rates: VendorRate[];
  payment_info: PaymentInfo | null;
  translator_profile: TranslatorProfile | null;
  profile_completeness: number;
  completed_steps?: Record<string, boolean>;
  contractor_upgrade_request?: ContractorUpgradeRequest | null;
  error?: string;
}

interface SimpleResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

interface AvailabilityResponse extends SimpleResponse {
  availability_status?: string;
}

interface PaymentInfoResponse extends SimpleResponse {
  payment_info?: PaymentInfo;
}

interface LanguagePairsResponse extends SimpleResponse {
  language_pairs?: LanguagePair[];
}

interface RateChangeResponse extends SimpleResponse {
  change_request?: {
    rate_id: string;
    current_rate: number;
    proposed_rate: number;
    status: string;
  };
}

interface CertResponse extends SimpleResponse {
  certifications?: CertificationEntry[];
}

// --- Tax / Province types ---

interface Province {
  region_code: string;
  region_name: string;
  tax_name: string;
  rate: string;
}

interface ProvincesResponse {
  success?: boolean;
  provinces?: Province[];
  error?: string;
}

interface TaxLookupResponse {
  success?: boolean;
  tax_name?: string;
  tax_rate?: number;
  error?: string;
}

// --- Manage Rates types ---

interface ServiceOption {
  id: string;
  code: string;
  name: string;
  category: string;
  default_calculation_units: string[];
}

interface ManagedRate {
  id: string;
  service_id: string;
  service_name: string;
  service_code: string;
  service_category: string;
  calculation_unit: string;
  rate: number;
  currency: string;
  minimum_charge: number | null;
  is_active: boolean;
  notes: string | null;
  source: string;
  language_pair_id: string | null;
  source_language: string | null;
  target_language: string | null;
}

interface ManageRatesResponse extends SimpleResponse {
  rates?: ManagedRate[];
  services_by_category?: Record<string, ServiceOption[]>;
  preferred_rate_currency?: string;
  rate_id?: string;
  language_pairs?: LanguagePair[];
  count?: number;
  skipped?: number;
}

export type {
  LanguagePair,
  VendorRate,
  PaymentInfo,
  TranslatorProfile,
  CertificationEntry,
  VendorFullProfile,
  FullProfileResponse,
  ContractorUpgradeRequest,
  ContractorUpgradeResponse,
  AvailabilityResponse,
  PaymentInfoResponse,
  LanguagePairsResponse,
  RateChangeResponse,
  CertResponse,
  ServiceInfo,
  Province,
  ProvincesResponse,
  TaxLookupResponse,
  ServiceOption,
  ManagedRate,
  ManageRatesResponse,
};

// --- API Functions ---

export async function getFullProfile(token: string): Promise<FullProfileResponse> {
  return postSb<FullProfileResponse>("get-profile", { session_token: token });
}

export async function updateAvailability(
  token: string,
  availability_status: string
): Promise<AvailabilityResponse> {
  return postSb<AvailabilityResponse>("update-availability", {
    session_token: token,
    availability_status,
  });
}

export async function updatePaymentInfo(
  token: string,
  data: {
    payment_method?: string;
    payment_details?: Record<string, unknown>;
    payment_currency?: string;
    invoice_notes?: string;
  }
): Promise<PaymentInfoResponse> {
  return postSb<PaymentInfoResponse>("update-payment-info", { session_token: token, ...data });
}

export async function updateLanguagePairs(
  token: string,
  data: {
    action: "add" | "remove" | "toggle";
    language_pair_id?: string;
    source_language?: string;
    target_language?: string;
    notes?: string;
  }
): Promise<LanguagePairsResponse> {
  return postSb<LanguagePairsResponse>("update-language-pairs", { session_token: token, ...data });
}

export async function updateRates(
  token: string,
  data: {
    rate_id: string;
    proposed_rate: number;
    proposed_currency?: string;
    notes?: string;
  }
): Promise<RateChangeResponse> {
  // vendor-update-rates wasn't ported in Phase 3 — the "rate change request"
  // flow is admin-mediated and rarely used. Keep on the Supabase Edge path
  // for now; if blocked-region vendors need it we'll port in Phase 4.
  const res = await fetch(`${BASE}/vendor-update-rates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function uploadCertification(
  token: string,
  data: {
    action: "add" | "remove";
    cert_name: string;
    expiry_date?: string;
    file_base64?: string;
    file_name?: string;
    file_type?: string;
  }
): Promise<CertResponse> {
  const res = await fetch(`${BASE}/vendor-upload-certification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

// --- Tax Rate Lookup ---

export async function lookupProvinces(): Promise<ProvincesResponse> {
  return postSb<ProvincesResponse>("lookup-tax-rate", {});
}

export async function lookupTaxRate(provinceCode: string): Promise<TaxLookupResponse> {
  return postSb<TaxLookupResponse>("lookup-tax-rate", { province_code: provinceCode });
}

// --- Manage Rates (CRUD) ---

export async function requestContractorUpgrade(
  token: string,
  data: { action: "submit" | "withdraw"; justification?: string },
): Promise<ContractorUpgradeResponse> {
  return postSb<ContractorUpgradeResponse>("request-contractor-upgrade", {
    session_token: token,
    ...data,
  });
}

export async function manageRates(
  token: string,
  data: {
    action: "get" | "add" | "update" | "remove";
    service_id?: string;
    calculation_unit?: string;
    rate?: number;
    currency?: string;
    minimum_charge?: number;
    notes?: string;
    rate_id?: string;
    language_pair_ids?: string[];
  }
): Promise<ManageRatesResponse> {
  return postSb<ManageRatesResponse>("manage-rates", { session_token: token, ...data });
}
