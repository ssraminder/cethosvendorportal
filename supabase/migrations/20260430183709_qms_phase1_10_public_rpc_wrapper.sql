-- ============================================================================
-- QMS Phase 1 / Migration 10
-- Single public-schema RPC wrapper that edge functions call.
-- Internally resolves text language codes to UUIDs, calls qms eligibility,
-- writes the audit row, returns a single JSON verdict.
-- ============================================================================

create or replace function public.qms_check_assignment(
  p_vendor_id uuid,
  p_service_id uuid,
  p_source_language_code text default null,
  p_target_language_code text default null,
  p_call_site text default 'manual_check',
  p_order_id uuid default null,
  p_workflow_step_id uuid default null,
  p_vendor_step_offer_id uuid default null,
  p_payload jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = qms, public
as $fn$
declare
  v_src uuid;
  v_tgt uuid;
  v_eligible boolean;
  v_reason text;
  v_requires_iso boolean;
  v_required_role text;
  v_mode text;
  v_event_id bigint;
begin
  v_src := case when p_source_language_code is not null and p_source_language_code <> ''
                then qms.resolve_language(p_source_language_code) end;
  v_tgt := case when p_target_language_code is not null and p_target_language_code <> ''
                then qms.resolve_language(p_target_language_code) end;

  select e.eligible, e.reason, e.requires_iso, e.required_role, e.gating_mode, e.event_id
    into v_eligible, v_reason, v_requires_iso, v_required_role, v_mode, v_event_id
  from qms.log_eligibility_check(
    p_vendor_id, p_service_id, v_src, v_tgt,
    p_call_site, p_order_id, p_workflow_step_id, p_vendor_step_offer_id, p_payload
  ) e;

  return jsonb_build_object(
    'eligible', v_eligible,
    'reason', v_reason,
    'requires_iso', v_requires_iso,
    'required_role', v_required_role,
    'gating_mode', v_mode,
    'event_id', v_event_id,
    'should_block', (v_mode = 'block' and not v_eligible and v_requires_iso),
    'should_warn',  (v_mode = 'warn'  and not v_eligible and v_requires_iso),
    'resolved_source_language_id', v_src,
    'resolved_target_language_id', v_tgt,
    'source_language_code', p_source_language_code,
    'target_language_code', p_target_language_code
  );
end;
$fn$;

comment on function public.qms_check_assignment is
  'Single entry point used by assignment-related edge functions to check QMS eligibility and write an audit-log event in one call. should_block/should_warn drive caller behavior.';

grant execute on function public.qms_check_assignment(
  uuid, uuid, text, text, text, uuid, uuid, uuid, jsonb
) to authenticated, service_role;
