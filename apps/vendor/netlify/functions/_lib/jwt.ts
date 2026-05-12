/**
 * JWT signing for vendor-portal-issued SSO tokens.
 *
 * Vendor portal is the issuer for handoffs to TM (and, later, other
 * Cethos surfaces that join the federation). Tokens are short-lived
 * (5 minutes) — they're traded for a session cookie at the receiving
 * portal almost immediately.
 *
 * The signing key lives in the VENDOR_JWT_PRIVATE_KEY env var (PKCS#8
 * PEM, ES256). The matching public key is published by jwks.ts at
 * /.well-known/jwks.json so verifiers (TM's @/lib/auth/sso) can pull it
 * via a JWKS client.
 *
 * To rotate keys: generate a new pair via `npm run generate-jwt-keypair`,
 * keep the old key in env temporarily under VENDOR_JWT_PRIVATE_KEY_PREV
 * (not yet used), promote the new pair, then drop the old after the
 * longest token TTL has elapsed (5 min).
 */

import { SignJWT, importPKCS8, type KeyLike } from "jose";

// jose v5 exports KeyLike (= CryptoKey | Uint8Array) — that's what
// importPKCS8 returns and what SignJWT.sign accepts.
let cachedKey: KeyLike | null = null;
let cachedKid: string | null = null;

async function getSigningKey(): Promise<KeyLike> {
  if (cachedKey) return cachedKey;
  const pem = process.env.VENDOR_JWT_PRIVATE_KEY;
  if (!pem) {
    throw new Error(
      "VENDOR_JWT_PRIVATE_KEY env var is not set. Run `npm run generate-jwt-keypair` and paste the output into Netlify env.",
    );
  }
  cachedKey = await importPKCS8(pem, "ES256");
  return cachedKey;
}

function getKid(): string {
  if (cachedKid) return cachedKid;
  const jwkRaw = process.env.VENDOR_JWT_PUBLIC_JWK;
  if (!jwkRaw) {
    throw new Error("VENDOR_JWT_PUBLIC_JWK env var is not set.");
  }
  try {
    const jwk = JSON.parse(jwkRaw);
    if (typeof jwk.kid !== "string") {
      throw new Error("VENDOR_JWT_PUBLIC_JWK is missing kid.");
    }
    cachedKid = jwk.kid;
    return jwk.kid;
  } catch (e) {
    throw new Error(
      `VENDOR_JWT_PUBLIC_JWK is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export const VENDOR_JWT_ISSUER = "https://vendor.cethos.com";

export interface VendorSsoClaims {
  /** Vendor row id (vendors.id) — stable across sessions. */
  vendor_user_id: string;
  /** Email address — used by the receiving portal to find or create its profile row. */
  email: string;
  /** Display name for nicer first-time-user UX at the receiving portal. */
  full_name?: string;
  /** Translator vs reviewer role — receiving portal may use this as the default role. */
  role?: "translator" | "reviewer";
  /**
   * Optional job reference. When present, the receiving portal can
   * deep-link the user straight into the job-specific UI. For TM this
   * is the external_ref of the job they're being handed.
   */
  job_external_ref?: string;
}

/**
 * Sign a 5-minute SSO token for the given audience. Audience MUST match
 * what the receiving portal is configured to verify (e.g. "cethos-tm"
 * for TM). Mismatch → verification rejected.
 */
export async function signSsoToken(
  claims: VendorSsoClaims,
  audience: string,
): Promise<string> {
  const key = await getSigningKey();
  const kid = getKid();

  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "ES256", kid })
    .setIssuer(VENDOR_JWT_ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setJti(crypto.randomUUID())
    .sign(key);
}
