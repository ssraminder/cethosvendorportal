import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeliveryRequest {
  job_id: string;
  file_base64: string;
  file_name: string;
  file_type: string;
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

    const body = await req.json() as DeliveryRequest;

    if (!body.job_id || !body.file_base64 || !body.file_name) {
      return new Response(
        JSON.stringify({ error: "job_id, file_base64, and file_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify job belongs to vendor and is in a deliverable status
    const { data: job, error: jobErr } = await supabase
      .from("cvp_jobs")
      .select("id, status, delivery_file_paths")
      .eq("id", body.job_id)
      .eq("vendor_id", session.vendor_id)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deliverableStatuses = ["accepted", "in_progress", "revision_requested"];
    if (!deliverableStatuses.includes(job.status)) {
      return new Response(
        JSON.stringify({ error: `Cannot deliver for job with status '${job.status}'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload file to storage
    const fileData = Uint8Array.from(atob(body.file_base64), (c) => c.charCodeAt(0));
    const storagePath = `deliveries/${session.vendor_id}/${body.job_id}/${Date.now()}-${body.file_name}`;

    const { error: uploadErr } = await supabase.storage
      .from("vendor-deliveries")
      .upload(storagePath, fileData, {
        contentType: body.file_type || "application/octet-stream",
        upsert: false,
      });

    if (uploadErr) {
      console.error("Failed to upload delivery file:", uploadErr);
      return new Response(
        JSON.stringify({ error: "Failed to upload file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job with delivery info
    const existingPaths = (job.delivery_file_paths as string[]) || [];
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("cvp_jobs")
      .update({
        status: "delivered",
        delivered_at: now,
        delivery_file_paths: [...existingPaths, storagePath],
        delivery_notes: body.notes || null,
        updated_at: now,
      })
      .eq("id", body.job_id);

    if (updateErr) {
      console.error("Failed to update job:", updateErr);
      return new Response(
        JSON.stringify({ error: "File uploaded but failed to update job status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-upload-delivery error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
