// Single source of truth for the Supabase Edge Functions base URL.
//
// Routes direct to Supabase Custom Domain (api.cethos.com via Supabase
// Pro). All POSTs go out with Content-Type: text/plain — a CORS
// "simple request" type that does NOT trigger an OPTIONS preflight.
// State-level filters (Egypt, China) that drop preflights have nothing
// to drop; the actual POST goes through. See safePost() helper below.
//
// The Supabase function parses the body with req.json() regardless of
// Content-Type header, so text/plain works transparently.

export const FUNCTIONS_BASE: string =
  import.meta.env.VITE_AUTH_BASE
  || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * POST with a "simple request" Content-Type so the browser doesn't
 * send an OPTIONS preflight. JSON-encodes the body but labels it as
 * text/plain to keep the request in the no-preflight category. Use
 * this everywhere instead of plain fetch+application/json.
 */
export async function safePost(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    // text/plain is one of the three CORS-safelisted Content-Types
    // (along with application/x-www-form-urlencoded and
    // multipart/form-data). With one of these AND only safelisted
    // header names, the browser skips OPTIONS preflight entirely.
    headers: { "Content-Type": "text/plain", ...extraHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
