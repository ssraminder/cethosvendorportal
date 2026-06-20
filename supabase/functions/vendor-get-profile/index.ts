import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate session
    const { data: session, error: sessionErr } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionErr || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch vendor profile
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select(
        "id, full_name, email, phone, status, vendor_type, country, province_state, city, availability_status, certifications, years_experience, rate_per_page, rate_currency, specializations, minimum_rate, total_projects, last_project_date, rating, tax_id, tax_name, tax_rate, preferred_rate_currency, native_languages"
      )
      .eq("id", session.vendor_id)
      .single();

    if (vendorErr || !vendor) {
      return new Response(
        JSON.stringify({ error: "Vendor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch language pairs
    const { data: languagePairs } = await supabase
      .from("vendor_language_pairs")
      .select("id, source_language, target_language, is_active, notes, created_at")
      .eq("vendor_id", session.vendor_id)
      .order("source_language");

    // Fetch rates with service names
    const { data: rates } = await supabase
      .from("vendor_rates")
      .select("id, service_id, language_pair_id, calculation_unit, rate, currency, rate_cad, minimum_charge, minimum_charge_unit, source, is_active, valid_from, valid_until, notes")
      .eq("vendor_id", session.vendor_id)
      .eq("is_active", true)
      .order("created_at");

    // Fetch service names for the rates
    const serviceIds = [...new Set((rates || []).map((r: Record<string, unknown>) => r.service_id).filter(Boolean))];
    let services: Record<string, unknown>[] = [];
    if (serviceIds.length > 0) {
      const { data: svcData } = await supabase
        .from("services")
        .select("id, code, name, category")
        .in("id", serviceIds);
      services = svcData || [];
    }

    // Map service names to rates
    const serviceMap = new Map(services.map((s: Record<string, unknown>) => [s.id, s]));
    const ratesWithService = (rates || []).map((r: Record<string, unknown>) => ({
      ...r,
      service: serviceMap.get(r.service_id) || null,
    }));

    // Fetch payment info (mask sensitive details)
    const { data: paymentInfo } = await supabase
      .from("vendor_payment_info")
      .select("id, payment_currency, payment_method, invoice_notes, created_at, updated_at")
      .eq("vendor_id", session.vendor_id)
      .single();

    // Fetch cvp_translators data if exists (for profile completeness, tier, etc.)
    const { data: translatorProfile } = await supabase
      .from("cvp_translators")
      .select("id, tier, profile_completeness, bio, approved_combinations, cat_tools, profile_photo_url")
      .eq("email", vendor.email)
      .single();

    // Has the vendor uploaded any ISO 17100 evidence (CV or any
    // certification with a stored file)? One row in either bucket counts.
    const [{ count: cvCount }, { count: certCount }] = await Promise.all([
      supabase
        .from("vendor_cvs")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", session.vendor_id),
      // Certifications live on vendors.certifications jsonb today; treat any
      // non-empty array as "has cert evidence."
      Promise.resolve({ count: Array.isArray(vendor.certifications) && vendor.certifications.length > 0 ? 1 : 0 }),
    ]);
    const hasIsoEvidence = (cvCount ?? 0) > 0 || (certCount ?? 0) > 0;

    const completedSteps: Record<string, boolean> = {
      // Onboarding steps (profile photo removed — no uploader exists and it's
      // not required for a translation vendor or ISO 17100; was an unreachable
      // completeness step. Bug 482f3dfa.)
      availability: !!vendor.availability_status && vendor.availability_status !== "available",
      languages: (languagePairs || []).some((lp: Record<string, unknown>) => lp.is_active),
      rates: (rates || []).length > 0,
      payment: !!paymentInfo?.payment_method,
      // ISO 17100 evidence steps. Mirror the slugs from the admin doc-
      // request modal so each step's "Edit" CTA can deep-link to the same
      // affordance on /profile (or to an active /iso-evidence/:token).
      iso_native_languages: Array.isArray(vendor.native_languages) && (vendor.native_languages as string[]).length > 0,
      iso_years_experience: vendor.years_experience != null,
      iso_specializations: Array.isArray(vendor.specializations) && (vendor.specializations as string[]).length > 0,
      iso_evidence_uploaded: hasIsoEvidence,
    };
    const totalSteps = Object.keys(completedSteps).length;
    const doneSteps = Object.values(completedSteps).filter(Boolean).length;
    const completeness = totalSteps === 0 ? 0 : Math.round((doneSteps / totalSteps) * 100);

    return new Response(
      JSON.stringify({
        vendor,
        language_pairs: languagePairs || [],
        rates: ratesWithService,
        payment_info: paymentInfo || null,
        translator_profile: translatorProfile || null,
        profile_completeness: completeness,
        completed_steps: completedSteps,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-get-profile error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
