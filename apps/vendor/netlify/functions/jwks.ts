/**
 * Netlify Function: jwks
 *
 * Publishes the vendor portal's signing public key as a JWK Set so
 * relying parties (TM today; admin/customer later) can verify SSO JWTs
 * issued by `sso-issue`. Mounted at `/.well-known/jwks.json` via the
 * netlify.toml redirect.
 *
 * Cache-Control is set to one hour. Receivers (jose's
 * createRemoteJWKSet) cache aggressively anyway, but this gives a
 * sensible upper bound for key rotation: at most ~1 hour for a new key
 * to be picked up by all verifiers without explicit cache-bust.
 */

import { json, type NetlifyResponse } from "./_lib/response";

export const handler = async (): Promise<NetlifyResponse> => {
  const jwkRaw = process.env.VENDOR_JWT_PUBLIC_JWK;
  if (!jwkRaw) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "VENDOR_JWT_PUBLIC_JWK not configured" }),
      headers: { "Content-Type": "application/json" },
    };
  }
  let jwk: unknown;
  try {
    jwk = JSON.parse(jwkRaw);
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "VENDOR_JWT_PUBLIC_JWK is not valid JSON",
        detail: e instanceof Error ? e.message : String(e),
      }),
      headers: { "Content-Type": "application/json" },
    };
  }

  return json({ keys: [jwk] }, 200, {
    "Content-Type": "application/jwk-set+json",
    "Cache-Control": "public, max-age=3600",
  });
};
