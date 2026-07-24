-- rp_lock_focus_slot — lock a candidate-times focus group to ONE winning time.
--
-- Candidate mode (admin repo migration 20260811_rp_focus_group_candidate_mode)
-- lets a focus group offer several tentative times; participants register
-- interest (no seat) in the one they prefer. This RPC is the single shared path
-- — called by BOTH staff (interview-admin) and the moderator console
-- (vendor-interviews), which cannot share TypeScript — that turns those
-- preferences into a locked-in session:
--
--   1. Move every INTERESTED booking sitting on a LOSING candidate slot onto the
--      winning slot, keeping status 'interested' (still no seat), and flag its
--      invitation standby_offered_at — so the people who preferred another time
--      become standby for the winner (user decision: "auto-offer the winning
--      time, rest to standby"). Interest already on the winner is the primary
--      pool the moderator confirms; it is left untouched (not flagged standby).
--   2. Cancel the losing candidate slots.
--   3. Stamp rp_studies.locked_slot_id = winner.
--
-- WHAT STAYS WITH THE CALLER (HTTP, cannot live in Postgres): sending the
-- "the group is now at <time> — can you make it?" auto-offer email to the moved
-- standby people, the "not selected" note, and confirming the actual attendees
-- (rp_confirm_booking). This function only does the deterministic DB state.
--
-- Concurrency: FOR UPDATE on the study and the winning slot. Idempotent-ish: a
-- second call returns 'already_locked' and changes nothing.

CREATE OR REPLACE FUNCTION public.rp_lock_focus_slot(
  p_study_id uuid,
  p_slot_id uuid,
  p_by text DEFAULT 'staff'
)
RETURNS TABLE(
  locked boolean,
  reason text,
  winning_slot uuid,
  cancelled_slots integer,
  moved_to_standby integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_study public.rp_studies;
  v_slot  public.rp_availability_slots;
  v_moved integer := 0;
  v_cancelled integer := 0;
begin
  locked := false; reason := null; winning_slot := null;
  cancelled_slots := 0; moved_to_standby := 0;

  select * into v_study from public.rp_studies where id = p_study_id for update;
  if not found then reason := 'study_not_found'; return next; return; end if;
  if v_study.interview_type <> 'focus_group' then reason := 'not_focus_group'; return next; return; end if;
  if not coalesce(v_study.candidate_mode, false) then reason := 'not_candidate_mode'; return next; return; end if;
  if v_study.locked_slot_id is not null then reason := 'already_locked'; return next; return; end if;

  -- Winner must belong to this study and be live.
  select * into v_slot from public.rp_availability_slots where id = p_slot_id for update;
  if not found or v_slot.study_id <> p_study_id then reason := 'slot_not_found'; return next; return; end if;
  if v_slot.status = 'cancelled' then reason := 'slot_cancelled'; return next; return; end if;
  winning_slot := p_slot_id;

  -- (1) Move interest off the losing slots onto the winner, and flag those
  -- invitations as standby. Capturing the moved invitation ids in a data-modifying
  -- CTE is what lets us flag ONLY the moved people — after the move their booking
  -- sits on the winner alongside the original winner-preferrers, indistinguishable
  -- by slot alone.
  with losers as (
    select s.id
      from public.rp_availability_slots s
     where s.study_id = p_study_id and s.id <> p_slot_id and s.status <> 'cancelled'
  ),
  moved as (
    update public.rp_bookings b
       set slot_id = p_slot_id, status_changed_at = now(), status_changed_by = p_by
     where b.status = 'interested' and b.slot_id in (select id from losers)
    returning b.invitation_id
  )
  update public.rp_invitations i
     set standby_offered_at = coalesce(i.standby_offered_at, now()),
         standby_offered_by = coalesce(i.standby_offered_by, p_by)
    from moved
   where i.id = moved.invitation_id;
  get diagnostics v_moved = row_count;

  -- (2) Cancel the losing candidate slots (after the move has drained them).
  update public.rp_availability_slots
     set status = 'cancelled'
   where study_id = p_study_id and id <> p_slot_id and status <> 'cancelled';
  get diagnostics v_cancelled = row_count;

  -- (3) Lock the study to the winner.
  update public.rp_studies set locked_slot_id = p_slot_id where id = p_study_id;

  locked := true; reason := null;
  cancelled_slots := v_cancelled; moved_to_standby := v_moved;
  return next;
end
$function$;

COMMENT ON FUNCTION public.rp_lock_focus_slot(uuid, uuid, text) IS
  'Lock a candidate-times focus group to one winning slot: move losing-slot interest onto the winner as standby, cancel the losing slots, stamp locked_slot_id. Shared by staff (interview-admin) and moderators (vendor-interviews). Caller handles the auto-offer / not-selected emails and confirming attendees (rp_confirm_booking).';

REVOKE ALL ON FUNCTION public.rp_lock_focus_slot(uuid, uuid, text) FROM public, anon, authenticated;
