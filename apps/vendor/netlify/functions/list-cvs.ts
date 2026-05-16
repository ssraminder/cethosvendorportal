/**
 * Netlify Function: list-cvs
 *
 * Same-origin proxy for the `vendor-list-cvs` Supabase Edge Function.
 * Same rationale as upload-cv.ts: the direct api.cethos.com call is
 * geo-blocked in some regions; routing through Netlify keeps the
 * vendor's browser on vendor.cethos.com only.
 *
 * POST /sb/list-cvs
 * Body: { session_token: string }
 * Returns: { success: boolean, cvs?: VendorCv[], error?: string }
 *
 * The session lives in the body (text/plain content-type → simple CORS
 * request) — same convention as the rest of the /sb/* surface. The
 * Lambda forwards as Authorization: Bearer to the upstream edge
 * function (which expects the bearer header).
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const UPSTREAM = `${SUPABASE_URL}/functions/v1/vendor-list-cvs`;

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

  let parsed: { session_token?: string } = {};
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

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      body: text,
      headers: { "Content-Type": "application/json", ...cors },
    };
  } catch (e) {
    console.error("list-cvs proxy error:", e);
    return {
      statusCode: 502,
      body: JSON.stringify({
        success: false,
        error: "Upstream list failed",
        detail: e instanceof Error ? e.message : String(e),
      }),
      headers: { "Content-Type": "application/json", ...cors },
    };
  }
};
