/**
 * Netlify Function: get-profile
 * Port of vendor-get-profile. Returns vendor profile + language pairs +
 * active rates + payment info + cvp_translators metadata + computed
 * profile_completeness across the 5 dashboard checklist items.
 *
 * POST /sb/get-profile
 * Body: { session_token: string }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

interface VendorRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  vendor_type: string | null;
  country: string | null;
  province_state: string | null;
  city: string | null;
  availability_status: string | null;
  certifications: unknown;
  years_experience: number | null;
  rate_per_page: number | null;
  rate_currency: string | null;
  specializations: unknown;
  minimum_rate: number | null;
  total_projects: number | null;
  last_project_date: string | null;
  rating: number | null;
  tax_id: string | null;
  tax_name: string | null;
  tax_rate: number | null;
  preferred_rate_currency: string | null;
  native_languages: string[] | null;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as { session_token?: string };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const vendors = await query<VendorRow>(
      `SELECT id, full_name, email, phone, status, vendor_type, country, province_state,
              city, availability_status, certifications, years_experience, rate_per_page,
              rate_currency, specializations, minimum_rate, total_projects, last_project_date,
              rating, tax_id, tax_name, tax_rate, preferred_rate_currency, native_languages
       FROM vendors WHERE id = $1 LIMIT 1`,
      [vendor_id],
    );
    const vendor = vendors[0];
    if (!vendor) return err("Vendor not found", 404);

    const languagePairs = await query<{
      id: string; source_language: string; target_language: string;
      is_active: boolean; notes: string | null; created_at: string;
    }>(
      `SELECT id, source_language, target_language, is_active, notes, created_at
       FROM vendor_language_pairs WHERE vendor_id = $1 ORDER BY source_language`,
      [vendor_id],
    );

    const rates = await query<{
      id: string; service_id: string; language_pair_id: string | null;
      calculation_unit: string; rate: number; currency: string; rate_cad: number | null;
      minimum_charge: number | null; minimum_charge_unit: string | null;
      source: string; is_active: boolean;
      valid_from: string | null; valid_until: string | null; notes: string | null;
    }>(
      `SELECT id, service_id, language_pair_id, calculation_unit, rate, currency, rate_cad,
              minimum_charge, minimum_charge_unit, source, is_active, valid_from, valid_until, notes
       FROM vendor_rates WHERE vendor_id = $1 AND is_active = true ORDER BY created_at`,
      [vendor_id],
    );

    const serviceIds = Array.from(new Set(rates.map((r) => r.service_id).filter(Boolean)));
    const services = serviceIds.length > 0
      ? await query<{ id: string; code: string; name: string; category: string }>(
          `SELECT id, code, name, category FROM services WHERE id = ANY($1::uuid[])`,
          [serviceIds],
        )
      : [];
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const ratesWithService = rates.map((r) => ({
      ...r,
      service: serviceMap.get(r.service_id) ?? null,
    }));

    const payments = await query<{
      id: string; payment_currency: string | null; payment_method: string | null;
      invoice_notes: string | null; updated_at: string;
    }>(
      `SELECT id, payment_currency, payment_method, invoice_notes, updated_at
       FROM vendor_payment_info WHERE vendor_id = $1 LIMIT 1`,
      [vendor_id],
    );
    const paymentInfo = payments[0] ?? null;

    const translators = await query<{
      id: string; tier: string | null; profile_completeness: number | null;
      bio: string | null; approved_combinations: unknown; cat_tools: string[] | null;
      profile_photo_url: string | null;
    }>(
      `SELECT id, tier, profile_completeness, bio, approved_combinations, cat_tools, profile_photo_url
       FROM cvp_translators WHERE email = $1 LIMIT 1`,
      [vendor.email],
    );
    const translatorProfile = translators[0] ?? null;

    // 5 dashboard checklist items, 20% each — matches Supabase function logic.
    const completedSteps: Record<string, boolean> = {
      photo: !!translatorProfile?.profile_photo_url,
      availability: !!vendor.availability_status && vendor.availability_status !== "available",
      languages: languagePairs.some((lp) => lp.is_active),
      rates: rates.length > 0,
      payment: !!paymentInfo?.payment_method,
    };
    let completeness = 0;
    for (const done of Object.values(completedSteps)) if (done) completeness += 20;

    return json({
      vendor,
      language_pairs: languagePairs,
      rates: ratesWithService,
      payment_info: paymentInfo,
      translator_profile: translatorProfile,
      profile_completeness: completeness,
      completed_steps: completedSteps,
    });
  } catch (e) {
    console.error("get-profile error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
