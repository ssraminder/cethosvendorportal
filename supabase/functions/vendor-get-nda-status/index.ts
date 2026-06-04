// ============================================================================
// vendor-get-nda-status v1.0
// Returns the active NDA template + the vendor's signing status so the
// vendor portal /nda page can render the right view.
//
// Output: {
//   template: { id, version_label, title, body_html, effective_from },
//   current_signature: { id, signed_full_name, signed_at, ... } | null,
//   needs_signature: boolean,         // true if no current sig OR template is newer
//   reason: string | null              // human-readable why-it-needs-signing
// }
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

    // Active NDA template (one per jurisdiction; we default to 'global')
    const { data: template } = await sb
      .from("nda_templates")
      .select("id, version_label, jurisdiction, title, body_html, effective_from")
      .eq("is_active", true)
      .eq("jurisdiction", "global")
      .maybeSingle();
    if (!template) return json({ error: "No active NDA template configured" }, 500);

    // Vendor's current signature (if any)
    const { data: currentSig } = await sb
      .from("vendor_nda_signatures")
      .select("id, nda_template_id, signed_full_name, signed_email, signed_at, signer_ip, is_current, signed_html_snapshot")
      .eq("vendor_id", vendorId)
      .eq("is_current", true)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let needsSignature = false;
    let reason: string | null = null;
    if (!currentSig) {
      needsSignature = true;
      reason = "You haven't signed the Cethos NDA yet. Please review and sign to start receiving work.";
    } else if (currentSig.nda_template_id !== template.id) {
      needsSignature = true;
      reason = "The NDA has been updated since you last signed. Please review the new version and re-sign.";
    }

    // Time-boxed staff-set waiver. When vendors.nda_waived_until is in
    // the future the gate treats the vendor as up to date; the waiver
    // self-expires (no manual cleanup).
    const { data: vendorRow } = await sb
      .from("vendors")
      .select("nda_waived_until")
      .eq("id", vendorId)
      .maybeSingle();
    const waivedUntilIso: string | null = (vendorRow as any)?.nda_waived_until ?? null;
    if (waivedUntilIso && new Date(waivedUntilIso).getTime() > Date.now()) {
      needsSignature = false;
      reason = `Signature waived through ${waivedUntilIso.slice(0, 10)}.`;
    }

    return json({
      success: true,
      template,
      current_signature: currentSig,
      needs_signature: needsSignature,
      reason,
      waived_until: waivedUntilIso,
    });
  } catch (err: any) {
    console.error("vendor-get-nda-status error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
