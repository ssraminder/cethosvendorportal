import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RateChangeRequest {
  rate_id: string;
  proposed_rate: number;
  proposed_currency?: string;
  notes?: string;
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

    const body = await req.json() as RateChangeRequest;

    if (!body.rate_id || !body.proposed_rate) {
      return new Response(
        JSON.stringify({ error: "rate_id and proposed_rate are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.proposed_rate <= 0) {
      return new Response(
        JSON.stringify({ error: "Proposed rate must be greater than 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify rate belongs to vendor
    const { data: rate } = await supabase
      .from("vendor_rates")
      .select("id, rate, currency, notes")
      .eq("id", body.rate_id)
      .eq("vendor_id", session.vendor_id)
      .single();

    if (!rate) {
      return new Response(
        JSON.stringify({ error: "Rate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store rate change request in vendor_rates notes field as JSON marker
    // Format: existing notes + rate change request metadata
    const changeRequest = {
      requested_at: new Date().toISOString(),
      current_rate: rate.rate,
      proposed_rate: body.proposed_rate,
      proposed_currency: body.proposed_currency || rate.currency,
      vendor_notes: body.notes || "",
      status: "pending_review",
    };

    const updatedNotes = rate.notes
      ? `${rate.notes}\n[RATE_CHANGE_REQUEST]: ${JSON.stringify(changeRequest)}`
      : `[RATE_CHANGE_REQUEST]: ${JSON.stringify(changeRequest)}`;

    const { error: updateErr } = await supabase
      .from("vendor_rates")
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.rate_id);

    if (updateErr) {
      console.error("Failed to submit rate change request:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to submit rate change request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Rate change request submitted for admin review",
        change_request: {
          rate_id: body.rate_id,
          current_rate: rate.rate,
          proposed_rate: body.proposed_rate,
          status: "pending_review",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-update-rates error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
