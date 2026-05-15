-- =====================================================================
-- vendor_otp hardening (audit finding H-4)
--
-- Adds:
--   otp_hash, salt    SHA-256(salt + ":" + code) replaces plaintext OTP
--                     in DB. Send-side hashes; verify-side timing-safe
--                     compares; raw code only ever exists in the email/SMS
--                     body and in memory.
--   attempts          increments on each failed verify
--   locked_until      set when attempts >= 5; verify denies until past
--
-- otp_code stays NULLable for one release so in-flight OTPs at deploy
-- time still verify via backward-compat fallback. Drop the column in a
-- follow-up migration once enough release time has passed.
-- =====================================================================

ALTER TABLE public.vendor_otp
  ADD COLUMN IF NOT EXISTS otp_hash    text,
  ADD COLUMN IF NOT EXISTS salt        text,
  ADD COLUMN IF NOT EXISTS attempts    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

ALTER TABLE public.vendor_otp
  ALTER COLUMN otp_code DROP NOT NULL;

-- Index to speed up the "latest unverified, non-expired, not-locked OTP for
-- this email" lookup that verify does on every attempt.
CREATE INDEX IF NOT EXISTS vendor_otp_email_unverified_idx
  ON public.vendor_otp (email, created_at DESC)
  WHERE verified = false;
