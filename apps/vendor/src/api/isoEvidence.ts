// API client for the /iso-evidence/:token flow. Talks to:
//   - vendor-resolve-doc-request    (public, token-gated read)
//   - vendor-iso-evidence-complete-item (vendor session optional; token is
//     authoritative; if session present, server cross-checks vendor_id)
//   - list-doc-requests (Netlify proxy, vendor-session-authed) — backs
//     the /documents page that surfaces open requests inside the portal.

import { FUNCTIONS_BASE, safePost } from "./functionsBase";

const SB_BASE = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "/sb"
  : null;

// MCP-deployed edge functions land with verify_jwt=true. The Supabase
// gateway accepts the publishable anon key in the apikey header to
// satisfy that check; the function itself does its own token validation
// inside the body. Inclusion is safe — this key is meant to ship with
// the client bundle.
const ANON_KEY: string | undefined = (import.meta as { env?: { VITE_SUPABASE_ANON_KEY?: string } }).env?.VITE_SUPABASE_ANON_KEY;
// Typed as Record<string, string> explicitly so the empty branch ({}) of
// the ternary doesn't poison the inference with `{ apikey?: undefined }`,
// which production tsc (-b mode) rejects when spread into Record-typed
// header bags downstream.
const gatewayHeaders: Record<string, string> = ANON_KEY
  ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  : {};

export interface IsoRequestItem {
  slug: string;
  label: string;
  kind: "file" | "profile_field";
  profile_column?: string | null;
  rationale?: string | null;
  completed_at?: string | null;
  declined_at?: string | null;
  decline_reason?: string | null;
}

export interface ResolvedDocRequest {
  success: true;
  request: {
    id: string;
    status: "draft" | "sent" | "partial" | "completed" | "expired" | "superseded";
    created_at: string;
    expires_at: string;
    requested_items: IsoRequestItem[];
    staff_message: string | null;
    subject: string | null;
  };
  vendor: {
    id: string;
    first_name: string;
    email: string;
    profile: {
      native_languages: string[];
      years_experience: number | null;
      specializations: string[];
    };
  };
}

export interface ResolveError {
  success: false;
  error: string;
  status?: string;
}

export async function resolveDocRequest(token: string): Promise<ResolvedDocRequest | ResolveError> {
  const res = await safePost(
    `${FUNCTIONS_BASE}/vendor-resolve-doc-request`,
    { token },
    gatewayHeaders,
  );
  return (await res.json()) as ResolvedDocRequest | ResolveError;
}

export interface MyDocRequest {
  id: string;
  request_token: string;
  request_token_expires_at: string;
  status: "draft" | "sent" | "partial" | "completed" | "expired" | "superseded";
  staff_message: string | null;
  requested_items: IsoRequestItem[];
  reminder_count: number;
  last_reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export async function listMyDocRequests(sessionToken: string): Promise<{ success: boolean; error?: string; requests?: MyDocRequest[] }> {
  // Primary path: Netlify proxy → direct Postgres. Works in regions
  // where *.supabase.co is blocked. Falls back to Supabase only in
  // local dev (SB_BASE === null).
  if (SB_BASE) {
    const res = await fetch(`${SB_BASE}/list-doc-requests`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ session_token: sessionToken }),
    });
    return (await res.json()) as { success: boolean; error?: string; requests?: MyDocRequest[] };
  }
  const res = await fetch(`${FUNCTIONS_BASE}/vendor-list-doc-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({}),
  });
  return (await res.json()) as { success: boolean; error?: string; requests?: MyDocRequest[] };
}

// Both endpoints are deployed with verify_jwt=true (MCP default). The
// Supabase gateway validates the Authorization header AS a JWT before
// the function code runs — and the vendor portal's session token is a
// random UUID, not a JWT, so passing it as Bearer would 401 at the
// gateway every time the vendor is logged in. We use the anon-key
// envelope so the gateway is satisfied; the function still validates
// the doc-request token in the body, which is the real authority here
// (token was emailed to the vendor's verified address; possession is
// proof). The vendor-session cross-check has been removed — it was
// defence-in-depth, and adding a custom header to carry it would
// trigger CORS preflight that safePost is explicitly avoiding.
//
// Note: the `sessionToken` parameter is kept on the signature so call
// sites don't change, but it's intentionally unused at the transport
// layer.

export async function explainIsoEvidenceItem(
  token: string,
  slug: string,
  reason: string,
  _sessionToken?: string | null,
): Promise<{ success: boolean; error?: string; data?: { request_id: string; status: string; all_done: boolean; resolved_count: number; total_count: number } }> {
  const res = await safePost(
    `${FUNCTIONS_BASE}/vendor-iso-evidence-explain-item`,
    { token, slug, reason },
    gatewayHeaders,
  );
  return await res.json();
}

export async function completeIsoEvidenceItem(
  token: string,
  slug: string,
  _sessionToken?: string | null,
): Promise<{ success: boolean; error?: string; data?: { request_id: string; status: string; all_done: boolean; completed_count: number; total_count: number } }> {
  const res = await safePost(
    `${FUNCTIONS_BASE}/vendor-iso-evidence-complete-item`,
    { token, slug },
    gatewayHeaders,
  );
  return await res.json();
}
