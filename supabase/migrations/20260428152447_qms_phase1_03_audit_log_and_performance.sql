-- ============================================================================
-- QMS Phase 1 / Migration 3 of 6
-- Tamper-evident audit log (REVOKE + trigger + hash chain), performance events,
-- qualification preconditions trigger, auto-logging triggers.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- qualification_audit_log — append-only, hash-chained
-- ---------------------------------------------------------------------------
create table qms.qualification_audit_log (
  id bigserial primary key,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  role_qualification_id uuid references qms.role_qualifications(id) on delete restrict,
  action qms.audit_action not null,
  prior_status qms.qualification_status,
  new_status qms.qualification_status,
  reason text,
  linked_evidence_ids uuid[],
  linked_nda_id uuid references qms.nda_agreements(id) on delete restrict,
  payload jsonb,
  performed_by uuid references auth.users(id),
  performed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  prev_hash text,
  row_hash text not null
);
comment on table qms.qualification_audit_log is 'Append-only audit log. Three layers of tamper resistance: (1) REVOKE UPDATE/DELETE, (2) BEFORE UPDATE/DELETE trigger raises exception, (3) sha256 hash chain (each row hashes prior row + canonical payload). Verify with qms.verify_audit_log_integrity().';

create index qualification_audit_log_vendor_idx
  on qms.qualification_audit_log (vendor_id, performed_at desc);
create index qualification_audit_log_role_qual_idx
  on qms.qualification_audit_log (role_qualification_id, performed_at desc) where role_qualification_id is not null;
create index qualification_audit_log_action_idx
  on qms.qualification_audit_log (action, performed_at desc);

-- ---------------------------------------------------------------------------
-- Hash chain BEFORE INSERT trigger
-- ---------------------------------------------------------------------------
create or replace function qms.audit_log_hash_chain()
returns trigger
language plpgsql
as $fn$
declare
  v_prev_hash text;
  v_canonical text;
begin
  select row_hash into v_prev_hash
  from qms.qualification_audit_log
  order by id desc
  limit 1;

  new.prev_hash := coalesce(v_prev_hash, '0000000000000000000000000000000000000000000000000000000000000000');

  v_canonical := concat_ws('|',
    new.prev_hash,
    new.vendor_id::text,
    coalesce(new.role_qualification_id::text,''),
    new.action::text,
    coalesce(new.prior_status::text,''),
    coalesce(new.new_status::text,''),
    coalesce(new.reason,''),
    coalesce(array_to_string(new.linked_evidence_ids,','),''),
    coalesce(new.linked_nda_id::text,''),
    coalesce(new.payload::text,''),
    coalesce(new.performed_by::text,''),
    new.performed_at::text,
    coalesce(new.ip_address::text,''),
    coalesce(new.user_agent,'')
  );

  new.row_hash := encode(digest(v_canonical, 'sha256'), 'hex');
  return new;
end;
$fn$;

create trigger trg_audit_log_hash_chain
  before insert on qms.qualification_audit_log
  for each row execute function qms.audit_log_hash_chain();

-- ---------------------------------------------------------------------------
-- Tamper trigger: prevent UPDATE / DELETE in addition to REVOKE
-- ---------------------------------------------------------------------------
create or replace function qms.audit_log_no_mutate()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'qms.qualification_audit_log is append-only. UPDATE and DELETE are prohibited.'
    using errcode = 'insufficient_privilege';
end;
$fn$;

create trigger trg_audit_log_no_update
  before update on qms.qualification_audit_log
  for each row execute function qms.audit_log_no_mutate();

create trigger trg_audit_log_no_delete
  before delete on qms.qualification_audit_log
  for each row execute function qms.audit_log_no_mutate();

-- ---------------------------------------------------------------------------
-- REVOKE UPDATE, DELETE, TRUNCATE on the audit log from every role
-- ---------------------------------------------------------------------------
revoke update, delete, truncate on qms.qualification_audit_log from public;
revoke update, delete, truncate on qms.qualification_audit_log from authenticated;
revoke update, delete, truncate on qms.qualification_audit_log from anon;
revoke update, delete, truncate on qms.qualification_audit_log from service_role;

-- ---------------------------------------------------------------------------
-- Integrity verifier (read-only walk of the chain)
-- ---------------------------------------------------------------------------
create or replace function qms.verify_audit_log_integrity()
returns table (
  ok boolean,
  rows_checked bigint,
  first_bad_id bigint,
  message text
)
language plpgsql
stable
security definer
set search_path = qms, public
as $fn$
declare
  r record;
  v_expected_prev text;
  v_canonical text;
  v_recomputed text;
  v_count bigint := 0;
  v_first_bad bigint;
