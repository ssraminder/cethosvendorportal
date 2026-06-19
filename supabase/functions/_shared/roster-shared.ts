// ============================================================================
// Shared helpers for the agency-roster vendor edge functions.
//
// Auth model mirrors the rest of the vendor portal: a vendor_sessions
// bearer token (random UUID) accepted at the gateway because these
// functions are deployed --no-verify-jwt; the real validation happens
// here against the vendor_sessions table. The token may arrive either in
// the Authorization header (multipart uploads) or in the JSON body as
// session_token (text/plain "simple request" posts that skip preflight).
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Resolve the vendor_id for a session token taken from the header or body. */
export async function resolveVendorId(
  supabase: SupabaseClient,
  req: Request,
  bodyToken?: string | null,
): Promise<string | null> {
  const headerToken = req.headers.get("Authorization")?.replace("Bearer ", "")?.trim();
  const token = headerToken || (bodyToken ?? "").trim();
  if (!token) return null;
  const { data } = await supabase
    .from("vendor_sessions")
    .select("vendor_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data?.vendor_id ?? null;
}

export interface AgencyVendor {
  id: string;
  vendor_type: string | null;
  contractor_type: string | null;
  business_name: string | null;
  full_name: string | null;
  email: string | null;
}

/** Roster features are agency-only. Returns the vendor row if it is an agency. */
export async function requireAgency(
  supabase: SupabaseClient,
  vendorId: string,
): Promise<{ ok: true; vendor: AgencyVendor } | { ok: false }> {
  const { data } = await supabase
    .from("vendors")
    .select("id, vendor_type, contractor_type, business_name, full_name, email")
    .eq("id", vendorId)
    .single();
  if (!data) return { ok: false };
  const isAgency = (data.vendor_type ?? "").toLowerCase() === "agency";
  if (!isAgency) return { ok: false };
  return { ok: true, vendor: data as AgencyVendor };
}

/** Deterministic eligibility — mirrors public.roster_linguist_is_eligible().
 *  Returns the boolean plus a human-readable list of what's still missing. */
export function computeEligibility(l: {
  is_active: boolean;
  iso_attested: boolean;
  cv_path: string | null;
  competence_basis_code: string | null;
  pairs: number;
  roles: number;
  domains: number;
}): { eligible: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!l.cv_path) missing.push("Blinded CV");
  if (!l.competence_basis_code) missing.push("Competence basis (ISO 17100 §3.1.4)");
  if (l.pairs < 1) missing.push("At least one language pair");
  if (l.roles < 1) missing.push("At least one role");
  if (l.domains < 1) missing.push("At least one specialization/domain");
  if (!l.iso_attested) missing.push("ISO competence attestation");
  if (!l.is_active) missing.push("Active status");
  return { eligible: missing.length === 0, missing };
}
