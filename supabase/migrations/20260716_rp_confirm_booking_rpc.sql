-- rp_confirm_booking — the single shared path for turning an INTERESTED booking
-- into a CONFIRMED seat.
--
-- WHY THIS EXISTS: this logic previously lived only in the admin repo's
-- interview-admin edge function (confirmBookings). The moderator console in the
-- vendor repo now needs to confirm too, and the two repos cannot share
-- TypeScript — so the database-side rules move here, exactly as session
-- completion already delegates to rp_complete_session. One copy, no drift.
--
-- WHAT STAYS WITH THE CALLER: resolving the session's meeting link, including
-- minting a Zoom meeting. That's an HTTP call and cannot live in Postgres. The
-- caller MUST settle the slot's meeting_link BEFORE calling this function: the
-- BEFORE-UPDATE trigger rp_booking_inherit_slot_meeting copies the slot's link
-- onto the booking at flip time, and the interview-schedule cron only ever
-- emails links that already exist — it never mints one. Confirm a booking on a
-- linkless slot and the participant is confirmed with no way to join.
--
-- Guard is capacity ONLY, matching what staff enforce today. Gender quota, age
-- span and min/max respondents stay advisory (surfaced in the admin UI), so the
-- moderator hits no wall that staff don't.
--
-- Concurrency: takes FOR UPDATE on the booking AND the slot. The TypeScript it
-- replaces counted seats and then flipped without a lock, so two simultaneous
-- confirms could both pass the guard and oversubscribe the session.

CREATE OR REPLACE FUNCTION public.rp_confirm_booking(
  p_booking_id uuid,
  p_by text DEFAULT 'staff'
)
RETURNS TABLE(
  confirmed boolean,
  reason text,
  slot_id uuid,
  study_id uuid,
  seats_taken integer,
  capacity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_bk   public.rp_bookings;
  v_slot public.rp_availability_slots;
  v_cap  integer;
  v_conf integer;
begin
  confirmed := false;
  reason := null; slot_id := null; study_id := null; seats_taken := null; capacity := null;

  select * into v_bk from public.rp_bookings where id = p_booking_id for update;
  if not found then
    reason := 'not_found';
    return next; return;
  end if;
  slot_id := v_bk.slot_id;

  -- Only an interested booking can be confirmed. Anything else (already
  -- confirmed, cancelled, completed) is a no-op the caller should report.
  if v_bk.status <> 'interested' then
    reason := 'not_interested_' || v_bk.status::text;
    return next; return;
  end if;

  select * into v_slot from public.rp_availability_slots where id = v_bk.slot_id for update;
  if not found then
    reason := 'slot_not_found';
    return next; return;
  end if;
  study_id := v_slot.study_id;

  if v_slot.status = 'cancelled' then
    reason := 'slot_cancelled';
    return next; return;
  end if;

  -- Seat guard against REAL confirmed rows: booked_count drifts in production
  -- (slots exist reading full with zero confirmed bookings), so it is never the
  -- source of truth here.
  v_cap := coalesce(v_slot.capacity, 1);
  capacity := v_cap;
  -- Alias the table: the RETURNS TABLE out-params (slot_id, study_id, capacity)
  -- shadow same-named columns, so a bare `slot_id` here is ambiguous and fails
  -- at runtime. Qualify every column reference rather than leaning on
  -- #variable_conflict, which would silently reinterpret the whole body.
  select count(*) into v_conf
    from public.rp_bookings b
   where b.slot_id = v_bk.slot_id and b.status = 'confirmed';
  seats_taken := v_conf;
  if v_conf >= v_cap then
    reason := 'session_full';
    return next; return;
  end if;

  -- Flip. The BEFORE-UPDATE trigger inherits the slot's meeting link onto the
  -- booking here; link_email_sent_at stays null so the cron sends the link email.
  update public.rp_bookings
     set status = 'confirmed', status_changed_at = now(), status_changed_by = p_by
   where id = p_booking_id and status = 'interested';
  if not found then
    reason := 'update_failed';
    return next; return;
  end if;

  -- Re-sync the slot's seat count and status from reality, repairing any drift.
  -- Alias the table: the RETURNS TABLE out-params (slot_id, study_id, capacity)
  -- shadow same-named columns, so a bare `slot_id` here is ambiguous and fails
  -- at runtime. Qualify every column reference rather than leaning on
  -- #variable_conflict, which would silently reinterpret the whole body.
  select count(*) into v_conf
    from public.rp_bookings b
   where b.slot_id = v_bk.slot_id and b.status = 'confirmed';
  update public.rp_availability_slots
     set booked_count = v_conf,
         status = case when v_conf >= v_cap then 'full'::public.rp_slot_status
                       else 'open'::public.rp_slot_status end
   where id = v_bk.slot_id and status <> 'cancelled';

  confirmed := true;
  reason := null;
  seats_taken := v_conf;
  return next;
end
$function$;

COMMENT ON FUNCTION public.rp_confirm_booking(uuid, text) IS
  'Confirm one interested booking: capacity-guarded, locked, re-syncs the slot seat count. Shared by staff (interview-admin) and moderators (vendor-interviews). The CALLER must settle the slot meeting_link first — the cron never mints one.';

REVOKE ALL ON FUNCTION public.rp_confirm_booking(uuid, text) FROM public, anon, authenticated;
