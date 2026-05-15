/**
 * OTP crypto helpers (Deno).
 *
 * - generateOtp(): 6-digit, crypto-strong (NOT Math.random).
 * - generateSalt(): 16-byte hex, per-OTP.
 * - hashOtp(code, salt): SHA-256(salt + ":" + code) → hex.
 * - timingSafeEqual(a, b): constant-time string compare.
 *
 * Mirrors `apps/vendor/netlify/functions/_lib/otp-crypto.ts` (Node).
 * Keep the algorithms identical — send-side may run in either runtime,
 * verify-side may run in the other, so hashes must match byte-for-byte.
 */

export function generateOtp(): string {
  // Crypto-strong 6-digit OTP. Reject biased outcomes by sampling until
  // we land in the largest multiple of 1_000_000 below 2^32, then mod.
  const cap = 4_294_000_000; // 4294 * 1_000_000, largest multiple < 2^32
  const buf = new Uint8Array(4);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  } while (n >= cap);
  return String(n % 1_000_000).padStart(6, "0");
}

export function generateSalt(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashOtp(code: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${code}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Verify policy: lock after this many consecutive failures on the same OTP. */
export const OTP_MAX_ATTEMPTS = 5;
/** When locked, how long until verify is allowed again. */
export const OTP_LOCKOUT_MINUTES = 15;
