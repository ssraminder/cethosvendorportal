import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_METHODS = ["bank_transfer", "paypal", "cheque", "e_transfer", "wire_transfer"] as const;

interface PaymentInfoRequest {
  payment_method?: string;
  payment_details?: Record<string, unknown>;
  preferred_currency?: string;
  tax_id?: string;
  tax_rate?: number;
  invoice_notes?: string;
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

    const body = await req.json() as PaymentInfoRequest;

    if (body.payment_method && !VALID_METHODS.includes(body.payment_method as typeof VALID_METHODS[number])) {
      return new Response(
        JSON.stringify({ error: `Invalid payment method. Must be one of: ${VALID_METHODS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.tax_rate !== undefined && (body.tax_rate < 0 || body.tax_rate > 100)) {
      return new Response(
        JSON.stringify({ error: "Tax rate must be between 0 and 100" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if payment info already exists
    const { data: existing } = await supabase
      .from("vendor_payment_info")
      .select("id")
      .eq("vendor_id", session.vendor_id)
      .single();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.payment_method !== undefined) updates.payment_method = body.payment_method;
    if (body.payment_details !== undefined) updates.payment_details = body.payment_details;
    if (body.preferred_currency !== undefined) updates.preferred_currency = body.preferred_currency;
    if (body.tax_id !== undefined) updates.tax_id = body.tax_id;
    if (body.tax_rate !== undefined) updates.tax_rate = body.tax_rate;
    if (body.invoice_notes !== undefined) updates.invoice_notes = body.invoice_notes;

    if (existing) {
      // Update existing record
      const { error: updateErr } = await supabase
        .from("vendor_payment_info")
        .update(updates)
        .eq("id", existing.id);

      if (updateErr) {
        console.error("Failed to update payment info:", updateErr);
        return new Response(
          JSON.stringify({ error: "Failed to update payment information" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Insert new record
      const { error: insertErr } = await supabase
        .from("vendor_payment_info")
        .insert({
          vendor_id: session.vendor_id,
          ...updates,
        });

      if (insertErr) {
        console.error("Failed to create payment info:", insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to create payment information" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Return updated info (without payment_details for security)
    const { data: updatedInfo } = await supabase
      .from("vendor_payment_info")
      .select("id, preferred_currency, payment_method, tax_id, tax_rate, invoice_notes, updated_at")
      .eq("vendor_id", session.vendor_id)
      .single();

    return new Response(
      JSON.stringify({ success: true, payment_info: updatedInfo }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-update-payment-info error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
