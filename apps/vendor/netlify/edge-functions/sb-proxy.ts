/**
 * Netlify Edge Function: proxy `/sb/<function>` requests to Supabase
 * Custom Domain (api.cethos.com/functions/v1/<function>).
 *
 * Why this exists:
 *   Netlify's TOML redirect splat (`:splat`) doesn't expand for external
 *   URL destinations — it forwards the literal string `:splat`. Without
 *   this Edge Function, the proxy returns Supabase NOT_FOUND for every
 *   call. With it, every same-origin /sb/* call is rewritten upstream
 *   correctly.
 *
 * What this enables:
 *   Same-origin auth for the vendor portal. No CORS preflight, which
 *   means state-level network filters that drop OPTIONS requests
 *   (confirmed: Egypt, China) can't block login or function calls.
 *
 * Route binding lives in netlify.toml under [[edge_functions]].
 */

import type { Context } from "https://edge.netlify.com/";

export default async (request: Request, _context: Context): Promise<Response> => {
  const url = new URL(request.url);

  // Strip the /sb/ prefix; what remains is the Supabase function name
  // (plus any subpath, plus query string).
  const fn = url.pathname.replace(/^\/sb\//, "");
  if (!fn) {
    return new Response("Bad proxy request: empty function name", { status: 400 });
  }

  const upstreamUrl = `https://api.cethos.com/functions/v1/${fn}${url.search}`;

  // Clone the request to the new URL, preserving method, headers, body.
  // Headers are kept verbatim — auth/apikey/content-type all forwarded.
  const upstreamReq = new Request(upstreamUrl, {
    method: request.method,
    headers: request.headers,
    body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
    redirect: "manual",
  });

  try {
    return await fetch(upstreamReq);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "proxy_upstream_unreachable",
        detail: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config = { path: "/sb/*" };
