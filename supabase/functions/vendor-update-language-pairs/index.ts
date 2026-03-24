import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LanguagePairRequest {
  action: "add" | "remove" | "toggle";
  language_pair_id?: string;
  source_language?: string;
  target_language?: string;
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

    const body = await req.json() as LanguagePairRequest;

    if (!body.action || !["add", "remove", "toggle"].includes(body.action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be add, remove, or toggle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "add") {
      if (!body.source_language || !body.target_language) {
        return new Response(
          JSON.stringify({ error: "source_language and target_language are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from("vendor_language_pairs")
        .select("id")
        .eq("vendor_id", session.vendor_id)
        .eq("source_language", body.source_language)
        .eq("target_language", body.target_language)
        .single();

      if (existing) {
        // Reactivate if inactive
        await supabase
          .from("vendor_language_pairs")
          .update({ is_active: true })
          .eq("id", existing.id);

        return new Response(
          JSON.stringify({ success: true, message: "Language pair reactivated" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: insertErr } = await supabase
        .from("vendor_language_pairs")
        .insert({
          vendor_id: session.vendor_id,
          source_language: body.source_language,
          target_language: body.target_language,
          notes: body.notes || null,
          is_active: true,
        });

      if (insertErr) {
        console.error("Failed to add language pair:", insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to add language pair" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (body.action === "remove") {
      if (!body.language_pair_id) {
        return new Response(
          JSON.stringify({ error: "language_pair_id is required for remove" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Soft delete — set is_active = false
      const { error: updateErr } = await supabase
        .from("vendor_language_pairs")
        .update({ is_active: false })
        .eq("id", body.language_pair_id)
        .eq("vendor_id", session.vendor_id);

      if (updateErr) {
        console.error("Failed to remove language pair:", updateErr);
        return new Response(
          JSON.stringify({ error: "Failed to remove language pair" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (body.action === "toggle") {
      if (!body.language_pair_id) {
        return new Response(
          JSON.stringify({ error: "language_pair_id is required for toggle" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: pair } = await supabase
        .from("vendor_language_pairs")
        .select("is_active")
        .eq("id", body.language_pair_id)
        .eq("vendor_id", session.vendor_id)
        .single();

      if (!pair) {
        return new Response(
          JSON.stringify({ error: "Language pair not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("vendor_language_pairs")
        .update({ is_active: !pair.is_active })
        .eq("id", body.language_pair_id)
        .eq("vendor_id", session.vendor_id);
    }

    // Return updated list
    const { data: languagePairs } = await supabase
      .from("vendor_language_pairs")
      .select("id, source_language, target_language, is_active, notes, created_at")
      .eq("vendor_id", session.vendor_id)
      .order("source_language");

    return new Response(
      JSON.stringify({ success: true, language_pairs: languagePairs || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-update-language-pairs error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
