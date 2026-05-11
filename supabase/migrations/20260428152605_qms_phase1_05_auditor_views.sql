-- ============================================================================
-- QMS Phase 1 / Migration 5 of 6
-- Auditor-facing views: the queries Orion will run.
-- Also: retroactive qualification candidate view, expiring evidence,
--       re-qualification due, NDA expiry, qualified summary.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- v_qualified_translators_by_pair_and_subject
-- The decisive query in §7.9: "show me all translators currently qualified for
-- ES->EN in life sciences with active NDAs"
-- ---------------------------------------------------------------------------
create or replace view qms.v_qualified_translators_by_pair_and_subject as
select
  v.id as vendor_id,
  v.full_name,
  v.email,
  v.country,
  rq.id as role_qualification_id,
  rq.qualified_at,
  rq.last_re_qualified_at,
  rq.re_qualification_due,
  cb.code as competence_basis_code,
  cb.iso_clause_reference as competence_basis_iso_clause,
  src.id as source_language_id,
  src.code as source_language_code,
  src.name as source_language_name,
  tgt.id as target_language_id,
  tgt.code as target_language_code,
  tgt.name as target_language_name,
  sm.id as subject_matter_id,
  sm.code as subject_matter_code,
  sm.name as subject_matter_name,
  parent.code as subject_matter_parent_code,
  parent.name as subject_matter_parent_name,
  smq.proficiency,
  nda.id as nda_id,
  nda.signed_date as nda_signed,
  nda.expiry_date as nda_expires,
  nda.template_version as nda_template_version
from public.vendors v
join qms.role_qualifications rq on rq.vendor_id = v.id
join qms.role_types rt on rt.id = rq.role_type_id and rt.code = 'translator'
join qms.competence_bases cb on cb.id = rq.competence_basis_id
join qms.language_pair_qualifications lpq on lpq.role_qualification_id = rq.id
join public.languages src on src.id = lpq.source_language_id
join public.languages tgt on tgt.id = lpq.target_language_id
join qms.subject_matter_qualifications smq on smq.role_qualification_id = rq.id
join qms.subject_matters sm on sm.id = smq.subject_matter_id
left join qms.subject_matters parent on parent.id = sm.parent_id
join qms.nda_agreements nda on nda.vendor_id = v.id
   and nda.status = 'active'
   and (nda.expiry_date is null or nda.expiry_date >= current_date)
where rq.status = 'qualified'
  and (rq.re_qualification_due is null or rq.re_qualification_due >= now());

-- ---------------------------------------------------------------------------
-- v_qualified_revisers_by_pair_and_subject
-- ---------------------------------------------------------------------------
create or replace view qms.v_qualified_revisers_by_pair_and_subject as
select
  v.id as vendor_id, v.full_name, v.email, v.country,
  rq.id as role_qualification_id, rq.qualified_at, rq.re_qualification_due,
  cb.code as competence_basis_code, cb.iso_clause_reference as competence_basis_iso_clause,
  src.id as source_language_id, src.code as source_language_code, src.name as source_language_name,
  tgt.id as target_language_id, tgt.code as target_language_code, tgt.name as target_language_name,
  sm.id as subject_matter_id, sm.code as subject_matter_code, sm.name as subject_matter_name,
  parent.code as subject_matter_parent_code, parent.name as subject_matter_parent_name,
  nda.id as nda_id, nda.expiry_date as nda_expires
from public.vendors v
join qms.role_qualifications rq on rq.vendor_id = v.id
join qms.role_types rt on rt.id = rq.role_type_id and rt.code = 'reviser'
join qms.competence_bases cb on cb.id = rq.competence_basis_id
join qms.language_pair_qualifications lpq on lpq.role_qualification_id = rq.id
join public.languages src on src.id = lpq.source_language_id
join public.languages tgt on tgt.id = lpq.target_language_id
join qms.subject_matter_qualifications smq on smq.role_qualification_id = rq.id
join qms.subject_matters sm on sm.id = smq.subject_matter_id
left join qms.subject_matters parent on parent.id = sm.parent_id
join qms.nda_agreements nda on nda.vendor_id = v.id and nda.status = 'active'
   and (nda.expiry_date is null or nda.expiry_date >= current_date)
where rq.status = 'qualified'
  and (rq.re_qualification_due is null or rq.re_qualification_due >= now());

