// Single source of truth for the Supabase Edge Functions base URL.
//
// In production we route through `/sb/*` — Netlify's edge proxies it to
// Supabase Custom Domain (api.cethos.com) via netlify.toml rewrite. This
// makes every function call same-origin, eliminating the CORS preflight
// that some state-level filters (Egypt, China) drop.
//
// /sb/ instead of /api/ because /api/ is reserved by Netlify for its
// built-in Functions auto-routing — that path doesn't survive the SPA
// reset hierarchy.
//
// Local dev (localhost) still hits Supabase directly because there's no
// Netlify edge to proxy through. Escape hatch via VITE_AUTH_BASE for
// emergency overrides without a code change.

export const FUNCTIONS_BASE: string =
  import.meta.env.VITE_AUTH_BASE
  || (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
    : "/sb");
