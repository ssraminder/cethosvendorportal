/**
 * cvp-get-my-domains
 *
 * Read-only helper for the vendor portal's Request-Test page (T3). Takes
 * a vendor session token, returns the authenticated translator's full
 * cvp_translator_domains set plus the language records needed to render
 * pair labels.
 *
 * Kept separate from cvp-request-test so the UI can poll state without
 * mutating anything, and so RLS on cvp_translator_domains (service_role
 * only) isn't punched open for the anon key.
 *
 * Body: {}  (no fields needed; translator is derived from session)
 * Response: {
 *   success: true,
 *   data: {
 *     translator_id,
 *     rows: [...cvp_translator_domains rows, columns below],
 *     languages: [{ id, name, code } ...]
 *   }
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  // Dual auth: prefer session_token from the body (works regardless of
  // verify_jwt at the gateway), fall back to Authorization: Bearer for
  // backwards compatibility with existing callers that pass the vendor
  // session token in the header. The body path lets us send the anon
  // key as Authorization (gateway-valid JWT) while still carrying the
  // vendor session UUID as a string — robust to MCP redeploys that flip
  // verify_jwt back to true.
  let bodyToken: string | null = null;
  let parsedBody: Record<string, unknown> = {};
  try {
    parsedBody = await req.clone().json().catch(() => ({}));
    if (typeof parsedBody?.session_token === "string") {
      bodyToken = parsedBody.session_token;
    }
  } catch {
    /* ignore — body is optional */
  }
  const headerToken = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  // Treat anon-key-shaped JWTs (start with "eyJ") in the header as gateway
  // envelopes, not as a vendor session. The vendor session is a plain
  // UUID; the anon key is a JWT.
  const headerIsAnonJwt = headerToken.startsWith("eyJ");
  const token = bodyToken ?? (headerIsAnonJwt ? null : headerToken);
  if (!token) return json({ success: false, error: "unauthenticated" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: session } = await supabase
    .from("vendor_sessions")
    .select("vendor_id, expires_at")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session) return json({ success: false, error: "unauthenticated" }, 401);

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, email")
    .eq("id", session.vendor_id)
    .single();
  if (!vendor) return json({ success: false, error: "vendor_not_found" }, 404);

  const { data: translator } = await supabase
    .from("cvp_translators")
    .select("id")
    .eq("email", vendor.email)
    .maybeSingle();
  if (!translator) {
    return json({
      success: true,
      data: { translator_id: null, rows: [], languages: [] },
    });
  }

  const { data: rows } = await supabase
    .from("cvp_translator_domains")
    .select(
      "id, source_language_id, target_language_id, domain, status, cooldown_until, approval_source, approved_at, rejected_at",
    )
    .eq("translator_id", translator.id);

  const domainRows = rows ?? [];
  const ids = Array.from(
    new Set(
      domainRows.flatMap((r) => [r.source_language_id, r.target_language_id]),
    ),
  );
  const { data: languages } =
    ids.length > 0
      ? await supabase.from("languages").select("id, name, code").in("id", ids)
      : { data: [] };

  // Enrich each domain row with the latest cvp_test_submission for that
  // (source, target, domain) tuple — used by /competence-tests to surface
  // an "Open test" link on in-progress cells and a "View scorecard" link
  // on approved/rejected cells. Lookup is keyed by the translator's
  // application_id; for translators without an application, we just
  // return empty submission info.
  const { data: app } = await supabase
    .from("cvp_applications")
    .select("id")
    .eq("email", vendor.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let rowsWithTests = domainRows.map((r) => ({ ...r, latest_submission: null as Record<string, unknown> | null }));

  if (app && domainRows.length > 0) {
    const { data: combos } = await supabase
      .from("cvp_test_combinations")
      .select("id, source_language_id, target_language_id, domain")
      .eq("application_id", app.id);

    const enriched: typeof rowsWithTests = [];
    for (const r of rowsWithTests) {
      const matchingCombos = (combos ?? []).filter(
        (c) =>
          c.source_language_id === r.source_language_id
          && c.target_language_id === r.target_language_id
          && c.domain === r.domain,
      );
      if (matchingCombos.length === 0) {
        enriched.push(r);
        continue;
      }
      const { data: subs } = await supabase
        .from("cvp_test_submissions")
        .select("id, token, token_expires_at, status, ai_assessment_score, submitted_at, created_at, tm_job_id, tm_job_url")
        .in("combination_id", matchingCombos.map((c) => c.id))
        .order("created_at", { ascending: false })
        .limit(1);
      const submission = subs?.[0] ?? null;
      // For graded submissions, look up the matching feedback round —
      // its `token` powers /test-feedback/:token, the scorecard view.
      // The submission's own token only opens /test/:token (taking).
      let feedback_token: string | null = null;
      if (submission?.id) {
        const { data: fr } = await supabase
          .from("cvp_test_feedback_rounds")
          .select("token")
          .eq("submission_id", submission.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        feedback_token = (fr?.token as string | undefined) ?? null;
      }
      enriched.push({ ...r, latest_submission: submission ? { ...submission, feedback_token } : null });
    }
    rowsWithTests = enriched;
  }

  return json({
    success: true,
    data: {
      translator_id: translator.id,
      rows: rowsWithTests,
      languages: languages ?? [],
      // Public base URL for /test/:token and /test-feedback/:token links.
      // Mirrors the APP_URL convention used by cvp-send-test-feedback-request.
      app_url: Deno.env.get("APP_URL") ?? "https://join.cethos.com",
    },
  });
});
