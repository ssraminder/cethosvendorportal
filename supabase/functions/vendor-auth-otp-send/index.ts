import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
  // Keep country code prefix (up to first few chars) and last 2 digits
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

    // Send OTP via Brevo
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let maskedContact: string;

    if (channel === "email") {
      const htmlContent = `<p>Hi ${vendor.full_name},</p><p>Your login code is: <strong>${otpCode}</strong></p><p>This code expires in 10 minutes.</p><p>If you did not request this, ignore this email.</p>`;

      const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "CETHOS", email: "donotreply@cethos.com" },
          to: [{ email: vendor.email, name: vendor.full_name }],
          subject: "Your CETHOS login code",
          htmlContent,
        }),
      });

      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        console.error("Brevo email send failed:", emailRes.status, errBody);
        return new Response(
          JSON.stringify({ error: "Failed to send email" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      maskedContact = maskEmail(vendor.email);
    } else {
      // SMS channel
      const smsContent = `Your CETHOS login code is: ${otpCode}. Expires in 10 minutes.`;

      const smsRes = await fetch(
        "https://api.brevo.com/v3/transactionalSMS/sms",
        {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: "CETHOS",
            recipient: vendor.phone,
            content: smsContent,
            type: "transactional",
          }),
        }
      );

      if (!smsRes.ok) {
        const errBody = await smsRes.text();
        console.error("Brevo SMS send failed:", smsRes.status, errBody);
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
