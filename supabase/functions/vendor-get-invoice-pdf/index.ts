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

    const { invoice_id } = await req.json() as { invoice_id: string };

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: invoice, error: invoiceErr } = await supabase
      .from("cvp_payments")
      .select("id, invoice_pdf_path")
      .eq("id", invoice_id)
      .eq("vendor_id", session.vendor_id)
      .single();

    if (invoiceErr || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoice.invoice_pdf_path) {
      return new Response(
        JSON.stringify({ error: "PDF not yet available for this invoice" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generated (self-billed) invoices are written by generate-vendor-invoice
    // to the `vendor-invoices` bucket as generated/<vendor>/<payment>.pdf;
    // older staff-produced PDFs live in `vendor-deliveries`. Pick the bucket
    // the path implies, then try the other so no historical path 404s.
    const pdfPath = invoice.invoice_pdf_path as string;
    const buckets = pdfPath.startsWith("generated/")
      ? ["vendor-invoices", "vendor-deliveries"]
      : ["vendor-deliveries", "vendor-invoices"];
    let signedUrl: string | null = null;
    for (const bucket of buckets) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(pdfPath, 3600);
      if (data?.signedUrl) {
        signedUrl = data.signedUrl;
        break;
      }
    }

    if (!signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate download URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, signed_url: signedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-get-invoice-pdf error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
