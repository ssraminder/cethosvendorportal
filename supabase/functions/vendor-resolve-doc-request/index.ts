// ============================================================================
// vendor-resolve-doc-request
//
// Public endpoint (token-gated). Resolves a vendor_document_requests
// request_token into the request payload + vendor identity so the
// /iso-evidence/:token landing page can render before the vendor signs in.
//
// Does NOT include sensitive data; just enough to render the checklist
// and a "Sign in to continue" prompt.
//
// POST /functions/v1/vendor-resolve-doc-request
// Body: { token: string }
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  const token = (body.token ?? "").trim();
  if (!token) return json({ success: false, error: "token_required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: request, error: reqErr } = await supabase
    .from("vendor_document_requests")
    .select("id, vendor_id, request_token_expires_at, requested_items, staff_message, subject, status, completed_at, created_at")
    .eq("request_token", token)
    .maybeSingle();

  if (reqErr || !request) return json({ success: false, error: "request_not_found" }, 404);

  if (new Date(request.request_token_expires_at).getTime() < Date.now()) {
    return json({ success: false, error: "request_expired", status: request.status }, 410);
  }
  if (["completed", "expired", "superseded"].includes(request.status)) {
    return json({ success: false, error: "request_closed", status: request.status }, 410);
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, full_name, email, native_languages, years_experience, specializations")
    .eq("id", request.vendor_id)
    .maybeSingle();
  if (!vendor) return json({ success: false, error: "vendor_not_found" }, 404);

  return json({
    success: true,
    request: {
      id: request.id,
      status: request.status,
      created_at: request.created_at,
      expires_at: request.request_token_expires_at,
      requested_items: request.requested_items,
      staff_message: request.staff_message,
      subject: request.subject,
    },
    vendor: {
      id: vendor.id,
      first_name: (vendor.full_name || "").split(" ")[0] || "",
      email: vendor.email,
      // Echo current profile snapshot so the page can pre-fill profile-
      // field forms with what the vendor already has on file.
      profile: {
        native_languages: vendor.native_languages ?? [],
        years_experience: vendor.years_experience ?? null,
        specializations: vendor.specializations ?? [],
      },
    },
  });
});
