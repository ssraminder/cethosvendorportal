/**
 * DEBUG version: echoes URL parsing + does the actual fetch.
 * Will revert after we figure out what's wrong.
 */

export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const fn = url.pathname.replace(/^\/sb\//, "");
  const upstreamUrl = `https://api.cethos.com/functions/v1/${fn}${url.search}`;

  // Debug path: hit /sb/__debug to see what URL gets constructed
  if (fn === "__debug") {
    return new Response(
      JSON.stringify({
        request_url: request.url,
        pathname: url.pathname,
        fn_parsed: fn,
        upstream_would_be: upstreamUrl,
        method: request.method,
      }, null, 2),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // Forward with explicit hardcoded upstream URL — bypasses any URL
  // construction issues
  const fwd = new Headers();
  for (const h of ["authorization", "apikey", "content-type", "x-client-info", "accept"]) {
    const v = request.headers.get(h);
    if (v) fwd.set(h, v);
  }

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
    const text = await upstreamRes.text();
    const resHeaders = new Headers();
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Content-Type", upstreamRes.headers.get("Content-Type") || "application/json");
    resHeaders.set("X-Proxy-Upstream", upstreamUrl);
    resHeaders.set("X-Proxy-Status", String(upstreamRes.status));
    return new Response(text, {
      status: upstreamRes.status,
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
