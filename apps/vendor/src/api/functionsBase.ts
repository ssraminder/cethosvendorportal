// Single source of truth for the Supabase Edge Functions base URL.
//
// Production routes through `/sb/*` — a Netlify redirect rewrites to
// `/.netlify/functions/sb/<fn>`, a Lambda-backed Netlify Function that
// proxies to Supabase Custom Domain. Same-origin so no CORS preflight;
// Lambda's network egress avoids the CF-to-CF peer block that broke
// the earlier Edge Function attempt.
//
// Local dev (localhost) hits Supabase directly because there's no
// Netlify Function to proxy through. VITE_AUTH_BASE escape hatch
// remains.

export const FUNCTIONS_BASE: string =
  import.meta.env.VITE_AUTH_BASE
  || (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
    : "/sb");
