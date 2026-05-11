-- ============================================================================
-- QMS Phase 1 / Migration 4 of 6
-- Language code aliases (bridge from vendor_language_pairs uppercase text to
-- public.languages uuid) and cvp_translators -> vendors FK.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- language_code_aliases — text alias -> public.languages.id (uuid)
-- ---------------------------------------------------------------------------
create table qms.language_code_aliases (
  alias_code text primary key,
  language_id uuid not null references public.languages(id) on delete restrict,
  source text,
  notes text,
  created_at timestamptz not null default now()
);
comment on table qms.language_code_aliases is 'Text-code -> uuid bridge for vendor_language_pairs and any external code form. Alias_code stored exactly as the consumer uses it (case sensitive).';

-- ---------------------------------------------------------------------------
-- Seed: case-insensitive matches from vendor_language_pairs into public.languages
-- ---------------------------------------------------------------------------
insert into qms.language_code_aliases (alias_code, language_id, source, notes)
select distinct upper(l.code), l.id, 'languages.code (uppercased)', 'Auto-seeded from public.languages with uppercased code form for vendor_language_pairs convention.'
from public.languages l
on conflict (alias_code) do nothing;

insert into qms.language_code_aliases (alias_code, language_id, source, notes)
select distinct upper(vlp.source_language), l.id, 'vendor_language_pairs.source_language (case-insensitive match)', null
from public.vendor_language_pairs vlp
join public.languages l on lower(l.code) = lower(vlp.source_language)
where not exists (select 1 from qms.language_code_aliases a where a.alias_code = upper(vlp.source_language))
on conflict (alias_code) do nothing;

insert into qms.language_code_aliases (alias_code, language_id, source, notes)
select distinct upper(vlp.target_language), l.id, 'vendor_language_pairs.target_language (case-insensitive match)', null
from public.vendor_language_pairs vlp
join public.languages l on lower(l.code) = lower(vlp.target_language)
where not exists (select 1 from qms.language_code_aliases a where a.alias_code = upper(vlp.target_language))
on conflict (alias_code) do nothing;

-- ---------------------------------------------------------------------------
-- Resolver helper
-- ---------------------------------------------------------------------------
create or replace function qms.resolve_language(p_code text)
returns uuid
language sql
stable
as $fn$
  select language_id from qms.language_code_aliases where alias_code = upper(p_code)
  union all
  select id from public.languages where lower(code) = lower(p_code)
  limit 1;
$fn$;

-- ---------------------------------------------------------------------------
-- View: unresolved vendor_language_pairs codes (Phase 2 cleanup target)
-- ---------------------------------------------------------------------------
create view qms.v_unresolved_language_codes as
select 'src' as side, vlp.source_language as code, count(*) as occurrences
from public.vendor_language_pairs vlp
where qms.resolve_language(vlp.source_language) is null
group by vlp.source_language
union all
select 'tgt' as side, vlp.target_language as code, count(*) as occurrences
from public.vendor_language_pairs vlp
where qms.resolve_language(vlp.target_language) is null
group by vlp.target_language;
comment on view qms.v_unresolved_language_codes is 'Codes in vendor_language_pairs that do not resolve via qms.language_code_aliases. Drives Phase 2 alias-population workflow.';

-- ---------------------------------------------------------------------------
-- cvp_translators -> vendors FK bridge
-- ---------------------------------------------------------------------------
alter table public.cvp_translators
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

create index if not exists cvp_translators_vendor_id_idx on public.cvp_translators (vendor_id);

comment on column public.cvp_translators.vendor_id is 'Bridge to public.vendors. Populated when CVP graduates are linked to a canonical vendor record. Existing email-match logic remains a fallback.';
