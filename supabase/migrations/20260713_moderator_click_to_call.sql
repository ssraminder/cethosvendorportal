-- Moderator click-to-call (Twilio masked bridge) + no-show waitlist calling.
--
-- The vendor "My interviews" console gets a Call button next to "Message
-- participants". It preserves the page's blinding: Twilio calls the MODERATOR
-- first, then dials the participant and bridges the two legs — neither side
-- ever sees the other's number (participant sees the Cethos Twilio caller ID).
-- The moderator can also call the study's waitlist to backfill a no-show.
--
-- This adds:
--   1. vendors.interview_callback_phone — the moderator's own callback number,
--      remembered so it prefills on the next call (prompt-and-remember).
--   2. rp_moderator_calls — append-style audit of every call the moderator
--      places (never stores the participant's number — only the invitation it
--      resolved to; the participant's phone stays server-side).
--
-- All access is via service_role from the vendor-interviews edge function, so
-- RLS is enabled with no policies (locked to service_role, matching the rp_*
-- lockdown posture).

-- 1. Remembered moderator callback number.
alter table public.vendors
  add column if not exists interview_callback_phone text;

comment on column public.vendors.interview_callback_phone is
  'Moderator''s callback number (E.164) for click-to-call; prefilled on the next call.';

-- 2. Call audit log.
create table if not exists public.rp_moderator_calls (
  id             uuid primary key default gen_random_uuid(),
  slot_id        uuid references public.rp_availability_slots(id) on delete set null,
  study_id       uuid references public.rp_studies(id) on delete set null,
  interviewer_id uuid references public.rp_interviewers(id) on delete set null,
  invitation_id  uuid references public.rp_invitations(id) on delete set null,
  vendor_id      uuid,
  -- 'participant' = confirmed booking on the slot; 'waitlist' = study waitlist.
  kind           text not null default 'participant',
  -- The moderator's own callback number (their data, not the participant's).
  moderator_phone text,
  twilio_call_sid text,
  status         text not null default 'initiated',  -- initiated | failed
  error          text,
  created_at     timestamptz not null default now()
);

comment on table public.rp_moderator_calls is
  'Audit of moderator click-to-call attempts (Twilio masked bridge). Participant number is never stored — only the invitation it resolved to.';

create index if not exists rp_moderator_calls_slot_idx on public.rp_moderator_calls (slot_id, created_at desc);
create index if not exists rp_moderator_calls_study_idx on public.rp_moderator_calls (study_id, created_at desc);

alter table public.rp_moderator_calls enable row level security;
