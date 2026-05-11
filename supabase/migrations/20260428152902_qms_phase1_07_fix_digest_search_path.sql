-- ============================================================================
-- QMS Phase 1 / Hotfix
-- pgcrypto digest() lives in `extensions` schema in Supabase. Functions that
-- need it must either qualify the call or include `extensions` in search_path.
-- ============================================================================

create or replace function qms.audit_log_hash_chain()
returns trigger
language plpgsql
set search_path = qms, public, extensions
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

  new.row_hash := encode(extensions.digest(v_canonical, 'sha256'), 'hex');
  return new;
end;
$fn$;

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
set search_path = qms, public, extensions
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
    v_recomputed := encode(extensions.digest(v_canonical, 'sha256'), 'hex');
    if r.row_hash <> v_recomputed then
      v_first_bad := r.id;
      return query select false, v_count, v_first_bad,
        format('Row %s row_hash mismatch (recomputed %s, stored %s)', r.id, v_recomputed, r.row_hash);
      return;
    end if;
    v_expected_prev := r.row_hash;
  end loop;

  return query select true, v_count, null::bigint, format('OK %s rows verified.', v_count);
end;
$fn$;
