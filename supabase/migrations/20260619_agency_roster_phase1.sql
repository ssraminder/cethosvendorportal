-- ===========================================================================
-- Agency Roster Phase 1 (A3/A5/A6/A7)
-- Blinded subcontractor roster under agency vendor accounts.
-- Staff see only blinded data (handle + flags + pairs/domains); real names,
-- CVs and evidence are agency-private and released only on formal demand.
-- Applied to prod (lmzoyezvsjgsxveoakdr) via MCP 2026-06-19.
-- ===========================================================================

-- --- Private storage buckets -----------------------------------------------
insert into storage.buckets (id, name, public)
values ('vendor-roster-cvs', 'vendor-roster-cvs', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('roster-evidence-locker', 'roster-evidence-locker', false)
on conflict (id) do nothing;

-- --- Parent: roster linguists ----------------------------------------------
create table if not exists public.vendor_roster_linguists (
  id                    uuid primary key default gen_random_uuid(),
  vendor_id             uuid not null references public.vendors(id) on delete cascade,
  -- staff-visible (via safe view):
  handle                text not null,                 -- agency-chosen opaque label e.g. "L-01"
  competence_basis_code text references qms.competence_bases(code) deferrable initially deferred,
  is_active             boolean not null default true,
  iso_attested          boolean not null default false,
  iso_attested_at       timestamptz,
  -- SENSITIVE (agency + service_role only; never exposed to staff):
  real_name             text,
  cv_path               text,                          -- key in vendor-roster-cvs bucket
  cv_original_filename  text,
  cv_uploaded_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (vendor_id, handle)
);
create index if not exists idx_vrl_vendor on public.vendor_roster_linguists(vendor_id);

-- --- Child: language pairs (uppercase text codes, matching vendor_language_pairs)
create table if not exists public.vendor_roster_linguist_language_pairs (
  id                 uuid primary key default gen_random_uuid(),
  roster_linguist_id uuid not null references public.vendor_roster_linguists(id) on delete cascade,
  vendor_id          uuid not null references public.vendors(id),  -- denormalized for scoping
  source_language    text not null,
  target_language    text not null,
  created_at         timestamptz not null default now(),
  unique (roster_linguist_id, source_language, target_language)
);
create index if not exists idx_vrllp_linguist on public.vendor_roster_linguist_language_pairs(roster_linguist_id);
create index if not exists idx_vrllp_pair on public.vendor_roster_linguist_language_pairs(source_language, target_language);

-- --- Child: domains / specializations (FK qms.subject_matters) ---------------
create table if not exists public.vendor_roster_linguist_domains (
  id                 uuid primary key default gen_random_uuid(),
  roster_linguist_id uuid not null references public.vendor_roster_linguists(id) on delete cascade,
  vendor_id          uuid not null references public.vendors(id),
  subject_matter_id  uuid not null references qms.subject_matters(id),
  created_at         timestamptz not null default now(),
  unique (roster_linguist_id, subject_matter_id)
);
create index if not exists idx_vrld_linguist on public.vendor_roster_linguist_domains(roster_linguist_id);

-- --- Child: roles (FK qms.role_types) ---------------------------------------
create table if not exists public.vendor_roster_linguist_roles (
  id                 uuid primary key default gen_random_uuid(),
  roster_linguist_id uuid not null references public.vendor_roster_linguists(id) on delete cascade,
  vendor_id          uuid not null references public.vendors(id),
  role_type_code     text not null references qms.role_types(code) deferrable initially deferred,
  created_at         timestamptz not null default now(),
  unique (roster_linguist_id, role_type_code)
);
create index if not exists idx_vrlr_linguist on public.vendor_roster_linguist_roles(roster_linguist_id);

-- --- Evidence demand + release (on-demand only; no up-front evidence) --------
create table if not exists public.roster_evidence_demands (
  id                 uuid primary key default gen_random_uuid(),
  roster_linguist_id uuid not null references public.vendor_roster_linguists(id),
  vendor_id          uuid not null references public.vendors(id),
  order_id           uuid references public.orders(id),
  step_id            uuid references public.order_workflow_steps(id),
  reason             text,
  status             text not null default 'open' check (status in ('open','released','cancelled')),
  raised_by_staff_id uuid references public.staff_users(id),
  raised_at          timestamptz not null default now(),
  released_at        timestamptz,
  cancelled_at       timestamptz
);
create index if not exists idx_red_vendor on public.roster_evidence_demands(vendor_id);
create index if not exists idx_red_linguist on public.roster_evidence_demands(roster_linguist_id);
create index if not exists idx_red_status on public.roster_evidence_demands(status);

create table if not exists public.roster_evidence_releases (
  id                uuid primary key default gen_random_uuid(),
  demand_id         uuid not null references public.roster_evidence_demands(id) on delete cascade,
  vendor_id         uuid not null references public.vendors(id),
  evidence_kind     text,                              -- 'degree' | 'experience' | 'certificate' | 'other'
  locker_path       text not null,                     -- key in roster-evidence-locker
  original_filename text,
  file_mime         text,
  file_size         bigint,
  released_at       timestamptz not null default now()
);
create index if not exists idx_rer_demand on public.roster_evidence_releases(demand_id);

-- --- step_deliveries: which roster linguist performed the step ---------------
alter table public.step_deliveries
  add column if not exists roster_linguist_id uuid references public.vendor_roster_linguists(id);
create index if not exists idx_sd_roster on public.step_deliveries(roster_linguist_id);

-- --- Deterministic eligibility (no AI) --------------------------------------
create or replace function public.roster_linguist_is_eligible(p_id uuid)
returns boolean language sql stable as $$
  select
    l.is_active
    and l.iso_attested
    and l.cv_path is not null
    and l.competence_basis_code is not null
    and exists (select 1 from public.vendor_roster_linguist_language_pairs p where p.roster_linguist_id = l.id)
    and exists (select 1 from public.vendor_roster_linguist_roles r where r.roster_linguist_id = l.id)
    and exists (select 1 from public.vendor_roster_linguist_domains d where d.roster_linguist_id = l.id)
  from public.vendor_roster_linguists l
  where l.id = p_id;
$$;

-- --- WORM: lock roster_linguist_id after a delivery is approved --------------
create or replace function public.lock_roster_after_approval()
returns trigger language plpgsql as $$
begin
  if old.roster_linguist_id is not null
     and old.roster_linguist_id is distinct from new.roster_linguist_id
     and old.review_status = 'approved' then
    raise exception 'roster_linguist_id is locked after the delivery is approved (WORM / ISO 17100 audit)';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sd_roster_worm on public.step_deliveries;
create trigger trg_sd_roster_worm before update on public.step_deliveries
  for each row execute function public.lock_roster_after_approval();

-- ===========================================================================
-- RLS — blinded contract
-- service_role bypasses RLS (edge functions). Staff (authenticated) get NO
-- direct access to the sensitive parent/release tables; they read linguists
-- only through the safe view. Non-sensitive child tables are staff-readable.
-- ===========================================================================
alter table public.vendor_roster_linguists                enable row level security;
alter table public.vendor_roster_linguist_language_pairs  enable row level security;
alter table public.vendor_roster_linguist_domains         enable row level security;
alter table public.vendor_roster_linguist_roles           enable row level security;
alter table public.roster_evidence_demands                enable row level security;
alter table public.roster_evidence_releases               enable row level security;

-- service_role explicit ALL (defensive; service_role also bypasses RLS)
grant all on public.vendor_roster_linguists,
             public.vendor_roster_linguist_language_pairs,
             public.vendor_roster_linguist_domains,
             public.vendor_roster_linguist_roles,
             public.roster_evidence_demands,
             public.roster_evidence_releases
  to service_role;

-- Staff may read non-sensitive child rows directly (for job matching)
grant select on public.vendor_roster_linguist_language_pairs,
                public.vendor_roster_linguist_domains,
                public.vendor_roster_linguist_roles,
                public.roster_evidence_demands,
                public.roster_evidence_releases
  to authenticated;

create policy vrllp_staff_read on public.vendor_roster_linguist_language_pairs
  for select to authenticated using (public.is_active_staff());
create policy vrld_staff_read on public.vendor_roster_linguist_domains
  for select to authenticated using (public.is_active_staff());
create policy vrlr_staff_read on public.vendor_roster_linguist_roles
  for select to authenticated using (public.is_active_staff());
create policy red_staff_read on public.roster_evidence_demands
  for select to authenticated using (public.is_active_staff());
create policy rer_staff_read on public.roster_evidence_releases
  for select to authenticated using (public.is_active_staff());

-- Sensitive base tables: NO authenticated grant, NO authenticated policy.
revoke all on public.vendor_roster_linguists from anon, authenticated;

-- --- Staff-safe projection view (definer; bypasses base-table RLS) -----------
create or replace view public.vendor_roster_linguists_safe as
select
  l.id,
  l.vendor_id,
  l.handle,
  l.competence_basis_code,
  cb.short_label as competence_label,
  l.is_active,
  l.iso_attested,
  public.roster_linguist_is_eligible(l.id) as is_eligible,
  l.created_at
from public.vendor_roster_linguists l
left join qms.competence_bases cb on cb.code = l.competence_basis_code;

revoke all on public.vendor_roster_linguists_safe from anon;
grant select on public.vendor_roster_linguists_safe to authenticated, service_role;

-- ===========================================================================
-- T&C: roster_terms agreement type + vendor mirror column
-- ===========================================================================
alter table public.nda_templates       drop constraint if exists nda_templates_agreement_type_check;
alter table public.nda_templates       add  constraint nda_templates_agreement_type_check
  check (agreement_type in ('nda','gvsa','roster_terms'));
alter table public.vendor_nda_signatures drop constraint if exists vendor_nda_signatures_agreement_type_check;
alter table public.vendor_nda_signatures add  constraint vendor_nda_signatures_agreement_type_check
  check (agreement_type in ('nda','gvsa','roster_terms'));

alter table public.vendors add column if not exists roster_terms_signed_at timestamptz;
alter table public.vendors add column if not exists roster_terms_template_id uuid references public.nda_templates(id);

comment on table public.vendor_roster_linguists is
  'Blinded subcontractor roster per agency vendor. real_name/cv_path are agency-private (RLS denies staff). Staff read via vendor_roster_linguists_safe.';
comment on column public.step_deliveries.roster_linguist_id is
  'Agency-selected roster linguist who performed this step (replaces free-text vendor_identifier for agencies). WORM-locked after approval.';

-- ===========================================================================
-- Public accessor for ISO reference data the roster UI needs (qms.* is not
-- exposed to PostgREST). Reference data is non-sensitive.
-- ===========================================================================
create or replace function public.roster_reference_data()
returns jsonb
language sql
stable
security definer
set search_path = public, qms
as $$
  select jsonb_build_object(
    'competence_bases', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', code, 'role_type_code', role_type_code,
        'short_label', short_label, 'iso_clause_reference', iso_clause_reference
      ) order by code), '[]'::jsonb) from qms.competence_bases),
    'role_types', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', code, 'name', name, 'iso_clause_reference', iso_clause_reference
      ) order by name), '[]'::jsonb) from qms.role_types),
    'subject_matters', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'code', code, 'name', name,
        'parent_id', parent_id, 'level', level, 'sort_order', sort_order
      ) order by sort_order nulls last, name), '[]'::jsonb) from qms.subject_matters),
    'languages', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', code, 'name', name
      ) order by sort_order nulls last, name), '[]'::jsonb)
      from public.languages where is_active = true)
  );
$$;
grant execute on function public.roster_reference_data() to anon, authenticated, service_role;