begin
  v_expected_prev := '0000000000000000000000000000000000000000000000000000000000000000';
  for r in
    select * from qms.qualification_audit_log order by id asc
  loop
    v_count := v_count + 1;
    if r.prev_hash is distinct from v_expected_prev then
      v_first_bad := r.id;
      return query select false, v_count, v_first_bad,
        format('Row %s prev_hash mismatch (expected %s, got %s)', r.id, v_expected_prev, r.prev_hash);
      return;
    end if;

    v_canonical := concat_ws('|',
      r.prev_hash,
      r.vendor_id::text,
      coalesce(r.role_qualification_id::text,''),
      r.action::text,
      coalesce(r.prior_status::text,''),
      coalesce(r.new_status::text,''),
      coalesce(r.reason,''),
      coalesce(array_to_string(r.linked_evidence_ids,','),''),
      coalesce(r.linked_nda_id::text,''),
      coalesce(r.payload::text,''),
      coalesce(r.performed_by::text,''),
      r.performed_at::text,
      coalesce(r.ip_address::text,''),
      coalesce(r.user_agent,'')
    );
    v_recomputed := encode(digest(v_canonical, 'sha256'), 'hex');
    if r.row_hash <> v_recomputed then
      v_first_bad := r.id;
      return query select false, v_count, v_first_bad,
        format('Row %s row_hash mismatch (recomputed %s, stored %s)', r.id, v_recomputed, r.row_hash);
      return;
    end if;
    v_expected_prev := r.row_hash;
  end loop;

  return query select true, v_count, null::bigint, format('OK — %s rows verified.', v_count);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Qualification preconditions: status='qualified' requires basis + verified
-- evidence + active NDA (governed by qms.config flags).
-- ---------------------------------------------------------------------------
create or replace function qms.enforce_qualification_preconditions()
returns trigger
language plpgsql
as $fn$
declare
  v_role_code text;
  v_basis_role_code text;
  v_evidence_required boolean;
  v_nda_required boolean;
  v_has_verified_evidence boolean;
  v_has_active_nda boolean;
  v_re_qual_months int;
begin
  if new.status <> 'qualified' then
    return new;
  end if;

  if new.competence_basis_id is null then
    raise exception 'role_qualifications.status=qualified requires competence_basis_id.'
      using errcode = '23514';
  end if;
  if new.qualified_at is null then
    new.qualified_at := now();
  end if;
  if new.qualified_by is null then
    new.qualified_by := auth.uid();
  end if;
  if new.qualified_by is null then
    raise exception 'role_qualifications.status=qualified requires qualified_by (auth.uid() was NULL — call from authenticated session).'
      using errcode = '23514';
  end if;

  select cb.role_type_code into v_basis_role_code
  from qms.competence_bases cb where cb.id = new.competence_basis_id;
  select rt.code into v_role_code
  from qms.role_types rt where rt.id = new.role_type_id;
  if v_basis_role_code <> v_role_code then
    raise exception 'competence_basis_id role (%) does not match role_qualifications.role_type (%).',
      v_basis_role_code, v_role_code
      using errcode = '23514';
  end if;

  select (value::text)::boolean into v_evidence_required
  from qms.config where key = 'qualification_requires_verified_evidence';
  v_evidence_required := coalesce(v_evidence_required, true);

  if v_evidence_required then
    select exists (
      select 1 from qms.competence_evidence ce
      where ce.vendor_id = new.vendor_id
        and ce.verified = true
        and (ce.expiry_date is null or ce.expiry_date >= current_date)
    ) into v_has_verified_evidence;
    if not v_has_verified_evidence then
      raise exception 'Cannot qualify vendor %: no verified, non-expired competence_evidence rows.',
        new.vendor_id
        using errcode = '23514';
    end if;
  end if;

  select (value::text)::boolean into v_nda_required
  from qms.config where key = 'qualification_requires_active_nda';
  v_nda_required := coalesce(v_nda_required, true);

  if v_nda_required then
    select exists (
      select 1 from qms.nda_agreements n
      where n.vendor_id = new.vendor_id
        and n.status = 'active'
        and (n.expiry_date is null or n.expiry_date >= current_date)
    ) into v_has_active_nda;
    if not v_has_active_nda then
      raise exception 'Cannot qualify vendor %: no active, non-expired NDA on file.',
        new.vendor_id
        using errcode = '23514';
    end if;
  end if;

  if new.re_qualification_due is null then
    select (value::text)::int into v_re_qual_months
    from qms.config where key = 're_qualification_interval_months';
    v_re_qual_months := coalesce(v_re_qual_months, 12);
    new.re_qualification_due := new.qualified_at + make_interval(months => v_re_qual_months);
  end if;

  return new;
