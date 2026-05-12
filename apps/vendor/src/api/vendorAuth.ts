import { FUNCTIONS_BASE } from "./functionsBase";

const BASE = FUNCTIONS_BASE;

// Network errors ("Failed to fetch") happen when the request never gets a
// response — usually a regional block on supabase.co domains, an aggressive
// browser extension, or a flaky network. We surface this as a distinct
// error class so the UI can show a useful "check your network" message
// instead of the cryptic browser default.
export class NetworkUnreachableError extends Error {
  constructor(underlying: unknown) {
    const detail = underlying instanceof Error ? underlying.message : String(underlying);
    super(
      `Couldn't reach the Cethos server. This is usually a network or VPN issue (${detail}).`,
    );
    this.name = "NetworkUnreachableError";
  }
}

const FETCH_TIMEOUT_MS = 15_000;

// (Legacy postJson removed — auth now uses postAuth → /sb/* same-origin
// Netlify Function. See further down for the new helper.)

// Quick connectivity probe — used by the LoginPage's "Test connection" link
// when a vendor hits a fetch failure. Returns details we can show the user
// to help them or support figure out what's broken.
export interface ConnectivityProbe {
  reachable: boolean;
  error?: string;
  status?: number;
  duration_ms: number;
}

export async function testConnectivity(): Promise<ConnectivityProbe> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    // Hit the new same-origin auth path (Netlify Function → Postgres).
    // text/plain keeps it a CORS simple-request even though it's
    // same-origin (defense in depth).
    const probeBase = typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? "/sb"
      : BASE;
    const probeUrl = probeBase === "/sb"
      ? `${probeBase}/auth-check`
      : `${probeBase}/vendor-auth-check`;
    const res = await fetch(probeUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ email: "__connectivity_probe__@cethos.local" }),
      signal: controller.signal,
    });
    return {
      reachable: true,
      status: res.status,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

interface VendorProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  vendor_type: string | null;
  country: string | null;
  province_state: string | null;
  availability_status: string | null;
  tax_id: string | null;
  tax_name: string | null;
  tax_rate: number | null;
  preferred_rate_currency: string | null;
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
  is_impersonation?: boolean;
  impersonator?: { email: string; full_name: string | null } | null;
  error?: string;
}

interface SimpleResponse {
  success?: boolean;
  error?: string;
}

interface ProfileUpdateResponse {
  success?: boolean;
  vendor?: VendorProfile;
  error?: string;
}

interface PhoneVerifyResponse {
  success?: boolean;
  masked_phone?: string;
  vendor?: VendorProfile;
  error?: string;
  detail?: unknown;
}

export type {
  VendorProfile,
  AuthCheckResponse,
  OtpSendResponse,
  AuthResponse,
  SessionResponse,
  ProfileUpdateResponse,
  PhoneVerifyResponse,
};

export async function activateWithToken(token: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/vendor-auth-activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.json();
}

// Auth endpoints route through the same-origin /sb/* proxy backed by a
// Netlify Function that talks to Postgres directly. Bypasses Supabase
// HTTPS edge entirely for the login flow — works from regions where
// *.supabase.co is blocked.
const AUTH_BASE = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "/sb"
  : BASE; // local dev still hits Supabase directly

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${AUTH_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new NetworkUnreachableError(`request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    if (err instanceof TypeError) {
      throw new NetworkUnreachableError(err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkVendor(email: string): Promise<AuthCheckResponse> {
  return postAuth<AuthCheckResponse>("auth-check", { email });
}

export async function sendOtp(
  email: string,
  channel: "email" | "sms"
): Promise<OtpSendResponse> {
  return postAuth<OtpSendResponse>("auth-otp-send", { email, channel });
}

export async function verifyOtp(
  email: string,
  otp_code: string
): Promise<AuthResponse> {
  return postAuth<AuthResponse>("auth-otp-verify", { email, otp_code });
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

export async function updateProfile(
  token: string,
  data: {
    email?: string;
    phone?: string;
    full_name?: string;
    city?: string;
    country?: string;
    province_state?: string;
    tax_id?: string;
    tax_name?: string;
    tax_rate?: string;
    preferred_rate_currency?: string;
    native_languages?: string[];
  }
): Promise<ProfileUpdateResponse> {
  const res = await fetch(`${BASE}/vendor-update-profile`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function sendPhoneVerification(
  token: string,
  phone: string
): Promise<PhoneVerifyResponse> {
  const res = await fetch(`${BASE}/vendor-verify-phone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "send", phone }),
  });
  return res.json();
}

export async function verifyPhoneCode(
  token: string,
  phone: string,
  otp_code: string
): Promise<PhoneVerifyResponse> {
  const res = await fetch(`${BASE}/vendor-verify-phone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "verify", phone, otp_code }),
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
