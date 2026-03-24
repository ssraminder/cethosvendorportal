import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UpdateRequest {
  email?: string;
  phone?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate session
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

    const { email, phone } = (await req.json()) as UpdateRequest;

    // Validate email format if provided
    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return new Response(
          JSON.stringify({ error: "Invalid email address" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check email uniqueness
      const { data: existing } = await supabase
        .from("vendors")
        .select("id")
        .eq("email", trimmed)
        .neq("id", session.vendor_id)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "This email is already in use" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build update payload
    const updates: Record<string, string> = {};
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone.trim() || null as unknown as string;

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No fields to update" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateErr } = await supabase
      .from("vendors")
      .update(updates)
      .eq("id", session.vendor_id);

    if (updateErr) {
      console.error("Failed to update vendor:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also update cvp_translators if exists
    const { data: vendor } = await supabase
      .from("vendors")
      .select("email")
      .eq("id", session.vendor_id)
      .single();

    if (vendor) {
      const translatorUpdates: Record<string, string> = {};
      if (email !== undefined) translatorUpdates.email = updates.email;
      if (phone !== undefined) translatorUpdates.phone = updates.phone;

      await supabase
        .from("cvp_translators")
        .update(translatorUpdates)
        .eq("email", vendor.email);
    }

    // Fetch updated vendor profile
    const { data: updatedVendor } = await supabase
      .from("vendors")
      .select("id, full_name, email, phone, status, vendor_type, country, availability_status")
      .eq("id", session.vendor_id)
      .single();

    return new Response(
      JSON.stringify({ success: true, vendor: updatedVendor }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-update-profile error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
