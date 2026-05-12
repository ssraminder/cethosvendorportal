// Single source of truth for the Supabase Edge Functions base URL.
//
// HISTORY: tried routing through Netlify Edge proxy at /sb/* but proved
// Netlify-Edge → Supabase's Cloudflare-fronted edge fails consistently
// (NOT_FOUND on every call, even with hardcoded URL + body). Likely a
// CF-to-CF peer-block. Edge proxy approach abandoned.
//
// Currently routes direct to Supabase (Custom Domain api.cethos.com
// configured via Supabase Pro). Vendors in regions that filter
// supabase.co get the SNI benefit. Vendors where the filter also blocks
// preflights to api.cethos.com still need VPN as a workaround until we
// build a non-Netlify proxy (Cloudflare Worker on Cethos's CF account
// or a VPS — see follow-up).

export const FUNCTIONS_BASE: string =
  import.meta.env.VITE_AUTH_BASE
  || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
