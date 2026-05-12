/**
 * Locally mint Supabase Storage signed URLs without a network call.
 *
 * Supabase signed URLs are HS256-signed JWTs of `{ url: "<bucket>/<path>",
 * iat, exp }`, signed with the project's JWT secret. We can produce them
 * directly in the Lambda — no /storage/v1/object/sign round-trip — which
 * sidesteps the same CF-to-CF block we hit on /functions/v1.
 *
 * The user must set:
 *   SUPABASE_URL          e.g. https://<project>.supabase.co
 *   SUPABASE_JWT_SECRET   from Supabase Dashboard → Project Settings → API
 */

import { createHmac } from "crypto";

const TTL_SECONDS = 3600;

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signStorageUrl(bucket: string, path: string): string | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseUrl || !secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    url: `${bucket}/${path}`,
    iat: now,
    exp: now + TTL_SECONDS,
  };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  const token = `${signingInput}.${base64url(signature)}`;

  return `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodeURI(path)}?token=${token}`;
}

export function signSourceFile(storagePath: string): string | null {
  // Same heuristic as the original Supabase function: flat paths live in
  // `ocr-uploads`, slashed paths in `quote-files`.
  const isFlatPath = !storagePath.includes("/");
  const bucket = isFlatPath ? "ocr-uploads" : "quote-files";
  return signStorageUrl(bucket, storagePath);
}