-- ---------------------------------------------------------------------------
-- v_qualified_post_editors_by_pair_and_subject
-- ---------------------------------------------------------------------------
create or replace view qms.v_qualified_post_editors_by_pair_and_subject as
select
  v.id as vendor_id, v.full_name, v.email, v.country,
  rq.id as role_qualification_id, rq.qualified_at, rq.re_qualification_due,
  cb.code as competence_basis_code, cb.iso_clause_reference as competence_basis_iso_clause,
  src.id as source_language_id, src.code as source_language_code, src.name as source_language_name,
  tgt.id as target_language_id, tgt.code as target_language_code, tgt.name as target_language_name,
  sm.id as subject_matter_id, sm.code as subject_matter_code, sm.name as subject_matter_name,
  parent.code as subject_matter_parent_code, parent.name as subject_matter_parent_name,
  nda.id as nda_id, nda.expiry_date as nda_expires
from public.vendors v
join qms.role_qualifications rq on rq.vendor_id = v.id
join qms.role_types rt on rt.id = rq.role_type_id and rt.code = 'post_editor'
join qms.competence_bases cb on cb.id = rq.competence_basis_id
join qms.language_pair_qualifications lpq on lpq.role_qualification_id = rq.id
join public.languages src on src.id = lpq.source_language_id
join public.languages tgt on tgt.id = lpq.target_language_id
join qms.subject_matter_qualifications smq on smq.role_qualification_id = rq.id
join qms.subject_matters sm on sm.id = smq.subject_matter_id
left join qms.subject_matters parent on parent.id = sm.parent_id
join qms.nda_agreements nda on nda.vendor_id = v.id and nda.status = 'active'
   and (nda.expiry_date is null or nda.expiry_date >= current_date)
where rq.status = 'qualified'
  and (rq.re_qualification_due is null or rq.re_qualification_due >= now());

-- ---------------------------------------------------------------------------
-- v_qualified_interpreters_by_mode_and_domain
-- ---------------------------------------------------------------------------
create or replace view qms.v_qualified_interpreters_by_mode_and_domain as
select
  v.id as vendor_id, v.full_name, v.email, v.country,
  rq.id as role_qualification_id, rq.qualified_at, rq.re_qualification_due,
  cb.code as competence_basis_code, cb.iso_clause_reference as competence_basis_iso_clause,
  src.id as working_language_a_id, src.code as working_language_a_code, src.name as working_language_a_name,
  tgt.id as working_language_b_id, tgt.code as working_language_b_code, tgt.name as working_language_b_name,
  im.code as interpreter_mode_code,
  im.name as interpreter_mode_name,
  im.nsgcis_relevant as mode_nsgcis_relevant,
  sm.id as domain_id,
  sm.code as domain_code,
  sm.name as domain_name,
  parent.code as domain_parent_code,
  nda.id as nda_id,
  nda.expiry_date as nda_expires
from public.vendors v
join qms.role_qualifications rq on rq.vendor_id = v.id
join qms.role_types rt on rt.id = rq.role_type_id and rt.code = 'interpreter'
join qms.competence_bases cb on cb.id = rq.competence_basis_id
join qms.language_pair_qualifications lpq on lpq.role_qualification_id = rq.id
join public.languages src on src.id = lpq.source_language_id
join public.languages tgt on tgt.id = lpq.target_language_id
left join qms.interpreter_mode_qualifications imq on imq.role_qualification_id = rq.id
left join qms.interpreter_modes im on im.id = imq.mode_id
left join qms.subject_matter_qualifications smq on smq.role_qualification_id = rq.id
left join qms.subject_matters sm on sm.id = smq.subject_matter_id
left join qms.subject_matters parent on parent.id = sm.parent_id
left join qms.nda_agreements nda on nda.vendor_id = v.id and nda.status = 'active'
   and (nda.expiry_date is null or nda.expiry_date >= current_date)
where rq.status = 'qualified'
  and (rq.re_qualification_due is null or rq.re_qualification_due >= now());

-- ---------------------------------------------------------------------------
-- v_evidence_expiring_soon — drives reminder workflow
-- ---------------------------------------------------------------------------
create or replace view qms.v_evidence_expiring_soon as
select
  ce.id as evidence_id,
  ce.vendor_id,
  v.full_name as vendor_name,
  v.email as vendor_email,
  et.code as evidence_type_code,
  et.name as evidence_type_name,
  ce.title,
  ce.expiry_date,
  ce.expiry_date - current_date as days_until_expiry,
  ce.role_qualification_id
from qms.competence_evidence ce
join public.vendors v on v.id = ce.vendor_id
join qms.evidence_types et on et.id = ce.evidence_type_id
where ce.expiry_date is not null
  and ce.expiry_date >= current_date
  and ce.expiry_date <= current_date + interval '60 days'
  and ce.superseded_by is null
order by ce.expiry_date asc;

