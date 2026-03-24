import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import bcrypt from "npm:bcryptjs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PasswordLoginRequest {
  email: string;
  password: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = (await req.json()) as PasswordLoginRequest;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up vendor by email
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select(
        "id, full_name, email, phone, status, vendor_type, country, availability_status"
      )
      .eq("email", email.toLowerCase().trim())
      .single();

    if (vendorErr || !vendor) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up vendor_auth
    const { data: auth, error: authErr } = await supabase
      .from("vendor_auth")
      .select("password_hash, must_reset")
      .eq("vendor_id", vendor.id)
      .single();

    if (authErr || !auth) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    const valid = await bcrypt.compare(password, auth.password_hash);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create session
    const sessionToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: sessionErr } = await supabase
      .from("vendor_sessions")
      .insert({
        vendor_id: vendor.id,
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

    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        expires_at: expiresAt,
        vendor,
        must_reset: auth.must_reset,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-auth-password error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
