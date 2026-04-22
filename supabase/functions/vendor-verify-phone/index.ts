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

    const body = await req.json();
    const action = body.action as string;

    if (action === "send") {
      // Normalize: strip spaces, dashes, parens — keep + and digits only
      const rawPhone = (body.phone as string)?.trim() || "";
      const phone = rawPhone.replace(/[\s\-().]/g, "");

      if (!phone || phone.length < 8 || !phone.startsWith("+")) {
        return new Response(
          JSON.stringify({ error: "Enter phone with country code, e.g. +14165551234" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rate limit: 60 seconds
      const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: recentOtp } = await supabase
        .from("vendor_otp")
        .select("id")
        .eq("vendor_id", session.vendor_id)
        .eq("channel", "phone_verify")
        .eq("verified", false)
        .gte("created_at", sixtySecondsAgo)
        .limit(1);

      if (recentOtp && recentOtp.length > 0) {
        return new Response(
          JSON.stringify({ error: "Please wait before requesting another code" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get vendor email for the OTP record
      const { data: vendor } = await supabase
        .from("vendors")
        .select("email")
        .eq("id", session.vendor_id)
        .single();

      if (!vendor) {
        return new Response(
          JSON.stringify({ error: "Vendor not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Store OTP with channel=phone_verify and the NEW phone in the phone field
      const { error: insertErr } = await supabase.from("vendor_otp").insert({
        vendor_id: session.vendor_id,
        email: vendor.email,
        phone,
        channel: "phone_verify",
        otp_code: otpCode,
        expires_at: expiresAt,
      });

      if (insertErr) {
        console.error("Failed to insert OTP:", insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to generate code" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send SMS via Twilio
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");
      if (!twilioSid || !twilioToken || !twilioFrom) {
        console.error("TWILIO credentials missing — sid:", !!twilioSid, "token:", !!twilioToken, "from:", !!twilioFrom);
        return new Response(
          JSON.stringify({ error: "SMS service not configured. TWILIO credentials missing." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const smsContent = `Your CETHOS verification code is: ${otpCode}. Expires in 10 minutes.`;
      const basicAuth = btoa(`${twilioSid}:${twilioToken}`);
      const formBody = new URLSearchParams({ To: phone, From: twilioFrom, Body: smsContent });

      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formBody.toString(),
        }
      );

      if (!smsRes.ok) {
        const errBody = await smsRes.text();
        console.error("Twilio SMS failed:", smsRes.status, errBody);
        let detail: unknown;
        try { detail = JSON.parse(errBody); } catch { detail = errBody; }
        return new Response(
          JSON.stringify({ error: "Failed to send SMS", detail }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mask phone for display
      const prefix = phone.startsWith("+") ? phone.slice(0, 3) : phone.slice(0, 1);
      const suffix = phone.slice(-2);
      const masked = `${prefix}${"*".repeat(Math.max(0, phone.length - prefix.length - suffix.length))}${suffix}`;

      return new Response(
        JSON.stringify({ success: true, masked_phone: masked }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      const otpCode = (body.otp_code as string)?.trim();
      const phone = ((body.phone as string)?.trim() || "").replace(/[\s\-().]/g, "");

      if (!otpCode || !phone) {
        return new Response(
          JSON.stringify({ error: "Phone and code are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find matching OTP
      const { data: otp, error: otpErr } = await supabase
        .from("vendor_otp")
        .select("id, otp_code")
        .eq("vendor_id", session.vendor_id)
        .eq("phone", phone)
        .eq("channel", "phone_verify")
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

      if (otp.otp_code !== otpCode) {
        return new Response(
          JSON.stringify({ error: "Invalid code" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark OTP verified
      await supabase
        .from("vendor_otp")
        .update({ verified: true })
        .eq("id", otp.id);

      // Update vendor phone
      const { error: updateErr } = await supabase
        .from("vendors")
        .update({ phone })
        .eq("id", session.vendor_id);

      if (updateErr) {
        console.error("Failed to update phone:", updateErr);
        return new Response(
          JSON.stringify({ error: "Failed to save phone number" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Sync cvp_translators
      const { data: vendor } = await supabase
        .from("vendors")
        .select("email")
        .eq("id", session.vendor_id)
        .single();

      if (vendor) {
        await supabase
          .from("cvp_translators")
          .update({ phone })
          .eq("email", vendor.email);
      }

      // Return updated vendor profile
      const { data: updatedVendor } = await supabase
        .from("vendors")
        .select("id, full_name, email, phone, status, vendor_type, country, availability_status")
        .eq("id", session.vendor_id)
        .single();

      return new Response(
        JSON.stringify({ success: true, vendor: updatedVendor }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'send' or 'verify'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-verify-phone error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
