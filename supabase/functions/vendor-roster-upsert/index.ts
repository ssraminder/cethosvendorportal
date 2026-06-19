// ============================================================================
// vendor-roster-upsert
//
// Create or update one roster linguist for the calling agency and replace
// its child rows (language pairs, domains, roles) in one call.
//
// Body (JSON, session_token in body or Authorization header):
//   { id?, handle, real_name?, competence_basis_code?, is_active?,
//     iso_attested, language_pairs:[{source_language,target_language}],
//     domain_ids:[uuid], role_codes:[string] }
//
// Auth: vendor_sessions token. Agency-only. Deployed --no-verify-jwt.
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  corsHeaders, json, getServiceClient, resolveVendorId, requireAgency,
} from "../_shared/roster-shared.ts";

interface Pair { source_language: string; target_language: string }

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

    const supabase = getServiceClient();
    const vendorId = await resolveVendorId(supabase, req, body.session_token as string | undefined);
    if (!vendorId) return json({ error: "Invalid or expired session" }, 401);

    const agency = await requireAgency(supabase, vendorId);
    if (!agency.ok) return json({ error: "Roster is available for agency accounts only" }, 403);

    const handle = String(body.handle ?? "").trim();
    if (!handle) return json({ error: "handle is required" }, 400);

    const id = (body.id as string | undefined) || null;
    const realName = ((body.real_name as string | null) ?? null)?.toString().trim() || null;
    const competenceBasis = ((body.competence_basis_code as string | null) ?? null)?.toString().trim() || null;
    const isActive = body.is_active === undefined ? true : !!body.is_active;
    const isoAttested = !!body.iso_attested;
    const nowIso = new Date().toISOString();

    const pairs = (Array.isArray(body.language_pairs) ? body.language_pairs : []) as Pair[];
    const domainIds = (Array.isArray(body.domain_ids) ? body.domain_ids : []) as string[];
    const roleCodes = (Array.isArray(body.role_codes) ? body.role_codes : []) as string[];

    // --- upsert parent --------------------------------------------------------
    let linguistId = id;
    const parentFields = {
      vendor_id: vendorId,
      handle,
      real_name: realName,
      competence_basis_code: competenceBasis,
      is_active: isActive,
      iso_attested: isoAttested,
      iso_attested_at: isoAttested ? nowIso : null,
      updated_at: nowIso,
    };

    if (linguistId) {
      // Ownership check
      const { data: existing } = await supabase
        .from("vendor_roster_linguists")
        .select("id, iso_attested, iso_attested_at")
        .eq("id", linguistId).eq("vendor_id", vendorId).maybeSingle();
      if (!existing) return json({ error: "Linguist not found" }, 404);
      // Preserve original attestation timestamp if it was already attested.
      if (isoAttested && existing.iso_attested && existing.iso_attested_at) {
        parentFields.iso_attested_at = existing.iso_attested_at as string;
      }
      const { error: upErr } = await supabase
        .from("vendor_roster_linguists")
        .update(parentFields).eq("id", linguistId).eq("vendor_id", vendorId);
      if (upErr) return json({ error: "update_failed", detail: upErr.message }, 400);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("vendor_roster_linguists")
        .insert(parentFields).select("id").single();
      if (insErr) return json({ error: "create_failed", detail: insErr.message }, 400);
      linguistId = inserted.id;
    }

    // --- replace children -----------------------------------------------------
    await Promise.all([
      supabase.from("vendor_roster_linguist_language_pairs").delete().eq("roster_linguist_id", linguistId),
      supabase.from("vendor_roster_linguist_domains").delete().eq("roster_linguist_id", linguistId),
      supabase.from("vendor_roster_linguist_roles").delete().eq("roster_linguist_id", linguistId),
    ]);

    const pairRows = pairs
      .filter((p) => p?.source_language && p?.target_language)
      .map((p) => ({
        roster_linguist_id: linguistId, vendor_id: vendorId,
        source_language: String(p.source_language).toUpperCase().trim(),
        target_language: String(p.target_language).toUpperCase().trim(),
      }));
    const domainRows = [...new Set(domainIds.filter(Boolean))].map((d) => ({
      roster_linguist_id: linguistId, vendor_id: vendorId, subject_matter_id: d,
    }));
    const roleRows = [...new Set(roleCodes.filter(Boolean))].map((r) => ({
      roster_linguist_id: linguistId, vendor_id: vendorId, role_type_code: r,
    }));

    if (pairRows.length) {
      const { error } = await supabase.from("vendor_roster_linguist_language_pairs").insert(pairRows);
      if (error) return json({ error: "language_pairs_failed", detail: error.message }, 400);
    }
    if (domainRows.length) {
      const { error } = await supabase.from("vendor_roster_linguist_domains").insert(domainRows);
      if (error) return json({ error: "domains_failed", detail: error.message }, 400);
    }
    if (roleRows.length) {
      const { error } = await supabase.from("vendor_roster_linguist_roles").insert(roleRows);
      if (error) return json({ error: "roles_failed", detail: error.message }, 400);
    }

    const { data: eligible } = await supabase.rpc("roster_linguist_is_eligible", { p_id: linguistId });

    return json({ success: true, id: linguistId, is_eligible: !!eligible });
  } catch (err) {
    console.error("vendor-roster-upsert error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
