const BASE = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

interface VendorProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  vendor_type: string | null;
  country: string | null;
  availability_status: string | null;
}

interface AuthCheckResponse {
  exists: boolean;
  has_phone: boolean;
  has_password: boolean;
  is_first_login: boolean;
  error?: string;
}

interface OtpSendResponse {
  success?: boolean;
  channel?: string;
  masked_contact?: string;
  error?: string;
  detail?: unknown;
}

interface AuthResponse {
  success?: boolean;
  session_token?: string;
  expires_at?: string;
  vendor?: VendorProfile;
  must_reset?: boolean;
  needs_password?: boolean;
  is_first_login?: boolean;
  error?: string;
}

interface SessionResponse {
  vendor?: VendorProfile;
  session?: { expires_at: string; last_seen_at: string };
  is_first_login?: boolean;
  needs_password?: boolean;
  error?: string;
}

interface SimpleResponse {
  success?: boolean;
  error?: string;
}

export type {
  VendorProfile,
  AuthCheckResponse,
  OtpSendResponse,
  AuthResponse,
  SessionResponse,
};

export async function checkVendor(email: string): Promise<AuthCheckResponse> {
  const res = await fetch(`${BASE}/vendor-auth-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function sendOtp(
  email: string,
  channel: "email" | "sms"
): Promise<OtpSendResponse> {
  const res = await fetch(`${BASE}/vendor-auth-otp-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, channel }),
  });
  return res.json();
}

export async function verifyOtp(
  email: string,
  otp_code: string
): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/vendor-auth-otp-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp_code }),
  });
  return res.json();
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/vendor-auth-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function validateSession(
  token: string
): Promise<SessionResponse> {
  const res = await fetch(`${BASE}/vendor-auth-session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function logoutSession(token: string): Promise<SimpleResponse> {
  const res = await fetch(`${BASE}/vendor-auth-logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function setPassword(
  token: string,
  password: string,
  current_password?: string
): Promise<SimpleResponse> {
  const res = await fetch(`${BASE}/vendor-set-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password, current_password }),
  });
  return res.json();
}
