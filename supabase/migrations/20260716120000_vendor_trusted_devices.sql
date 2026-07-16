-- 20260716120000_vendor_trusted_devices.sql
-- "Remember this browser" trusted devices for vendor login.
--
-- A trusted-device token lets a vendor skip the OTP step-up for a configurable
-- window (default 30 days, env TRUSTED_DEVICE_DAYS) AFTER a password login. The
-- raw token lives only in an HttpOnly cookie (cethos_trust_vendor); ONLY its
-- SHA-256 hash is stored here. A device cookie NEVER substitutes for the
-- password — it only lets the vendor skip the OTP second factor within the
-- window. See docs/CVP-VENDOR-AUTH-PASSWORD-PLAN.md.

CREATE TABLE IF NOT EXISTS vendor_trusted_devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,                 -- SHA-256 hex of the raw cookie token
  user_agent   text,                          -- advisory: device list + soft check
  label        text,                          -- derived ("Chrome on Windows") or user-set
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  rotated_from text                            -- prior token_hash on rotation (forensics)
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_trusted_devices_token_hash_key
  ON vendor_trusted_devices (token_hash);

CREATE INDEX IF NOT EXISTS vendor_trusted_devices_vendor_active_idx
  ON vendor_trusted_devices (vendor_id) WHERE revoked_at IS NULL;

-- Match the sibling auth tables (vendor_auth / vendor_otp / vendor_sessions):
-- RLS on with no policies. The Netlify /sb functions connect via a direct DB
-- role that bypasses RLS; PostgREST/anon get no access by default.
ALTER TABLE vendor_trusted_devices ENABLE ROW LEVEL SECURITY;