end;
$fn$;

create trigger trg_role_qualifications_preconditions
  before insert or update on qms.role_qualifications
  for each row execute function qms.enforce_qualification_preconditions();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function qms.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'updated_by' then
    new.updated_by := coalesce(new.updated_by, auth.uid());
  end if;
  return new;
end;
$fn$;

create trigger trg_role_qualifications_touch
  before update on qms.role_qualifications
  for each row execute function qms.touch_updated_at();
create trigger trg_competence_evidence_touch
  before update on qms.competence_evidence
  for each row execute function qms.touch_updated_at();
create trigger trg_nda_agreements_touch
  before update on qms.nda_agreements
  for each row execute function qms.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-logging triggers — write to qualification_audit_log automatically.
-- ---------------------------------------------------------------------------
create or replace function qms.log_role_qualification_change()
returns trigger
language plpgsql
as $fn$
declare
  v_action qms.audit_action;
begin
  if tg_op = 'INSERT' then
    v_action := case new.status
                  when 'qualified' then 'qualified'::qms.audit_action
                  when 'under_review' then 'submitted_for_review'::qms.audit_action
                  else 'applied'::qms.audit_action
                end;
    insert into qms.qualification_audit_log
      (vendor_id, role_qualification_id, action, prior_status, new_status, reason, performed_by, payload)
    values
      (new.vendor_id, new.id, v_action, null, new.status, new.competence_basis_notes, coalesce(new.qualified_by, new.created_by, auth.uid()),
       jsonb_build_object('competence_basis_id', new.competence_basis_id, 're_qualification_due', new.re_qualification_due));
    return new;
  end if;

  if tg_op = 'UPDATE' and (old.status is distinct from new.status) then
    v_action := case
      when new.status = 'qualified' and old.status = 'qualified' then 're_qualified'::qms.audit_action
      when new.status = 'qualified' then 'qualified'::qms.audit_action
      when new.status = 'suspended' then 'suspended'::qms.audit_action
      when new.status = 'withdrawn' then 'withdrawn'::qms.audit_action
      when new.status = 'expired' then 'archived'::qms.audit_action
      when old.status = 'suspended' and new.status = 'qualified' then 'reinstated'::qms.audit_action
      else 'submitted_for_review'::qms.audit_action
    end;
    insert into qms.qualification_audit_log
      (vendor_id, role_qualification_id, action, prior_status, new_status, reason, performed_by, payload)
    values
      (new.vendor_id, new.id, v_action, old.status, new.status,
       coalesce(new.suspension_reason, new.withdrawn_reason, new.competence_basis_notes),
       coalesce(new.updated_by, new.qualified_by, auth.uid()),
       jsonb_build_object('competence_basis_id', new.competence_basis_id, 're_qualification_due', new.re_qualification_due));
    return new;
  end if;

  if tg_op = 'UPDATE' and (old.last_re_qualified_at is distinct from new.last_re_qualified_at) and new.last_re_qualified_at is not null then
    insert into qms.qualification_audit_log
      (vendor_id, role_qualification_id, action, prior_status, new_status, reason, performed_by, payload)
    values
      (new.vendor_id, new.id, 're_qualified'::qms.audit_action, old.status, new.status,
       'Periodic re-qualification', coalesce(new.updated_by, auth.uid()),
       jsonb_build_object('last_re_qualified_at', new.last_re_qualified_at, 're_qualification_due', new.re_qualification_due));
    return new;
  end if;

  return new;
end;
$fn$;

create trigger trg_role_qualifications_audit
  after insert or update on qms.role_qualifications
  for each row execute function qms.log_role_qualification_change();

