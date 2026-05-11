-- ============================================================================
-- QMS Phase 1 / Migration 9
-- Assignment-gating infrastructure (schema only — no edge function edits yet).
-- ============================================================================

-- 1. public.services.requires_iso_qualification
alter table public.services
  add column if not exists requires_iso_qualification boolean not null default false;

comment on column public.services.requires_iso_qualification is
  'True if the service requires an ISO 17100 / 18587 / 18841 / NSGCIS qualified linguist.';

update public.services set requires_iso_qualification = true
where code in (
  'certified_translation','standard_translation','technical_translation','legal_translation',
  'medical_translation','financial_translation','marketing_translation','literary_translation',
  'software_localization','website_localization','sworn_translation','transcreation',
  'consecutive_interpretation','simultaneous_interpretation','telephone_interpretation',
  'video_remote_interpretation','sign_language_interpretation','escort_interpretation',
  'review','editing','proofreading','back_translation','lqa','localization_testing',
  'mtpe',
  'cognitive_debriefing','reconciliation','harmonization','linguistic_validation_migration',
  'linguistic_validation_migration_qm','screenshot_review','clinician_review',
  'post_cognitive_debriefing_review','post_clinician_review',
  'transcription_translation','subtitling','subtitling_translation','voiceover','dubbing',
  'document_review','terminology_management','cultural_consulting'
);

