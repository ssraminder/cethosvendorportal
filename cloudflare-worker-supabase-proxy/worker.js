/**
 * Cethos Supabase Proxy — Cloudflare Worker
 *
 * Forwards requests to lmzoyezvsjgsxveoakdr.supabase.co so vendor portal
 * users in regions where Supabase's edge is blocked / throttled (we've
 * confirmed China + Egypt) can still reach the auth, database, functions,
 * realtime, and storage endpoints.
 *
 * Deploy:
 *   1. wrangler login
 *   2. wrangler deploy
 *   3. Bind a route in Cloudflare dashboard:
 *        api.cethos.com/*   →   cethos-supabase-proxy
 *   4. Set VITE_SUPABASE_URL=https://api.cethos.com in Netlify env vars
 *      for the vendor portal site, redeploy.
 *
 * Cost: free tier covers 100k requests/day — login + a few hours of
 * vendor activity per vendor is comfortably under that. Each request
 * adds ~30-50ms latency depending on Cloudflare edge proximity.
 *
 * Security notes:
 * - This is a transparent proxy. No auth check, no body inspection.
 *   Supabase's gateway + per-function auth still enforces everything.
 * - CORS: we strip and replace Access-Control-Allow-Origin to allow
 *   any origin (the vendor portal can be served from multiple Netlify
 *   preview URLs). Tighten to specific origins if you want to lock down.
 * - Realtime (websockets) is proxied via standard WebSocket upgrade.
 */

const UPSTREAM_HOST = "lmzoyezvsjgsxveoakdr.supabase.co";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Health probe — useful for the vendor portal's "Test connection" button.
    if (url.pathname === "/__proxy_health") {
      return new Response(
        JSON.stringify({
          ok: true,
          upstream: UPSTREAM_HOST,
          cf_colo: request.cf?.colo ?? null,
          country: request.cf?.country ?? null,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Rewrite host to Supabase, keep everything else.
    const upstreamUrl = new URL(url.toString());
    upstreamUrl.host = UPSTREAM_HOST;
    upstreamUrl.protocol = "https:";
    upstreamUrl.port = "";

    // Clone request with new URL. Preserve method, body, headers.
    // Strip CF-specific headers that confuse Supabase / leak proxy identity.
    const headers = new Headers(request.headers);
    headers.set("Host", UPSTREAM_HOST);
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    headers.delete("x-forwarded-host");

    // Forward client IP so Supabase can log it (for our audit trails).
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("x-forwarded-for", clientIp);

    const upstreamReq = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
      redirect: "manual",
    });

    let upstreamRes;
    try {
      upstreamRes = await fetch(upstreamReq);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "proxy_upstream_unreachable",
          detail: err.message ?? String(err),
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Pass through response. Force permissive CORS so the vendor portal
    // (on whichever Netlify URL) can read it.
    const responseHeaders = new Headers(upstreamRes.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type, range");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    responseHeaders.set("Access-Control-Expose-Headers", "content-range, x-supabase-api-version");

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  },
};
