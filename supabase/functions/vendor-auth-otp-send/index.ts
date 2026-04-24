import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunOperationalEmail } from "../_shared/mailgun.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return "***";
  const prefix = phone.startsWith("+") ? phone.slice(0, 3) : phone.slice(0, 1);
  const suffix = phone.slice(-2);
  const masked = "*".repeat(Math.max(0, phone.length - prefix.length - suffix.length));
  return `${prefix}${masked}${suffix}`;
}

interface OtpSendRequest {
  email: string;
  channel: "email" | "sms";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, channel } = (await req.json()) as OtpSendRequest;

    if (!email || !channel) {
      return new Response(
        JSON.stringify({ error: "Email and channel are required" }),
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
      .select("id, full_name, email, phone")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (vendorErr || !vendor) {
      return new Response(
        JSON.stringify({ error: "No vendor account found for this email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if SMS requested but no phone
    if (channel === "sms" && !vendor.phone) {
      return new Response(
        JSON.stringify({ error: "No phone number on file for SMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: check for non-verified OTP created within last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentOtp } = await supabase
      .from("vendor_otp")
      .select("id")
      .eq("vendor_id", vendor.id)
      .eq("verified", false)
      .gte("created_at", sixtySecondsAgo)
      .limit(1);

    if (recentOtp && recentOtp.length > 0) {
      return new Response(
        JSON.stringify({ error: "Please wait before requesting another code" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Insert OTP record
    const { error: insertErr } = await supabase.from("vendor_otp").insert({
      vendor_id: vendor.id,
      email: vendor.email,
      phone: vendor.phone,
      channel,
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

    let maskedContact: string;

    if (channel === "email") {
      if (!Deno.env.get("MAILGUN_API_KEY") || !Deno.env.get("MAILGUN_DOMAIN")) {
        console.error("MAILGUN_API_KEY or MAILGUN_DOMAIN not configured");
        return new Response(
          JSON.stringify({ error: "Email service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const htmlContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 30px 0 20px;">
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#0F9DA0"/>
      <path d="M26.5 14C20.15 14 15 19.15 15 25.5C15 31.85 20.15 37 26.5 37C29.5 37 32.2 35.8 34.2 33.8L31.4 31C30.1 32.3 28.4 33 26.5 33C22.36 33 19 29.64 19 25.5C19 21.36 22.36 18 26.5 18C28.4 18 30.1 18.7 31.4 20L34.2 17.2C32.2 15.2 29.5 14 26.5 14Z" fill="white"/>
    </svg>
  </div>
  <div style="padding: 0 24px;">
    <p style="color: #374151; font-size: 15px;">Hi ${vendor.full_name},</p>
    <p style="color: #374151; font-size: 15px; line-height: 1.5;">Your verification code is:</p>
    <div style="text-align: center; margin: 24px 0;">
      <div style="display: inline-block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px 40px;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: 'Courier New', monospace;">${otpCode}</span>
      </div>
    </div>
    <p style="color: #6b7280; font-size: 13px; text-align: center;">This code expires in 10 minutes.</p>
    <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px;">
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">If you did not request this code, you can safely ignore this email.</p>
    </div>
  </div>
</div>`;

      const sendResult = await sendMailgunOperationalEmail({
        to: { email: vendor.email, name: vendor.full_name },
        subject: `${otpCode} is your CETHOS verification code`,
        html: htmlContent,
        tags: ["vendor-auth-otp"],
      });

      if (!sendResult.sent) {
        console.error("Mailgun OTP email send failed:", sendResult.reason);
        return new Response(
          JSON.stringify({ error: "Failed to send email" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      maskedContact = maskEmail(vendor.email);
    } else {
      // SMS channel via Twilio
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

      if (!twilioSid || !twilioToken || !twilioFrom) {
        console.error("TWILIO credentials missing — sid:", !!twilioSid, "token:", !!twilioToken, "from:", !!twilioFrom);
        return new Response(
          JSON.stringify({ error: "SMS service not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const smsContent = `Your CETHOS login code is: ${otpCode}. Expires in 10 minutes.`;
      const basicAuth = btoa(`${twilioSid}:${twilioToken}`);

      const formBody = new URLSearchParams({
        To: vendor.phone,
        From: twilioFrom,
        Body: smsContent,
      });

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
        try {
          detail = JSON.parse(errBody);
        } catch {
          detail = errBody;
        }
        return new Response(
          JSON.stringify({ error: "SMS delivery failed", detail }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      maskedContact = maskPhone(vendor.phone!);
    }

    return new Response(
      JSON.stringify({
        success: true,
        channel,
        masked_contact: maskedContact,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-auth-otp-send error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
