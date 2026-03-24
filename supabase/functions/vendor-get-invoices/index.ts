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
      .from("cvp_payments")
      .select("*", { count: "exact" })
      .eq("vendor_id", session.vendor_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data: invoices, count, error: invoicesErr } = await query;

    if (invoicesErr) {
      console.error("Failed to fetch invoices:", invoicesErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get job references for invoices with job_ids
    const jobIds = [...new Set((invoices || []).map((i: Record<string, unknown>) => i.job_id).filter(Boolean))];
    let jobMap = new Map<string, string>();
    if (jobIds.length > 0) {
      const { data: jobs } = await supabase
        .from("cvp_jobs")
        .select("id, job_reference")
        .in("id", jobIds);
      if (jobs) {
        jobMap = new Map(jobs.map((j: Record<string, unknown>) => [j.id as string, j.job_reference as string]));
      }
    }

    const enrichedInvoices = (invoices || []).map((inv: Record<string, unknown>) => ({
      ...inv,
      job_reference: jobMap.get(inv.job_id as string) || null,
    }));

    // Calculate summary
    const allInvoices = enrichedInvoices;
    const totalEarned = allInvoices
      .filter((i: Record<string, unknown>) => i.status === "paid")
      .reduce((sum: number, i: Record<string, unknown>) => sum + (i.total_amount as number), 0);
    const pendingAmount = allInvoices
      .filter((i: Record<string, unknown>) => ["pending", "submitted", "approved"].includes(i.status as string))
      .reduce((sum: number, i: Record<string, unknown>) => sum + (i.total_amount as number), 0);
    const lastPaid = allInvoices
      .filter((i: Record<string, unknown>) => i.paid_at)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.paid_at as string).getTime() - new Date(a.paid_at as string).getTime()
      )[0];

    return new Response(
      JSON.stringify({
        success: true,
        invoices: enrichedInvoices,
        total: count,
        summary: {
          total_earned: totalEarned,
          pending_amount: pendingAmount,
          last_payment_date: lastPaid?.paid_at || null,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-get-invoices error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
