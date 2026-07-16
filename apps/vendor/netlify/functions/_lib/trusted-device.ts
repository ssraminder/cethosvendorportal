/**
 * Trusted-device ("remember this browser") helper.
 *
 * A trusted device lets a vendor skip the OTP step-up for TRUSTED_DEVICE_DAYS
 * after a password login. The raw 256-bit token lives only in the HttpOnly
 * `cethos_trust_vendor` cookie; we store only its SHA-256 hash. On each
 * successful use we ROTATE (issue a new token, revoke the old) to shrink the
 * theft window. A device token NEVER substitutes for the password.
 *
 * See docs/CVP-VENDOR-AUTH-PASSWORD-PLAN.md.
 */

import { randomBytes, createHash } from "node:crypto";
import { query } from "./db";
import { TRUSTED_DEVICE_DAYS } from "./cookies";

export function hashDeviceToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function newRawToken(): string {
  return randomBytes(32).toString("hex"); // 256-bit
}

function expiryIso(): string {
  return new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Best-effort human label from a UA string (advisory only). */
function deriveLabel(ua?: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Macintosh|Mac OS X/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Create a new trusted-device row and return the RAW token for the cookie. */
export async function issueTrustedDevice(
  vendorId: string,
  userAgent?: string | null,
): Promise<string> {
  const raw = newRawToken();
  await query(
    `INSERT INTO vendor_trusted_devices
       (vendor_id, token_hash, user_agent, label, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [vendorId, hashDeviceToken(raw), userAgent ?? null, deriveLabel(userAgent), expiryIso()],
  );
  return raw;
}

/**
 * Validate a presented device token for this vendor. On a valid, unexpired,
 * unrevoked hit: rotate (new token issued, old revoked) and return the NEW raw
 * token so the caller re-sets the cookie. On miss: { trusted: false }.
 */
export async function checkAndRotateTrustedDevice(
  vendorId: string,
  rawToken: string | null | undefined,
  userAgent?: string | null,
): Promise<{ trusted: boolean; rotated?: string }> {
  if (!rawToken) return { trusted: false };
  const tokenHash = hashDeviceToken(rawToken);
  const rows = await query<{ id: string }>(
    `SELECT id FROM vendor_trusted_devices
      WHERE vendor_id = $1 AND token_hash = $2
        AND revoked_at IS NULL AND expires_at > now()
      LIMIT 1`,
    [vendorId, tokenHash],
  );
  if (rows.length === 0) return { trusted: false };

  const newRaw = newRawToken();
  await query(
    `INSERT INTO vendor_trusted_devices
       (vendor_id, token_hash, user_agent, label, expires_at, rotated_from)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [vendorId, hashDeviceToken(newRaw), userAgent ?? null, deriveLabel(userAgent), expiryIso(), tokenHash],
  );
  await query(
    `UPDATE vendor_trusted_devices SET revoked_at = now() WHERE id = $1`,
    [rows[0].id],
  );
  return { trusted: true, rotated: newRaw };
}

/** Revoke every active trusted device for a vendor (e.g. on password change). */
export async function revokeAllTrustedDevices(vendorId: string): Promise<void> {
  await query(
    `UPDATE vendor_trusted_devices SET revoked_at = now()
      WHERE vendor_id = $1 AND revoked_at IS NULL`,
    [vendorId],
  );
}

export interface TrustedDeviceView {
  id: string;
  label: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  current: boolean;
}

export async function listTrustedDevices(
  vendorId: string,
  currentRawToken?: string | null,
): Promise<TrustedDeviceView[]> {
  const currentHash = currentRawToken ? hashDeviceToken(currentRawToken) : null;
  const rows = await query<{
    id: string;
    token_hash: string;
    label: string | null;
    user_agent: string | null;
    created_at: string;
    last_seen_at: string;
    expires_at: string;
  }>(
    `SELECT id, token_hash, label, user_agent, created_at, last_seen_at, expires_at
       FROM vendor_trusted_devices
      WHERE vendor_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY last_seen_at DESC`,
    [vendorId],
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    user_agent: r.user_agent,
    created_at: r.created_at,
    last_seen_at: r.last_seen_at,
    expires_at: r.expires_at,
    current: !!currentHash && r.token_hash === currentHash,
  }));
}

/** Revoke a single device by id (scoped to the vendor). Returns true if hit. */
export async function revokeTrustedDevice(
  vendorId: string,
  deviceId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE vendor_trusted_devices SET revoked_at = now()
      WHERE id = $1 AND vendor_id = $2 AND revoked_at IS NULL
      RETURNING id`,
    [deviceId, vendorId],
  );
  return rows.length > 0;
}
