-- Moderator outreach beyond confirmed participants (research panel).
--
-- The moderator console can now email interested candidates (a booking on the
-- session awaiting staff confirmation) and study waitlisters, not just confirmed
-- participants — matching the reach that call/SMS/WhatsApp already had.
--
-- A waitlister is a study-level rp_invitations row with NO booking, so the audit
-- table's booking_id can no longer be the recipient key:
--   * booking_id  -> nullable (null for waitlisters)
--   * invitation_id -> the stable recipient identity across every cohort
--   * kind        -> which cohort we wrote to, for the audit trail
--
-- Backfill: every existing row is a confirmed-participant message, so kind
-- defaults to 'participant' and invitation_id is recovered from the booking.

ALTER TABLE public.rp_moderator_messages
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE public.rp_moderator_messages
  ADD COLUMN IF NOT EXISTS invitation_id uuid
    REFERENCES public.rp_invitations(id) ON DELETE SET NULL;

ALTER TABLE public.rp_moderator_messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'participant';

-- Recover invitation_id for history written before this column existed.
UPDATE public.rp_moderator_messages m
SET invitation_id = b.invitation_id
FROM public.rp_bookings b
WHERE m.booking_id = b.id AND m.invitation_id IS NULL;

-- One of the two recipient keys must always be present: a booking-backed cohort
-- (participant / interested) or a waitlister identified only by their invitation.
ALTER TABLE public.rp_moderator_messages
  DROP CONSTRAINT IF EXISTS rp_moderator_messages_recipient_present;
ALTER TABLE public.rp_moderator_messages
  ADD CONSTRAINT rp_moderator_messages_recipient_present
  CHECK (booking_id IS NOT NULL OR invitation_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS rp_moderator_messages_invitation_idx
  ON public.rp_moderator_messages (invitation_id);

COMMENT ON COLUMN public.rp_moderator_messages.kind IS
  'Recipient cohort at send time: participant (confirmed booking) | interested (booking awaiting staff confirmation) | waitlist (study-level invitation, no booking).';
COMMENT ON COLUMN public.rp_moderator_messages.booking_id IS
  'Null for waitlist recipients — they have no booking. Use invitation_id as the recipient key.';
