-- Extend the moderator click-to-call audit (rp_moderator_calls) to also cover
-- outbound SMS + WhatsApp, both sent (blinded) from the Cethos Twilio number.
-- The participant's number is still never stored — only the invitation it
-- resolved to. `body` holds the moderator's own message text.
alter table public.rp_moderator_calls
  add column if not exists channel text not null default 'voice';  -- voice | sms | whatsapp
alter table public.rp_moderator_calls
  add column if not exists body text;

comment on column public.rp_moderator_calls.channel is 'voice | sms | whatsapp';
comment on column public.rp_moderator_calls.body is 'Outbound SMS/WhatsApp message text (voice rows are null).';
