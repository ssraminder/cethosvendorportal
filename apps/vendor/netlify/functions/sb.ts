/**
 * Netlify Function (Lambda): proxy `/sb/<fn>` → Supabase Custom Domain.
 *
 * Runs on AWS Lambda. Different network than Netlify Edge Functions
 * (which run on Cloudflare and exhibit a CF-to-CF peer block when
 * reaching Supabase's CF-fronted edge).
 *
 * Same-origin to vendor.cethos.com → no CORS preflight → bypasses
 * state-level filters (Egypt, China) that drop OPTIONS requests.
 *
 * Bound to /sb/* via netlify.toml redirect.
 */

// Trying direct supabase.co — Custom Domain returned NOT_FOUND from both
// Netlify Edge and Lambda. Possibly Supabase Custom Domain has stricter
// origin/IP validation that rejects cloud-provider IPs.
const SUPABASE_BASE = "https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1";

interface NetlifyEvent {
  path: string;
  rawUrl?: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  // Parse the function name. /sb/<fn> arrives as either:
  //   - /.netlify/functions/sb/<fn> (raw)
  //   - /sb/<fn>                    (after redirect rewrite)
  const rawUrl = event.rawUrl || `http://x${event.path}`;
  const url = new URL(rawUrl);
  const fn = url.pathname.replace(/^\/(\.netlify\/functions\/)?sb\/?/, "");
  if (!fn) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Empty function name" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  const upstreamUrl = `${SUPABASE_BASE}/${fn}${url.search}`;

  // Whitelist headers. Don't forward Host / X-Forwarded-* — let fetch()
  // set them based on the upstream URL.
  const fwd: Record<string, string> = {};
  const passThrough = ["authorization", "apikey", "content-type", "x-client-info", "accept"];
  for (const [k, v] of Object.entries(event.headers || {})) {
    if (passThrough.includes(k.toLowerCase()) && typeof v === "string") {
      fwd[k.toLowerCase()] = v;
    }
  }
  if (!fwd["content-type"] && event.body) {
    fwd["content-type"] = "application/json";
  }

  let body: string | undefined;
  if (!["GET", "HEAD"].includes(event.httpMethod) && event.body) {
    body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf-8")
      : event.body;
  }

  try {
    const res = await fetch(upstreamUrl, {
      method: event.httpMethod,
      headers: fwd,
      body,
    });
    const text = await res.text();
    return {
      statusCode: res.status,
      body: text,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-Proxy-Upstream": upstreamUrl,
      },
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: "proxy_upstream_unreachable",
        detail: err instanceof Error ? err.message : String(err),
        upstream: upstreamUrl,
      }),
      headers: { "Content-Type": "application/json" },
    };
  }
};
