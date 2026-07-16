/**
 * Password helper for the vendor auth flow (Node / Netlify Functions).
 *
 * Uses bcryptjs (pure-JS, no native build — safe on Lambda). Cost 12: the
 * plan bumped from the legacy edge functions' cost 10. Old cost-10 hashes
 * still verify fine (bcrypt encodes its cost in the hash), so raising the
 * factor is transparent and applies on the next set/reset.
 *
 * See docs/CVP-VENDOR-AUTH-PASSWORD-PLAN.md.
 */

import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;

// A real bcrypt-12 hash of a throwaway string. When a login is attempted for
// an email that has no password (or no account), we still run a compare
// against this so the endpoint's timing doesn't leak whether the account /
// password exists (username-enumeration guard). Generated once, committed.
const DUMMY_BCRYPT_HASH =
  "$2a$12$RVCSMdC5bKxSWF5kW2f/EOC8VlkEqfJ6Z4sE3xqb8DIXPaGtrabZS";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Verify a plaintext password against a stored hash. If `hash` is null/empty
 * (no password on file), we still burn a compare against a dummy hash so the
 * response time matches the real path, then return false.
 */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const hasHash = typeof hash === "string" && hash.length > 0;
  const target = hasHash ? (hash as string) : DUMMY_BCRYPT_HASH;
  const ok = await bcrypt.compare(plain, target);
  return hasHash ? ok : false;
}

export interface PasswordPolicyResult {
  ok: boolean;
  message?: string;
}

/**
 * Minimum password policy: ≥10 chars, at least one letter and one number.
 * Deliberately lenient on symbols (NIST-style: length over composition) while
 * still stronger than the legacy "8 chars + a number". Upper bound guards
 * against bcrypt's 72-byte truncation surprises and DoS via huge inputs.
 */
export function checkPasswordPolicy(plain: unknown): PasswordPolicyResult {
  if (typeof plain !== "string") {
    return { ok: false, message: "Password is required." };
  }
  if (plain.length < 10) {
    return { ok: false, message: "Password must be at least 10 characters." };
  }
  if (plain.length > 200) {
    return { ok: false, message: "Password is too long (max 200 characters)." };
  }
  if (!/[0-9]/.test(plain)) {
    return { ok: false, message: "Password must include a number." };
  }
  if (!/[A-Za-z]/.test(plain)) {
    return { ok: false, message: "Password must include a letter." };
  }
  return { ok: true };
}
