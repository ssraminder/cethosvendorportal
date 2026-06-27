/**
 * Netlify Function: get-invoices
 *
 * Same-origin proxy for the `vendor-get-invoices` Supabase Edge Function.
 * Same rationale as list-cvs.ts: the direct api.cethos.com call carried
 * the session token in an Authorization header, which forces a CORS
 * preflight (OPTIONS). State-level filters in some regions (Egypt, China)
 * drop the preflight, so the Invoices page never loaded for those vendors.
 * Routing through Netlify keeps the browser on vendor.cethos.com only and
 * carries the token in a text/plain body (CORS simple request, no
 * preflight); the Lambda forwards it upstream as Authorization: Bearer.
 *
 * POST /sb/get-invoices
 * Body: { session_token: string, status?: string, page?: number, limit?: number }
 * Returns: vendor-get-invoices' JSON verbatim.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const UPSTREAM = `${SUPABASE_URL}/functions/v1/vendor-get-invoices`;

export const handler = async (event: {
  httpMethod?: string;
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<{
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}> => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, body: "", headers: cors };
  }

  if (!SUPABASE_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "SUPABASE_URL not configured" }),
      headers: { "Content-Type": "application/json", ...cors },
    };
  }

  let parsed: { session_token?: string; status?: string; page?: number; limit?: number } = {};
  try {
    const raw =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf-8")
        : event.body || "{}";
    parsed = JSON.parse(raw);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "invalid_json" }),
      headers: { "Content-Type": "application/json", ...cors },
    };
  }

  const sessionToken = parsed.session_token?.trim();
  if (!sessionToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({ success: false, error: "session_token required" }),
      headers: { "Content-Type": "application/json", ...cors },
    };
  }

  // The upstream reads status/page/limit from the query string (GET).
  const qs = new URLSearchParams();
  if (parsed.status) qs.set("status", String(parsed.status));
  if (parsed.page) qs.set("page", String(parsed.page));
  if (parsed.limit) qs.set("limit", String(parsed.limit));
  const upstreamUrl = qs.toString() ? `${UPSTREAM}?${qs.toString()}` : UPSTREAM;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      body: text,
      headers: { "Content-Type": "application/json", ...cors },
    };
  } catch (e) {
    console.error("get-invoices proxy error:", e);
    return {
      statusCode: 502,
      body: JSON.stringify({
        success: false,
        error: "Upstream invoices fetch failed",
        detail: e instanceof Error ? e.message : String(e),
      }),
      headers: { "Content-Type": "application/json", ...cors },
    };
  }
};
