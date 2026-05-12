-- Vendor session hardening for federated SSO + cookie migration.
--
-- Adds session-rotation bookkeeping columns to vendor_sessions. Existing
-- rows continue to work — the new columns are nullable + indexed.
--
-- See docs/migration/02-vendor-sso-and-session-hardening.md (admin repo)
-- for the full plan. Phase A only — this migration is safe to apply
-- before the application code that reads/writes the new columns ships.

ALTER TABLE vendor_sessions
  ADD COLUMN IF NOT EXISTS revoked_at   timestamptz,
  ADD COLUMN IF NOT EXISTS rotated_from text,
  ADD COLUMN IF NOT EXISTS origin       text;

COMMENT ON COLUMN vendor_sessions.revoked_at IS
  'Set when the session is explicitly invalidated (logout) or rotated.';
COMMENT ON COLUMN vendor_sessions.rotated_from IS
  'session_token of the previous session row this row replaced. Used for audit + chain-of-custody.';
COMMENT ON COLUMN vendor_sessions.origin IS
  'How the session was created: otp | password | impersonation | sso. Defaults to NULL for legacy rows.';

-- Index used by every authenticated request (cookie or body) to look up
-- a non-revoked, non-expired session by token.
CREATE INDEX IF NOT EXISTS idx_vendor_sessions_active_token
  ON vendor_sessions(session_token)
  WHERE revoked_at IS NULL;

-- Used by the rotation chain query (audit "what tokens did this user have?").
CREATE INDEX IF NOT EXISTS idx_vendor_sessions_rotated_from
  ON vendor_sessions(rotated_from)
  WHERE rotated_from IS NOT NULL;
