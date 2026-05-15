/**
 * Build-time environment access for the vendor portal client bundle.
 *
 * Audit finding M-1: previously, four call sites embedded the Supabase
 * publishable anon JWT as a literal string fallback so the bundle still
 * worked when Netlify build-time env injection failed. That meant the
 * legacy HS256 anon key sat baked into every release of the vendor
 * portal — rotation impossible without a code change, and the key was
 * literally visible to anyone who view-source'd the page.
 *
 * Now: env-only, fail-loud at first use. If Netlify's
 * VITE_SUPABASE_ANON_KEY isn't set, the API call that needs it throws
 * a clear error in the browser console instead of silently using a
 * pinned legacy key. To fix that error, set the env var in Netlify
 * (Site settings → Environment variables) and trigger a rebuild.
 */

interface ViteEnv {
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
}

function readEnv(): ViteEnv {
  return ((import.meta as unknown) as { env?: ViteEnv }).env ?? {};
}

export function getSupabaseAnonKey(): string {
  const key = readEnv().VITE_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "VITE_SUPABASE_ANON_KEY is not set. Verify the env var in Netlify and rebuild.",
    );
  }
  return key;
}

export function getSupabaseUrl(): string {
  const url = readEnv().VITE_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "VITE_SUPABASE_URL is not set. Verify the env var in Netlify and rebuild.",
    );
  }
  return url;
}
