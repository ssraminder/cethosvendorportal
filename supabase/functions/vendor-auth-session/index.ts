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
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up session — also pull impersonation flags so the vendor
    // portal can show a banner when staff is "viewing as" this vendor.
    const { data: session, error: sessionErr } = await supabase
      .from("vendor_sessions")
      .select(
        "id, vendor_id, expires_at, last_seen_at, is_impersonation, impersonator_staff_id",
      )
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionErr || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_seen_at
    const now = new Date().toISOString();
    await supabase
      .from("vendor_sessions")
      .update({ last_seen_at: now })
      .eq("id", session.id);

    // Fetch vendor profile
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select(
        "id, full_name, email, phone, status, vendor_type, country, availability_status"
      )
      .eq("id", session.vendor_id)
      .single();

    if (vendorErr || !vendor) {
      return new Response(
        JSON.stringify({ error: "Vendor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if password is set
    const { data: auth } = await supabase
      .from("vendor_auth")
      .select("vendor_id")
      .eq("vendor_id", session.vendor_id)
      .single();

    // Check first login status via cvp_translators
    const { data: translator } = await supabase
      .from("cvp_translators")
      .select("invite_accepted_at")
      .eq("email", vendor.email)
      .single();

    const isFirstLogin = translator ? !translator.invite_accepted_at : false;

    // If impersonation, surface the staff member's email + name so the
    // banner can show "Viewing as <vendor> — Joe (staff) impersonating".
    let impersonator: { email: string; full_name: string | null } | null = null;
    if ((session as any).is_impersonation && (session as any).impersonator_staff_id) {
      const { data: staff } = await supabase
        .from("staff_users")
        .select("email, full_name")
        .eq("id", (session as any).impersonator_staff_id)
        .maybeSingle();
      if (staff) {
        impersonator = { email: staff.email, full_name: staff.full_name ?? null };
      }
    }

    return new Response(
      JSON.stringify({
        vendor,
        session: {
          expires_at: session.expires_at,
          last_seen_at: now,
        },
        needs_password: !auth,
        is_first_login: isFirstLogin,
        is_impersonation: !!(session as any).is_impersonation,
        impersonator,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-auth-session error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
