import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CertUploadRequest {
  action: "add" | "remove";
  cert_name: string;
  expiry_date?: string;
  file_base64?: string;
  file_name?: string;
  file_type?: string;
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

    const body = await req.json() as CertUploadRequest;

    if (!body.action || !body.cert_name) {
      return new Response(
        JSON.stringify({ error: "action and cert_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current certifications from vendors table
    const { data: vendor } = await supabase
      .from("vendors")
      .select("certifications")
      .eq("id", session.vendor_id)
      .single();

    if (!vendor) {
      return new Response(
        JSON.stringify({ error: "Vendor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const certs = (vendor.certifications as Array<Record<string, unknown>>) || [];

    if (body.action === "add") {
      // Upload file to storage if provided
      let storagePath: string | null = null;
      if (body.file_base64 && body.file_name) {
        const fileData = Uint8Array.from(atob(body.file_base64), (c) => c.charCodeAt(0));
        const path = `vendor-certs/${session.vendor_id}/${Date.now()}-${body.file_name}`;

        const { error: uploadErr } = await supabase.storage
          .from("vendor-certifications")
          .upload(path, fileData, {
            contentType: body.file_type || "application/pdf",
            upsert: false,
          });

        if (uploadErr) {
          console.error("Failed to upload cert file:", uploadErr);
          // Continue without file — cert record is still useful
        } else {
          storagePath = path;
        }
      }

      const newCert: Record<string, unknown> = {
        name: body.cert_name,
        expiry_date: body.expiry_date || null,
        storage_path: storagePath,
        added_at: new Date().toISOString(),
        verified: false,
      };

      certs.push(newCert);
    } else if (body.action === "remove") {
      const index = certs.findIndex((c) => c.name === body.cert_name);
      if (index === -1) {
        return new Response(
          JSON.stringify({ error: "Certification not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remove file from storage if exists
      const removedCert = certs[index];
      if (removedCert.storage_path) {
        await supabase.storage
          .from("vendor-certifications")
          .remove([removedCert.storage_path as string]);
      }

      certs.splice(index, 1);
    }

    // Update vendors table
    const { error: updateErr } = await supabase
      .from("vendors")
      .update({ certifications: certs, updated_at: new Date().toISOString() })
      .eq("id", session.vendor_id);

    if (updateErr) {
      console.error("Failed to update certifications:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update certifications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also update cvp_translators if exists
    await supabase
      .from("cvp_translators")
      .update({ certifications: certs })
      .eq("email", (await supabase.from("vendors").select("email").eq("id", session.vendor_id).single()).data?.email);

    return new Response(
      JSON.stringify({ success: true, certifications: certs }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-upload-certification error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
