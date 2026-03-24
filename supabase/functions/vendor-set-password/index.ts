import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import bcrypt from "npm:bcryptjs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SetPasswordRequest {
  password: string;
  current_password?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate session
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

    const { password, current_password } =
      (await req.json()) as SetPasswordRequest;

    if (!password) {
      return new Response(
        JSON.stringify({ error: "New password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate new password: min 8 chars, at least 1 number
    if (password.length < 8 || !/\d/.test(password)) {
      return new Response(
        JSON.stringify({
          error:
            "Password must be at least 8 characters and contain a number",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if vendor_auth already exists
    const { data: existingAuth } = await supabase
      .from("vendor_auth")
      .select("password_hash")
      .eq("vendor_id", session.vendor_id)
      .single();

    if (existingAuth) {
      // Password already set — require current_password
      if (!current_password) {
        return new Response(
          JSON.stringify({ error: "Current password required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const valid = await bcrypt.compare(
        current_password,
        existingAuth.password_hash
      );
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Current password incorrect" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Upsert vendor_auth
    const { error: upsertErr } = await supabase
      .from("vendor_auth")
      .upsert(
        {
          vendor_id: session.vendor_id,
          password_hash: passwordHash,
          password_set_at: new Date().toISOString(),
          must_reset: false,
        },
        { onConflict: "vendor_id" }
      );

    if (upsertErr) {
      console.error("Failed to upsert password:", upsertErr);
      return new Response(
        JSON.stringify({ error: "Failed to update password" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-set-password error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
