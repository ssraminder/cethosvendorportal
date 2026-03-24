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
    const { email, otp_code } = (await req.json()) as {
      email: string;
      otp_code: string;
    };

    if (!email || !otp_code) {
      return new Response(
        JSON.stringify({ error: "Email and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedEmail = email.toLowerCase().trim();

    // Look up most recent non-verified, non-expired OTP for this email
    const { data: otp, error: otpErr } = await supabase
      .from("vendor_otp")
      .select("id, vendor_id, otp_code")
      .eq("email", normalizedEmail)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (otpErr || !otp) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (otp.otp_code !== otp_code) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("vendor_otp")
      .update({ verified: true })
      .eq("id", otp.id);

    // Create session
    const sessionToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: sessionErr } = await supabase
      .from("vendor_sessions")
      .insert({
        vendor_id: otp.vendor_id,
        session_token: sessionToken,
        expires_at: expiresAt,
        last_seen_at: new Date().toISOString(),
      });

    if (sessionErr) {
      console.error("Failed to create session:", sessionErr);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch vendor profile
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select(
        "id, full_name, email, phone, status, vendor_type, country, availability_status"
      )
      .eq("id", otp.vendor_id)
      .single();

    if (vendorErr || !vendor) {
      console.error("Failed to fetch vendor:", vendorErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch vendor profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if password is set
    const { data: auth } = await supabase
      .from("vendor_auth")
      .select("vendor_id")
      .eq("vendor_id", otp.vendor_id)
      .single();

    // Check and stamp first login via cvp_translators
    let isFirstLogin = false;
    const { data: translator } = await supabase
      .from("cvp_translators")
      .select("id, invite_accepted_at")
      .eq("email", normalizedEmail)
      .single();

    if (translator && !translator.invite_accepted_at) {
      isFirstLogin = true;
      await supabase
        .from("cvp_translators")
        .update({ invite_accepted_at: new Date().toISOString() })
        .eq("id", translator.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        expires_at: expiresAt,
        vendor,
        needs_password: !auth,
        is_first_login: isFirstLogin,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-auth-otp-verify error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
