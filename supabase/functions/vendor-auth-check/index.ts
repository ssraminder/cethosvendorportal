import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = (await req.json()) as { email?: string };

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedEmail = email.toLowerCase().trim();

    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("id, phone")
      .eq("email", normalizedEmail)
      .single();

    if (vendorErr || !vendor) {
      return new Response(
        JSON.stringify({ exists: false, has_phone: false, has_password: false, is_first_login: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if password is set
    const { data: auth } = await supabase
      .from("vendor_auth")
      .select("vendor_id")
      .eq("vendor_id", vendor.id)
      .single();

    // Check if first login via cvp_translators
    const { data: translator } = await supabase
      .from("cvp_translators")
      .select("invite_accepted_at")
      .eq("email", normalizedEmail)
      .single();

    const isFirstLogin = translator ? !translator.invite_accepted_at : false;

    return new Response(
      JSON.stringify({
        exists: true,
        has_phone: !!vendor.phone,
        has_password: !!auth,
        is_first_login: isFirstLogin,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-auth-check error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
