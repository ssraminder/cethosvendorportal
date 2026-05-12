// ============================================================================
// vendor-sign-nda v1.0
// Records a clickwrap NDA signature. Supersedes any prior is_current
// signature for the same vendor (re-sign after template update).
//
// Body: { signed_full_name: string }
// Output: { signature_id, signed_at, template_version }
// ============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const { data: session } = await sb
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ error: "Invalid or expired session" }, 401);
    const vendorId = session.vendor_id;

    const body = await req.json();
    const signedFullName = (body?.signed_full_name ?? "").trim();
    if (signedFullName.length < 3) {
      return json({ error: "Please type your full legal name (at least 3 characters)" }, 400);
    }

    // Resolve the vendor's email for the audit row
    const { data: vendor } = await sb
      .from("vendors")
      .select("email, full_name")
      .eq("id", vendorId)
      .maybeSingle();

    // Active template
    const { data: template } = await sb
      .from("nda_templates")
      .select("id, version_label, body_html")
      .eq("is_active", true)
      .eq("jurisdiction", "global")
      .maybeSingle();
    if (!template) return json({ error: "No active NDA template configured" }, 500);

    // Capture signer fingerprint (best-effort)
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const signerIp = xff.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;
    const signerUa = req.headers.get("user-agent") || null;

    // Supersede any prior current signature
    await sb
      .from("vendor_nda_signatures")
      .update({
        is_current: false,
        superseded_at: new Date().toISOString(),
        superseded_reason: "Replaced by new signature",
      })
      .eq("vendor_id", vendorId)
      .eq("is_current", true);

    // Insert the new signature with the exact HTML snapshot the signer saw.
    // Storing the snapshot (not just the template_id) means a future
    // template body change can't retroactively alter what the signer agreed
    // to — auditor-friendly.
    const { data: inserted, error: insertErr } = await sb
      .from("vendor_nda_signatures")
      .insert({
        vendor_id: vendorId,
        nda_template_id: template.id,
        signed_full_name: signedFullName,
        signed_email: vendor?.email ?? null,
        signed_at: new Date().toISOString(),
        signer_ip: signerIp,
        signer_user_agent: signerUa,
        signed_html_snapshot: template.body_html,
        is_current: true,
      })
      .select("id, signed_at")
      .single();
    if (insertErr || !inserted) {
      return json({ error: "Failed to record signature", detail: insertErr?.message }, 500);
    }

    // Update the vendor row's NDA-status flags so admin views can show
    // "signed" without a join. These columns may not exist yet — best-effort.
    await sb
      .from("vendors")
      .update({
        nda_signed_at: inserted.signed_at,
        nda_template_id: template.id,
      })
      .eq("id", vendorId);

    return json({
      success: true,
      signature_id: inserted.id,
      signed_at: inserted.signed_at,
      template_version: template.version_label,
    });
  } catch (err: any) {
    console.error("vendor-sign-nda error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
