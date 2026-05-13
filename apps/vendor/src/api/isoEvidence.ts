// API client for the /iso-evidence/:token flow. Talks to:
//   - vendor-resolve-doc-request    (public, token-gated read)
//   - vendor-iso-evidence-complete-item (vendor session optional; token is
//     authoritative; if session present, server cross-checks vendor_id)

import { FUNCTIONS_BASE, safePost } from "./functionsBase";

// MCP-deployed edge functions land with verify_jwt=true. The Supabase
// gateway accepts the publishable anon key in the apikey header to
// satisfy that check; the function itself does its own token validation
// inside the body. Inclusion is safe — this key is meant to ship with
// the client bundle.
const ANON_KEY: string | undefined = (import.meta as { env?: { VITE_SUPABASE_ANON_KEY?: string } }).env?.VITE_SUPABASE_ANON_KEY;
const gatewayHeaders = ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {};

export interface IsoRequestItem {
  slug: string;
  label: string;
  kind: "file" | "profile_field";
  profile_column?: string | null;
  rationale?: string | null;
  completed_at?: string | null;
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

export async function completeIsoEvidenceItem(
  token: string,
  slug: string,
  sessionToken?: string | null,
): Promise<{ success: boolean; error?: string; data?: { request_id: string; status: string; all_done: boolean; completed_count: number; total_count: number } }> {
  // Session token takes precedence: when the vendor is logged in we want
  // the server's cross-check (request.vendor_id === session.vendor_id) to
  // run. Otherwise fall back to the anon-key envelope.
  const headers: Record<string, string> = sessionToken
    ? { ...(ANON_KEY ? { apikey: ANON_KEY } : {}), Authorization: `Bearer ${sessionToken}` }
    : { ...gatewayHeaders };
  const res = await safePost(
    `${FUNCTIONS_BASE}/vendor-iso-evidence-complete-item`,
    { token, slug },
    headers,
  );
  return await res.json();
}
