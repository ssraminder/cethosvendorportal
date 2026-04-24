import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMailgunOperationalEmail } from "../_shared/mailgun.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InviteRequest {
  email: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = (await req.json()) as InviteRequest;

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

    // Look up vendor
    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("id, full_name, email, phone")
      .eq("email", normalizedEmail)
      .single();

    if (vendorErr || !vendor) {
      return new Response(
        JSON.stringify({ error: "No vendor found for this email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate any existing activation tokens for this vendor
    await supabase
      .from("vendor_otp")
      .update({ verified: true })
      .eq("vendor_id", vendor.id)
      .eq("channel", "activation")
      .eq("verified", false);

    // Generate activation token (UUID)
    const activationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours

    const { error: insertErr } = await supabase.from("vendor_otp").insert({
      vendor_id: vendor.id,
      email: vendor.email,
      phone: vendor.phone,
      channel: "activation",
      otp_code: activationToken,
      expires_at: expiresAt,
    });

    if (insertErr) {
      console.error("Failed to create activation token:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to generate activation link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build activation URL
    const appUrl = Deno.env.get("VENDOR_APP_URL") || "https://vendor.cethos.com";
    const activationUrl = `${appUrl}/activate?token=${activationToken}`;

    // Send invitation email via Mailgun
    if (!Deno.env.get("MAILGUN_API_KEY") || !Deno.env.get("MAILGUN_DOMAIN")) {
      console.error("MAILGUN_API_KEY or MAILGUN_DOMAIN not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured", activation_url: activationUrl }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; padding: 30px 0;">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="24" fill="#0F9DA0"/>
            <path d="M26.5 14C20.15 14 15 19.15 15 25.5C15 31.85 20.15 37 26.5 37C29.5 37 32.2 35.8 34.2 33.8L31.4 31C30.1 32.3 28.4 33 26.5 33C22.36 33 19 29.64 19 25.5C19 21.36 22.36 18 26.5 18C28.4 18 30.1 18.7 31.4 20L34.2 17.2C32.2 15.2 29.5 14 26.5 14Z" fill="white"/>
          </svg>
          <h1 style="color: #111827; font-size: 24px; margin: 16px 0 0;">CETHOS</h1>
          <div style="height: 3px; width: 60px; background: #0F9DA0; margin: 12px auto;"></div>
        </div>
        <div style="padding: 0 24px;">
          <p style="color: #374151; font-size: 16px;"><strong>Hi ${vendor.full_name},</strong></p>
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            You've been invited to join the CETHOS Vendor Portal where you can manage your projects,
            submit deliverables, and track payments.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${activationUrl}" style="display: inline-block; padding: 14px 32px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
              Set Up Your Account
            </a>
          </div>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.5;">
              This link expires in 72 hours. If it has expired, contact your CETHOS project manager to receive a new one.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 13px;">
            Questions? <a href="mailto:support@cethos.com" style="color: #2563eb;">support@cethos.com</a>
          </p>
        </div>
      </div>
    `;

    const sendResult = await sendMailgunOperationalEmail({
      to: { email: vendor.email, name: vendor.full_name },
      subject: "You're invited to the CETHOS Vendor Portal",
      html: htmlContent,
      tags: ["vendor-invite"],
    });

    if (!sendResult.sent) {
      console.error("Mailgun invite email send failed:", sendResult.reason);
      return new Response(
        JSON.stringify({ error: "Failed to send invitation email", activation_url: activationUrl }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update cvp_translators invite_sent_at
    await supabase
      .from("cvp_translators")
      .update({ invite_sent_at: new Date().toISOString() })
      .eq("email", normalizedEmail);

    return new Response(
      JSON.stringify({
        success: true,
        activation_url: activationUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-auth-invite error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
