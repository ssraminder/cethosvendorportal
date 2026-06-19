// ============================================================================
// vendor-roster-list
//
// Returns the calling agency's full roster (incl. agency-private fields:
// real_name, cv filename) plus per-linguist eligibility + a "what's
// missing" checklist, and the reference data the roster UI needs for its
// dropdowns (competence bases, role types, subject matters, languages).
//
// Auth: vendor_sessions token (header or body.session_token). Agency-only.
// Deployed --no-verify-jwt.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  corsHeaders, json, getServiceClient, resolveVendorId, requireAgency, computeEligibility,
} from "../_shared/roster-shared.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* allow empty */ }

    const supabase = getServiceClient();
    const vendorId = await resolveVendorId(supabase, req, body.session_token as string | undefined);
    if (!vendorId) return json({ error: "Invalid or expired session" }, 401);

    const agency = await requireAgency(supabase, vendorId);
    if (!agency.ok) return json({ error: "Roster is available for agency accounts only" }, 403);

    // Linguists + children
    const { data: linguists, error: lErr } = await supabase
      .from("vendor_roster_linguists")
      .select("id, handle, competence_basis_code, is_active, iso_attested, iso_attested_at, real_name, cv_path, cv_original_filename, cv_uploaded_at, created_at, updated_at")
      .eq("vendor_id", vendorId)
      .order("handle", { ascending: true });
    if (lErr) return json({ error: "load_failed", detail: lErr.message }, 500);

    const ids = (linguists ?? []).map((l) => l.id);
    const [pairsRes, domainsRes, rolesRes] = await Promise.all([
      ids.length ? supabase.from("vendor_roster_linguist_language_pairs")
        .select("roster_linguist_id, source_language, target_language").in("roster_linguist_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from("vendor_roster_linguist_domains")
        .select("roster_linguist_id, subject_matter_id").in("roster_linguist_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from("vendor_roster_linguist_roles")
        .select("roster_linguist_id, role_type_code").in("roster_linguist_id", ids) : Promise.resolve({ data: [] }),
    ]);
    const pairs = (pairsRes.data ?? []) as Array<{ roster_linguist_id: string; source_language: string; target_language: string }>;
    const domains = (domainsRes.data ?? []) as Array<{ roster_linguist_id: string; subject_matter_id: string }>;
    const roles = (rolesRes.data ?? []) as Array<{ roster_linguist_id: string; role_type_code: string }>;

    const byLinguist = (id: string) => ({
      pairs: pairs.filter((p) => p.roster_linguist_id === id),
      domains: domains.filter((d) => d.roster_linguist_id === id).map((d) => d.subject_matter_id),
      roles: roles.filter((r) => r.roster_linguist_id === id).map((r) => r.role_type_code),
    });

    const roster = (linguists ?? []).map((l) => {
      const kids = byLinguist(l.id);
      const elig = computeEligibility({
        is_active: l.is_active,
        iso_attested: l.iso_attested,
        cv_path: l.cv_path,
        competence_basis_code: l.competence_basis_code,
        pairs: kids.pairs.length,
        roles: kids.roles.length,
        domains: kids.domains.length,
      });
      return {
        id: l.id,
        handle: l.handle,
        real_name: l.real_name,
        competence_basis_code: l.competence_basis_code,
        is_active: l.is_active,
        iso_attested: l.iso_attested,
        iso_attested_at: l.iso_attested_at,
        has_cv: !!l.cv_path,
        cv_original_filename: l.cv_original_filename,
        cv_uploaded_at: l.cv_uploaded_at,
        language_pairs: kids.pairs.map((p) => ({ source_language: p.source_language, target_language: p.target_language })),
        domain_ids: kids.domains,
        role_codes: kids.roles,
        is_eligible: elig.eligible,
        missing: elig.missing,
        created_at: l.created_at,
      };
    });

    // Reference data for dropdowns (qms.* is not exposed to PostgREST; use the
    // public SECURITY DEFINER accessor instead of .schema("qms")).
    const { data: reference } = await supabase.rpc("roster_reference_data");

    return json({
      success: true,
      roster,
      reference: reference ?? { competence_bases: [], role_types: [], subject_matters: [], languages: [] },
    });
  } catch (err) {
    console.error("vendor-roster-list error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
