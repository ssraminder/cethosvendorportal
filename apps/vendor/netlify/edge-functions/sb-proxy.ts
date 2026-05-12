/**
 * Netlify Edge Function: proxy `/sb/<function>` → Supabase Custom Domain
 * at api.cethos.com/functions/v1/<function>.
 *
 * Same-origin path → no CORS preflight → bypasses state-level filters
 * (Egypt, China) that drop OPTIONS requests.
 */

export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const fn = url.pathname.replace(/^\/sb\//, "");
  if (!fn) {
    return new Response("Bad proxy request: empty function name", { status: 400 });
  }

  const upstreamUrl = `https://api.cethos.com/functions/v1/${fn}${url.search}`;

  // Forward only the specific headers Supabase functions need. Whitelist
  // approach: lets fetch() set Host / Content-Length / etc. itself based
  // on the upstream URL and body. Stripping Host was tried via header
  // .delete() — didn't work because Deno's Request constructor copies
  // headers verbatim. Whitelist is more reliable.
  const fwd = new Headers();
  const passThrough = [
    "authorization",
    "apikey",
    "content-type",
    "x-client-info",
    "accept",
  ];
  for (const h of passThrough) {
    const v = request.headers.get(h);
    if (v) fwd.set(h, v);
  }

  // Buffer the body so fetch() sets Content-Length correctly. Streaming
  // bodies through Netlify Edge to a fetch upstream is occasionally
  // unreliable; buffering is small and safe for auth payloads.
  let body: string | null = null;
  if (!["GET", "HEAD"].includes(request.method)) {
    body = await request.text();
  }

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: request.method,
      headers: fwd,
      body,
    });
    // Re-emit response with CORS open (just in case some browser cares).
    const resHeaders = new Headers(upstreamRes.headers);
    resHeaders.set("Access-Control-Allow-Origin", "*");
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "proxy_upstream_unreachable",
        detail: err instanceof Error ? err.message : String(err),
        upstream: upstreamUrl,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const config = { path: "/sb/*" };