-- 2. qms.service_iso_requirements
create table qms.service_iso_requirements (
  service_id uuid primary key references public.services(id) on delete cascade,
  required_role_type_code text not null references qms.role_types(code) on update cascade,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table qms.service_iso_requirements is
  'Maps each ISO-scoped service to the role type a linguist must hold to be eligible.';

insert into qms.service_iso_requirements (service_id, required_role_type_code, notes)
select s.id, 'translator', 'ISO 17100 §3.1.4 translator competence required.'
from public.services s
where s.code in ('certified_translation','standard_translation','technical_translation',
                 'legal_translation','medical_translation','financial_translation',
                 'marketing_translation','literary_translation','software_localization',
                 'website_localization','sworn_translation','transcreation',
                 'transcription_translation','subtitling','subtitling_translation',
                 'voiceover','dubbing','back_translation','document_review',
                 'terminology_management','cultural_consulting');

insert into qms.service_iso_requirements (service_id, required_role_type_code, notes)
select s.id, 'reviser', 'ISO 17100 §3.1.5 reviser competence required.'
from public.services s
where s.code in ('review','editing','proofreading','lqa','localization_testing',
                 'cognitive_debriefing','reconciliation','harmonization',
                 'linguistic_validation_migration','linguistic_validation_migration_qm',
                 'screenshot_review','clinician_review','post_cognitive_debriefing_review',
                 'post_clinician_review');

insert into qms.service_iso_requirements (service_id, required_role_type_code, notes)
select s.id, 'post_editor', 'ISO 18587 §3.1 post-editor competence required.'
from public.services s where s.code in ('mtpe');

insert into qms.service_iso_requirements (service_id, required_role_type_code, notes)
select s.id, 'interpreter', 'ISO 18841 §6 / NSGCIS interpreter competence required.'
from public.services s
where s.code in ('consecutive_interpretation','simultaneous_interpretation',
                 'telephone_interpretation','video_remote_interpretation',
                 'sign_language_interpretation','escort_interpretation');

-- 3. qms.config keys for gating mode
insert into qms.config (key, value, description, iso_clause_reference) values
  ('assignment_gating_mode', '"warn"'::jsonb,
   'How QMS reacts to attempts to assign unqualified vendors to ISO-scoped projects. Values: "off", "warn", "block".',
   'ISO 17100 §6.1 / ISO 9001 §8.4'),
  ('assignment_gating_warning_recipient', '"raminder@cethos.com"'::jsonb,
   'Email to notify when warn-mode logs an ineligible-vendor assignment.', null)
on conflict (key) do nothing;

-- 4. qms.assignment_eligibility_events
create table qms.assignment_eligibility_events (
  id bigserial primary key,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  service_id uuid references public.services(id) on delete set null,
  source_language_id uuid references public.languages(id) on delete set null,
  target_language_id uuid references public.languages(id) on delete set null,
  order_id uuid,
  workflow_step_id uuid,
  vendor_step_offer_id uuid,
  call_site text not null,
  eligible boolean not null,
  reason text,
  requires_iso boolean,
  required_role text,
  gating_mode text,
  payload jsonb,
  performed_by uuid references auth.users(id),
  performed_at timestamptz not null default now(),
  check (call_site in ('find_matching_vendors','direct_assign','offer_vendor',
                       'offer_multiple','counter_offer_accept','cvp_approve_application',
                       'manual_check'))
);
create index assignment_eligibility_events_vendor_idx
  on qms.assignment_eligibility_events (vendor_id, performed_at desc);
create index assignment_eligibility_events_call_site_idx
  on qms.assignment_eligibility_events (call_site, performed_at desc);
create index assignment_eligibility_events_ineligible_idx
  on qms.assignment_eligibility_events (performed_at desc) where eligible = false;
create index assignment_eligibility_events_order_idx
  on qms.assignment_eligibility_events (order_id, performed_at desc) where order_id is not null;
comment on table qms.assignment_eligibility_events is
  'Every QMS eligibility check writes a row here. Powers warn-mode visibility, block-mode rejection records, and audit-defense queries.';

-- 5. qms.requires_iso_qualification
create or replace function qms.requires_iso_qualification(p_service_id uuid)
returns boolean language sql stable security definer
set search_path = qms, public
as $fn$
  select coalesce(
    (select s.requires_iso_qualification from public.services s where s.id = p_service_id),
    false
  );
$fn$;

-- 6. qms.is_vendor_eligible
create or replace function qms.is_vendor_eligible(
  p_vendor_id uuid,
  p_service_id uuid,
  p_source_language_id uuid default null,
  p_target_language_id uuid default null
) returns table (
  eligible boolean, reason text, requires_iso boolean,
  required_role text, gating_mode text
)
language plpgsql stable security definer
set search_path = qms, public
as $fn$
declare
  v_requires_iso boolean;
  v_required_role text;
  v_has_qual boolean;
  v_has_pair boolean;
  v_has_nda boolean;
  v_mode text;
begin
  select coalesce(value #>> '{}', 'warn') into v_mode
  from qms.config where key = 'assignment_gating_mode';
  v_mode := coalesce(v_mode, 'warn');

  v_requires_iso := qms.requires_iso_qualification(p_service_id);

  if not v_requires_iso then
    return query select true, 'service does not require ISO qualification'::text,
                        false, null::text, v_mode;
    return;
  end if;

  select required_role_type_code into v_required_role
  from qms.service_iso_requirements where service_id = p_service_id;

  if v_required_role is null then
    return query select false,
                        'service requires ISO qualification but no role mapping defined'::text,
                        true, null::text, v_mode;
    return;
  end if;

  select exists (
    select 1 from qms.role_qualifications rq
    join qms.role_types rt on rt.id = rq.role_type_id
    where rq.vendor_id = p_vendor_id and rt.code = v_required_role
      and rq.status = 'qualified'
      and (rq.re_qualification_due is null or rq.re_qualification_due >= now())
  ) into v_has_qual;

  if not v_has_qual then
    return query select false,
                        format('vendor lacks an active qualified %s role qualification', v_required_role)::text,
                        true, v_required_role, v_mode;
    return;
  end if;

  if p_source_language_id is not null and p_target_language_id is not null then
    select exists (
      select 1 from qms.language_pair_qualifications lpq
      join qms.role_qualifications rq on rq.id = lpq.role_qualification_id
      join qms.role_types rt on rt.id = rq.role_type_id
      where rq.vendor_id = p_vendor_id and rt.code = v_required_role
        and rq.status = 'qualified'
        and (
          (lpq.source_language_id = p_source_language_id and lpq.target_language_id = p_target_language_id)
          or (lpq.direction = 'both_directions'
              and lpq.source_language_id = p_target_language_id
              and lpq.target_language_id = p_source_language_id)
        )
    ) into v_has_pair;

    if not v_has_pair then
      return query select false,
                          format('vendor not qualified for the requested language pair as %s', v_required_role)::text,
                          true, v_required_role, v_mode;
      return;
    end if;
  end if;

  select exists (
    select 1 from qms.nda_agreements
    where vendor_id = p_vendor_id and status = 'active'
      and (expiry_date is null or expiry_date >= current_date)
  ) into v_has_nda;

  if not v_has_nda then
    return query select false,
                        'vendor has no active, non-expired NDA on file'::text,
                        true, v_required_role, v_mode;
    return;
  end if;

  return query select true, 'vendor is qualified and NDA is active'::text,
                      true, v_required_role, v_mode;
end;
$fn$;

-- 7. qms.log_eligibility_check
create or replace function qms.log_eligibility_check(
  p_vendor_id uuid,
  p_service_id uuid,
  p_source_language_id uuid,
  p_target_language_id uuid,
  p_call_site text,
  p_order_id uuid default null,
  p_workflow_step_id uuid default null,
  p_vendor_step_offer_id uuid default null,
  p_payload jsonb default null
) returns table (
  eligible boolean, reason text, requires_iso boolean,
  required_role text, gating_mode text, event_id bigint
)
language plpgsql security definer
set search_path = qms, public
as $fn$
declare
  v_eligible boolean;
  v_reason text;
  v_requires_iso boolean;
  v_required_role text;
  v_mode text;
  v_event_id bigint;
begin
  select e.eligible, e.reason, e.requires_iso, e.required_role, e.gating_mode
    into v_eligible, v_reason, v_requires_iso, v_required_role, v_mode
  from qms.is_vendor_eligible(p_vendor_id, p_service_id, p_source_language_id, p_target_language_id) e;

  insert into qms.assignment_eligibility_events (
    vendor_id, service_id, source_language_id, target_language_id,
    order_id, workflow_step_id, vendor_step_offer_id,
    call_site, eligible, reason, requires_iso, required_role, gating_mode,
    payload, performed_by
  ) values (
    p_vendor_id, p_service_id, p_source_language_id, p_target_language_id,
    p_order_id, p_workflow_step_id, p_vendor_step_offer_id,
    p_call_site, v_eligible, v_reason, v_requires_iso, v_required_role, v_mode,
    p_payload, auth.uid()
  )
  returning id into v_event_id;

  return query select v_eligible, v_reason, v_requires_iso, v_required_role, v_mode, v_event_id;
end;
$fn$;

-- 8. RLS + grants
alter table qms.service_iso_requirements enable row level security;
create policy sir_select_all on qms.service_iso_requirements
  for select to authenticated using (true);
create policy sir_write_admin on qms.service_iso_requirements
  for all to authenticated using (qms.is_qms_admin())
  with check (qms.is_qms_admin());
grant select on qms.service_iso_requirements to authenticated;
grant insert, update, delete on qms.service_iso_requirements to authenticated;

alter table qms.assignment_eligibility_events enable row level security;
create policy aee_select_staff on qms.assignment_eligibility_events
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy aee_select_self on qms.assignment_eligibility_events
  for select to authenticated
  using (vendor_id = qms.current_vendor_id());
create policy aee_insert_authenticated on qms.assignment_eligibility_events
  for insert to authenticated with check (true);
grant select, insert on qms.assignment_eligibility_events to authenticated;
grant usage, select on sequence qms.assignment_eligibility_events_id_seq to authenticated;

grant execute on function qms.requires_iso_qualification(uuid) to authenticated;
grant execute on function qms.is_vendor_eligible(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function qms.log_eligibility_check(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, jsonb) to authenticated;

-- 9. Convenience views
create or replace view qms.v_iso_scoped_services as
select s.id, s.code, s.name, s.category,
       sir.required_role_type_code as required_role,
       rt.iso_clause_reference
from public.services s
join qms.service_iso_requirements sir on sir.service_id = s.id
join qms.role_types rt on rt.code = sir.required_role_type_code
where s.requires_iso_qualification = true and s.is_active = true
order by s.category, s.name;
grant select on qms.v_iso_scoped_services to authenticated;

create or replace view qms.v_recent_ineligible_assignments as
select aee.id, aee.performed_at, v.full_name as vendor_name, v.email as vendor_email,
       s.code as service_code, s.name as service_name,
       src.code as source_language, tgt.code as target_language,
       aee.call_site, aee.reason, aee.gating_mode, aee.required_role,
       aee.order_id, aee.workflow_step_id
from qms.assignment_eligibility_events aee
join public.vendors v on v.id = aee.vendor_id
left join public.services s on s.id = aee.service_id
left join public.languages src on src.id = aee.source_language_id
left join public.languages tgt on tgt.id = aee.target_language_id
where aee.eligible = false
order by aee.performed_at desc;
grant select on qms.v_recent_ineligible_assignments to authenticated;
