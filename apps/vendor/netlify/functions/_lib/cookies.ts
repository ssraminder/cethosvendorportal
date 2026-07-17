/**
 * Cookie helpers for Netlify Functions. Two responsibilities:
 *
 * 1. Parse the inbound `cookie` header into a name → value map.
 * 2. Build a `Set-Cookie` value for our session cookie with the right
 *    flags for federated SSO across `*.cethos.com`.
 *
 * The session cookie is intentionally HttpOnly so JavaScript can't read
 * it (XSS-resistant). For now the frontend continues to receive the raw
 * `session_token` in response bodies as well; once the frontend stops
 * reading that field we can drop the body fallback. See
 * docs/migration/02-vendor-sso-and-session-hardening.md.
 */

/**
 * Per-portal cookie name. Both vendor and TM cookies share Domain=.cethos.com
 * so they're delivered to either subdomain, but each portal reads its own
 * name so the two sessions coexist without overwriting each other. A
 * translator who SSOs from vendor into TM ends up with BOTH cookies set;
 * returning to vendor re-uses the existing vendor session.
 */
export const SESSION_COOKIE_NAME = "cethos_session_vendor";

const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

/**
 * Parse the raw `Cookie:` header into a name → value map. Tolerant of
 * the various header-casing Netlify might pass.
 */
export function parseCookies(
  headers: Record<string, string | undefined> | undefined,
): Record<string, string> {
  if (!headers) return {};
  // Netlify normalizes to lowercase but be defensive.
  const raw = headers["cookie"] ?? headers["Cookie"] ?? "";
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/**
 * Read the session token from the request, in priority order:
 *   1. `cethos_session` cookie (HttpOnly path; the future).
 *   2. `session_token` field in the parsed JSON body (current path).
 *
 * Returning null means "no session presented at all". Validation —
 * whether the presented token is real, unexpired, unrevoked — is a
 * separate concern handled by `requireSession()` in session.ts.
 */
export function readSessionTokenFromRequest(
  headers: Record<string, string | undefined> | undefined,
  body: { session_token?: string } | null | undefined,
): string | null {
  const cookies = parseCookies(headers);
  const fromCookie = cookies[SESSION_COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const fromBody = body?.session_token?.trim();
  return fromBody ? fromBody : null;
}

/**
 * Build the Set-Cookie header value. Domain is `.cethos.com` so the
 * cookie is shared across subdomains (vendor.cethos.com, tm.cethos.com,
 * etc.) — this is what makes federated SSO seamless to the user.
 *
 * In local dev (no `.cethos.com` domain), pass `domain: undefined` to
 * fall back to host-only cookies. Today's call sites all run in prod;
 * dev override is a future enhancement.
 */
export function buildSessionCookie(
  token: string,
  opts: { domain?: string; maxAgeSeconds?: number } = {},
): string {
  const domain = opts.domain ?? ".cethos.com";
  const maxAge = opts.maxAgeSeconds ?? ONE_MONTH_SECONDS;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Domain=${domain}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  return parts.join("; ");
}

/**
 * Build the Set-Cookie value that clears the session cookie. Same
 * Domain/Path is required for the browser to overwrite the existing
 * cookie — Max-Age=0 expires it immediately.
 */
export function buildClearSessionCookie(opts: { domain?: string } = {}): string {
  const domain = opts.domain ?? ".cethos.com";
  return [
    `${SESSION_COOKIE_NAME}=`,
    `Domain=${domain}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

// ── Trusted-device ("remember this browser") cookie ─────────────────────────
// Separate from the session cookie: it survives logout and only lets a vendor
// SKIP the OTP step-up (never the password) for TRUSTED_DEVICE_DAYS. Raw token
// in the cookie; only its SHA-256 hash is stored server-side. See
// docs/CVP-VENDOR-AUTH-PASSWORD-PLAN.md.
export const TRUST_COOKIE_NAME = "cethos_trust_vendor";

/** OTP re-verification cadence on a trusted browser. Env-tunable, default 30d. */
export const TRUSTED_DEVICE_DAYS = (() => {
  const n = Number(process.env.TRUSTED_DEVICE_DAYS ?? "30");
  return Number.isFinite(n) && n >= 1 && n <= 90 ? Math.floor(n) : 30;
})();

export function readTrustTokenFromRequest(
  headers: Record<string, string | undefined> | undefined,
): string | null {
  const t = parseCookies(headers)[TRUST_COOKIE_NAME];
  return t ? t : null;
}

/** The request host, preferring the forwarded host Netlify sets. */
export function hostFromHeaders(
  headers: Record<string, string | undefined> | undefined,
): string | undefined {
  return headers?.["x-forwarded-host"] ?? headers?.["host"] ?? undefined;
}

/**
 * Pick the cookie `Domain` for a request host.
 *
 * On `*.cethos.com` we scope to `.cethos.com` so the cookie is shared across
 * portal subdomains (vendor./tm.) — that's what makes federated SSO work.
 * ANYWHERE ELSE (Netlify deploy previews, localhost) we must OMIT Domain and
 * let it be a host-only cookie: a browser silently DROPS a `.cethos.com`
 * cookie served from `*.netlify.app`, which would disable "remember this
 * browser" without any error. Returning undefined means "no Domain attribute".
 */
export function cookieDomainForHost(host?: string | null): string | undefined {
  if (!host) return ".cethos.com"; // no host info → preserve prod behaviour
  const h = host.split(":")[0].toLowerCase();
  return h === "cethos.com" || h.endsWith(".cethos.com") ? ".cethos.com" : undefined;
}

export function buildTrustCookie(
  token: string,
  opts: { host?: string | null; maxAgeSeconds?: number } = {},
): string {
  const domain = cookieDomainForHost(opts.host);
  const maxAge = opts.maxAgeSeconds ?? TRUSTED_DEVICE_DAYS * 24 * 60 * 60;
  const parts = [`${TRUST_COOKIE_NAME}=${encodeURIComponent(token)}`];
  if (domain) parts.push(`Domain=${domain}`);
  parts.push("Path=/", "HttpOnly", "Secure", "SameSite=Lax", `Max-Age=${maxAge}`);
  return parts.join("; ");
}

export function buildClearTrustCookie(opts: { host?: string | null } = {}): string {
  const domain = cookieDomainForHost(opts.host);
  const parts = [`${TRUST_COOKIE_NAME}=`];
  if (domain) parts.push(`Domain=${domain}`);
  parts.push("Path=/", "HttpOnly", "Secure", "SameSite=Lax", "Max-Age=0");
  return parts.join("; ");
}
