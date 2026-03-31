import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const provinceCode = url.searchParams.get("province_code");

    if (provinceCode) {
      // Return single province tax info
      const { data, error } = await supabase
        .from("tax_rates")
        .select("region_code, region_name, tax_name, rate")
        .eq("region_type", "province")
        .eq("region_code", provinceCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Province not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          tax_name: data.tax_name,
          tax_rate: parseFloat(data.rate),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return all provinces
    const { data: provinces, error: provErr } = await supabase
      .from("tax_rates")
      .select("region_code, region_name, tax_name, rate")
      .eq("region_type", "province")
      .eq("is_active", true)
      .order("region_name");

    if (provErr) {
      console.error("lookup-tax-rate error:", provErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch provinces" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        provinces: provinces || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("lookup-tax-rate error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
