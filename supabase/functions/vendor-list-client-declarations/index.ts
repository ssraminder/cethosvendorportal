// vendor-list-client-declarations
//
// Lists the vendor's NDA clause-3.4 pre-existing-client declarations
// with review status and short-lived signed URLs for their evidence
// files. Service-role read; vendor identified by session token.
//
// Body (JSON): {} — no parameters.
// Auth: vendor session token in Authorization: Bearer <token>.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BUCKET = "vendor-declarations";
const URL_EXPIRY_SECONDS = 60 * 60;

interface EvidenceFile {
  path: string;
  name: string;
  size_bytes: number;
  content_type: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ success: false, error: "auth_required" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error: sessionErr } = await supabase
      .from("vendor_sessions")
      .select("vendor_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sessionErr || !session) {
      return json({ success: false, error: "invalid_session" }, 401);
    }

    const { data: rows, error: listErr } = await supabase
      .from("vendor_client_declarations")
      .select("id, client_name, relationship_details, first_engaged_date, evidence_files, status, review_notes, reviewed_at, created_at")
      .eq("vendor_id", session.vendor_id)
      .order("created_at", { ascending: false });
    if (listErr) {
      return json({ success: false, error: "list_failed", detail: listErr.message }, 500);
    }

    const declarations = [];
    for (const row of rows ?? []) {
      const evidence = [];
      for (const f of (row.evidence_files ?? []) as EvidenceFile[]) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(f.path, URL_EXPIRY_SECONDS);
        evidence.push({ ...f, url: signed?.signedUrl ?? null });
      }
      declarations.push({ ...row, evidence_files: evidence });
    }

    return json({ success: true, declarations });
  } catch (e) {
    console.error("vendor-list-client-declarations error:", e);
    return json(
      { success: false, error: "internal_error", detail: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