-- ---------------------------------------------------------------------------
-- v_re_qualification_due
-- ---------------------------------------------------------------------------
create or replace view qms.v_re_qualification_due as
select
  rq.id as role_qualification_id,
  rq.vendor_id,
  v.full_name as vendor_name,
  v.email as vendor_email,
  rt.code as role_type_code,
  rt.name as role_type_name,
  rq.status,
  rq.qualified_at,
  rq.last_re_qualified_at,
  rq.re_qualification_due,
  rq.re_qualification_due - now() as time_until_due
from qms.role_qualifications rq
join public.vendors v on v.id = rq.vendor_id
join qms.role_types rt on rt.id = rq.role_type_id
where rq.status = 'qualified'
  and rq.re_qualification_due is not null
  and rq.re_qualification_due <= now() + interval '30 days'
order by rq.re_qualification_due asc;

-- ---------------------------------------------------------------------------
-- v_nda_expiring_soon
-- ---------------------------------------------------------------------------
create or replace view qms.v_nda_expiring_soon as
select
  nda.id as nda_id,
  nda.vendor_id,
  v.full_name as vendor_name,
  v.email as vendor_email,
  nda.template_version,
  nda.signed_date,
  nda.effective_date,
  nda.expiry_date,
  nda.expiry_date - current_date as days_until_expiry,
  nda.status
from qms.nda_agreements nda
join public.vendors v on v.id = nda.vendor_id
where nda.status = 'active'
  and nda.expiry_date is not null
  and nda.expiry_date <= current_date + interval '60 days'
order by nda.expiry_date asc;

-- ---------------------------------------------------------------------------
-- v_retroactive_qualification_candidates
-- The 260 vendors with prior project history but no QMS qualification yet.
-- ---------------------------------------------------------------------------
create or replace view qms.v_retroactive_qualification_candidates as
select
  v.id as vendor_id,
  v.full_name,
  v.email,
  v.country,
  v.years_experience,
  v.total_projects,
  v.last_project_date,
  v.status as vendor_status,
  v.xtrf_vendor_id,
  v.created_at as vendor_created_at,
  case when exists (select 1 from public.cvp_translators ct where ct.vendor_id = v.id) then true else false end as in_cvp_pipeline
from public.vendors v
where v.status in ('active','applicant')
  and v.total_projects > 0
  and not exists (select 1 from qms.role_qualifications rq where rq.vendor_id = v.id)
order by v.total_projects desc, v.last_project_date desc;

-- ---------------------------------------------------------------------------
-- v_qualification_summary — the "1-row-per-vendor" overview for admin UI
-- ---------------------------------------------------------------------------
create or replace view qms.v_qualification_summary as
select
  v.id as vendor_id,
  v.full_name,
  v.email,
  v.country,
  array_agg(distinct rt.code) filter (where rq.status = 'qualified') as qualified_roles,
  array_agg(distinct rt.code) filter (where rq.status = 'under_review') as under_review_roles,
  array_agg(distinct rt.code) filter (where rq.status = 'suspended') as suspended_roles,
  count(distinct ce.id) filter (where ce.verified = true and (ce.expiry_date is null or ce.expiry_date >= current_date)) as active_verified_evidence_count,
  bool_or(nda.status = 'active' and (nda.expiry_date is null or nda.expiry_date >= current_date)) as has_active_nda,
  min(nda.expiry_date) filter (where nda.status = 'active') as nda_next_expiry,
  min(rq.re_qualification_due) filter (where rq.status = 'qualified') as next_re_qualification_due
from public.vendors v
left join qms.role_qualifications rq on rq.vendor_id = v.id
left join qms.role_types rt on rt.id = rq.role_type_id
left join qms.competence_evidence ce on ce.vendor_id = v.id
left join qms.nda_agreements nda on nda.vendor_id = v.id
group by v.id, v.full_name, v.email, v.country;

-- ---------------------------------------------------------------------------
-- v_audit_log_recent — flattened recent audit log for admin UI / auditor sample
-- ---------------------------------------------------------------------------
create or replace view qms.v_audit_log_recent as
select
  al.id,
  al.vendor_id,
  v.full_name as vendor_name,
  al.role_qualification_id,
  rt.code as role_type_code,
  al.action,
  al.prior_status,
  al.new_status,
  al.reason,
  al.linked_evidence_ids,
  al.linked_nda_id,
  al.performed_by,
  su.email as performed_by_email,
  al.performed_at,
  al.payload,
  al.row_hash,
  al.prev_hash
from qms.qualification_audit_log al
join public.vendors v on v.id = al.vendor_id
left join qms.role_qualifications rq on rq.id = al.role_qualification_id
left join qms.role_types rt on rt.id = rq.role_type_id
left join public.staff_users su on su.auth_user_id = al.performed_by
order by al.performed_at desc;
