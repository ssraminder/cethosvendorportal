/**
 * OTP crypto helpers (Node, for Netlify Lambdas).
 *
 * Mirrors `supabase/functions/_shared/otp-crypto.ts` (Deno). Keep the
 * algorithms identical — send-side may run in either runtime, verify-side
 * may run in the other, so hashes must match byte-for-byte.
 */

import { createHash, randomBytes, randomInt, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

export function generateOtp(): string {
  // randomInt is rejection-sampled internally → uniform across the range.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Verify policy: lock after this many consecutive failures on the same OTP. */
export const OTP_MAX_ATTEMPTS = 5;
/** When locked, how long until verify is allowed again. */
export const OTP_LOCKOUT_MINUTES = 15;
