const BASE = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

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
  tax_rate: number | null;
  preferred_rate_currency: string | null;
}

interface FullProfileResponse {
  vendor: VendorFullProfile;
  language_pairs: LanguagePair[];
  rates: VendorRate[];
  payment_info: PaymentInfo | null;
  translator_profile: TranslatorProfile | null;
  profile_completeness: number;
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

export type {
  LanguagePair,
  VendorRate,
  PaymentInfo,
  TranslatorProfile,
  CertificationEntry,
  VendorFullProfile,
  FullProfileResponse,
  AvailabilityResponse,
  PaymentInfoResponse,
  LanguagePairsResponse,
  RateChangeResponse,
  CertResponse,
  ServiceInfo,
};

// --- API Functions ---

export async function getFullProfile(token: string): Promise<FullProfileResponse> {
  const res = await fetch(`${BASE}/vendor-get-profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function updateAvailability(
  token: string,
  availability_status: string
): Promise<AvailabilityResponse> {
  const res = await fetch(`${BASE}/vendor-update-availability`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ availability_status }),
  });
  return res.json();
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
  const res = await fetch(`${BASE}/vendor-update-payment-info`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return res.json();
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
  const res = await fetch(`${BASE}/vendor-update-language-pairs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return res.json();
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
