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

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("cvp_jobs")
      .select("*", { count: "exact" })
      .eq("vendor_id", session.vendor_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data: jobs, count, error: jobsErr } = await query;

    if (jobsErr) {
      console.error("Failed to fetch jobs:", jobsErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch jobs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch language names for all jobs
    const sourceLangIds = [...new Set((jobs || []).map((j: Record<string, unknown>) => j.source_language_id).filter(Boolean))];
    const targetLangIds = [...new Set((jobs || []).map((j: Record<string, unknown>) => j.target_language_id).filter(Boolean))];
    const allLangIds = [...new Set([...sourceLangIds, ...targetLangIds])];

    let langMap = new Map<string, Record<string, unknown>>();
    if (allLangIds.length > 0) {
      const { data: langs } = await supabase
        .from("languages")
        .select("id, name, code")
        .in("id", allLangIds);
      if (langs) {
        langMap = new Map(langs.map((l: Record<string, unknown>) => [l.id as string, l]));
      }
    }

    const enrichedJobs = (jobs || []).map((job: Record<string, unknown>) => ({
      ...job,
      source_language: langMap.get(job.source_language_id as string) || null,
      target_language: langMap.get(job.target_language_id as string) || null,
    }));

    return new Response(
      JSON.stringify({ success: true, jobs: enrichedJobs, total: count }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-get-jobs error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
