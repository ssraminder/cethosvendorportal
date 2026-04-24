/**
 * cvp-get-my-domains
 *
 * Read-only helper for the vendor portal's Request-Test page (T3). Takes
 * a vendor session token, returns the authenticated translator's full
 * cvp_translator_domains set plus the language records needed to render
 * pair labels.
 *
 * Kept separate from cvp-request-test so the UI can poll state without
 * mutating anything, and so RLS on cvp_translator_domains (service_role
 * only) isn't punched open for the anon key.
 *
 * Body: {}  (no fields needed; translator is derived from session)
 * Response: {
 *   success: true,
 *   data: {
 *     translator_id,
 *     rows: [...cvp_translator_domains rows, columns below],
 *     languages: [{ id, name, code } ...]
 *   }
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ success: false, error: "unauthenticated" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: session } = await supabase
    .from("vendor_sessions")
    .select("vendor_id, expires_at")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session) return json({ success: false, error: "unauthenticated" }, 401);

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, email")
    .eq("id", session.vendor_id)
    .single();
  if (!vendor) return json({ success: false, error: "vendor_not_found" }, 404);

  const { data: translator } = await supabase
    .from("cvp_translators")
    .select("id")
    .eq("email", vendor.email)
    .maybeSingle();
  if (!translator) {
    return json({
      success: true,
      data: { translator_id: null, rows: [], languages: [] },
    });
  }

  const { data: rows } = await supabase
    .from("cvp_translator_domains")
    .select(
      "id, source_language_id, target_language_id, domain, status, cooldown_until, approval_source, approved_at, rejected_at",
    )
    .eq("translator_id", translator.id);

  const domainRows = rows ?? [];
  const ids = Array.from(
    new Set(
      domainRows.flatMap((r) => [r.source_language_id, r.target_language_id]),
    ),
  );
  const { data: languages } =
    ids.length > 0
      ? await supabase.from("languages").select("id, name, code").in("id", ids)
      : { data: [] };

  return json({
    success: true,
    data: {
      translator_id: translator.id,
      rows: domainRows,
      languages: languages ?? [],
    },
  });
});