create or replace function qms.log_evidence_change()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'INSERT' then
    insert into qms.qualification_audit_log
      (vendor_id, role_qualification_id, action, reason, linked_evidence_ids, performed_by, payload)
    values
      (new.vendor_id, new.role_qualification_id, 'evidence_added'::qms.audit_action, new.title,
       array[new.id], coalesce(new.created_by, auth.uid()),
       jsonb_build_object('evidence_type_id', new.evidence_type_id, 'expiry_date', new.expiry_date, 'verified', new.verified));
    return new;
  end if;

  if tg_op = 'UPDATE' and old.verified is distinct from new.verified and new.verified = true then
    insert into qms.qualification_audit_log
      (vendor_id, role_qualification_id, action, reason, linked_evidence_ids, performed_by, payload)
    values
      (new.vendor_id, new.role_qualification_id, 'evidence_verified'::qms.audit_action,
       coalesce(new.verification_notes, new.title),
       array[new.id], coalesce(new.verified_by, auth.uid()),
       jsonb_build_object('verification_method', new.verification_method));
    return new;
  end if;

  if tg_op = 'UPDATE' and old.superseded_by is null and new.superseded_by is not null then
    insert into qms.qualification_audit_log
      (vendor_id, role_qualification_id, action, reason, linked_evidence_ids, performed_by, payload)
    values
      (new.vendor_id, new.role_qualification_id, 'evidence_superseded'::qms.audit_action, new.title,
       array[new.id, new.superseded_by], coalesce(new.updated_by, auth.uid()),
       jsonb_build_object('superseded_by', new.superseded_by));
    return new;
  end if;

  return new;
end;
$fn$;

create trigger trg_competence_evidence_audit
  after insert or update on qms.competence_evidence
  for each row execute function qms.log_evidence_change();

create or replace function qms.log_nda_change()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'INSERT' then
    insert into qms.qualification_audit_log
      (vendor_id, action, reason, linked_nda_id, performed_by, payload)
    values
      (new.vendor_id, 'nda_signed'::qms.audit_action, new.template_version, new.id,
       coalesce(new.created_by, auth.uid()),
       jsonb_build_object('signed_date', new.signed_date, 'expiry_date', new.expiry_date, 'method', new.signed_method));
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'active' and old.status <> 'active' then
      insert into qms.qualification_audit_log
        (vendor_id, action, reason, linked_nda_id, performed_by, payload)
      values
        (new.vendor_id, 'nda_renewed'::qms.audit_action, new.template_version, new.id,
         coalesce(new.updated_by, auth.uid()),
         jsonb_build_object('signed_date', new.signed_date, 'expiry_date', new.expiry_date));
    elsif new.status = 'revoked' then
      insert into qms.qualification_audit_log
        (vendor_id, action, reason, linked_nda_id, performed_by, payload)
      values
        (new.vendor_id, 'nda_revoked'::qms.audit_action, new.revoked_reason, new.id,
         coalesce(new.updated_by, auth.uid()),
         jsonb_build_object('revoked_at', new.revoked_at));
    end if;
  end if;

  return new;
end;
$fn$;

create trigger trg_nda_agreements_audit
  after insert or update on qms.nda_agreements
  for each row execute function qms.log_nda_change();

-- ---------------------------------------------------------------------------
-- performance_events — granular feed for re-qualification triggers
-- ---------------------------------------------------------------------------
create table qms.performance_events (
  id uuid primary key default gen_random_uuid(),
  role_qualification_id uuid not null references qms.role_qualifications(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  event_type qms.performance_event_type not null,
  severity qms.severity,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id),
  project_reference text,
  description text,
  payload jsonb,
  notes text
);
create index performance_events_role_qual_idx
  on qms.performance_events (role_qualification_id, occurred_at desc);
create index performance_events_vendor_idx
  on qms.performance_events (vendor_id, occurred_at desc);
create index performance_events_type_idx
  on qms.performance_events (event_type, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Materialized rollup snapshot (no refresh schedule yet — Phase 2)
-- ---------------------------------------------------------------------------
create materialized view qms.linguist_performance_snapshot as
select
  rq.id as role_qualification_id,
  rq.vendor_id,
  rq.role_type_id,
  count(pe.id) filter (where pe.event_type = 'project_completed') as projects_completed,
  count(pe.id) filter (where pe.event_type = 'revision_finding') as revision_findings,
  count(pe.id) filter (where pe.event_type = 'client_complaint') as client_complaints,
  count(pe.id) filter (where pe.event_type = 'client_compliment') as client_compliments,
  count(pe.id) filter (where pe.event_type = 'late_delivery') as late_deliveries,
  count(pe.id) filter (where pe.event_type = 'quality_issue') as quality_issues,
  max(pe.occurred_at) as last_event_at,
  count(pe.id) filter (where pe.severity in ('high','critical')) as high_severity_events
from qms.role_qualifications rq
left join qms.performance_events pe on pe.role_qualification_id = rq.id
group by rq.id, rq.vendor_id, rq.role_type_id;

create unique index linguist_performance_snapshot_role_qual_idx
  on qms.linguist_performance_snapshot (role_qualification_id);

comment on materialized view qms.linguist_performance_snapshot is 'Per-role-qualification rollup of performance events. Refresh schedule deferred to Phase 2.';
