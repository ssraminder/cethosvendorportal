-- ============================================================================
-- QMS Phase 1 / Migration 6 of 6
-- Row Level Security policies and grants.
--
-- Role model (mapped via qms.role_assignments + public.staff_users):
--   qms_admin           — read/write all qms.*; only role that can assign qms roles
--   qms_vendor_manager  — qualification authority; insert/update vendors, evidence,
--                         role_qualifications, NDA. Cannot UPDATE/DELETE audit log.
--   qms_project_manager — read-only on qualified vendors and their qualifications.
--                         No internal_notes (column-restricted via app), no audit log.
--   qms_auditor         — read-only across all qms.* including audit log.
--   linguist (vendor)   — sees only own vendor row + own evidence + own NDA.
--                         Matched by vendors.auth_user_id = auth.uid().
-- ============================================================================

-- Grant USAGE on schema
grant usage on schema qms to authenticated;
grant usage on schema qms to service_role;
grant usage on schema qms to anon;

-- Default table privileges: nothing — every read/write goes through RLS-policied tables.
-- Reference tables: SELECT for authenticated (these are seed-only public taxonomies).
grant select on qms.role_types to authenticated, anon, service_role;
grant select on qms.competence_bases to authenticated, anon, service_role;
grant select on qms.evidence_types to authenticated, anon, service_role;
grant select on qms.subject_matters to authenticated, anon, service_role;
grant select on qms.interpreter_modes to authenticated, anon, service_role;

-- Data tables: grant base privileges to authenticated; RLS gates rows.
grant select, insert, update on qms.role_assignments to authenticated;
grant select, insert, update on qms.config to authenticated;
grant select, insert, update on qms.policy_versions to authenticated;
grant select, insert, update on qms.role_qualifications to authenticated;
grant select, insert, update on qms.competence_evidence to authenticated;
grant select, insert, update, delete on qms.subject_matter_qualifications to authenticated;
grant select, insert, update, delete on qms.interpreter_mode_qualifications to authenticated;
grant select, insert, update, delete on qms.language_pair_qualifications to authenticated;
grant select, insert, update on qms.professional_experience to authenticated;
grant select, insert, update on qms.nda_agreements to authenticated;
grant select, insert, update, delete on qms.language_code_aliases to authenticated;

-- Audit log: SELECT + INSERT only. UPDATE/DELETE/TRUNCATE were revoked in M3.
grant select, insert on qms.qualification_audit_log to authenticated;
grant usage, select on sequence qms.qualification_audit_log_id_seq to authenticated;

-- Performance events: full CRUD for qms staff
grant select, insert, update, delete on qms.performance_events to authenticated;

-- Views: SELECT
grant select on qms.v_qualified_translators_by_pair_and_subject to authenticated;
grant select on qms.v_qualified_revisers_by_pair_and_subject to authenticated;
grant select on qms.v_qualified_post_editors_by_pair_and_subject to authenticated;
grant select on qms.v_qualified_interpreters_by_mode_and_domain to authenticated;
grant select on qms.v_evidence_expiring_soon to authenticated;
grant select on qms.v_re_qualification_due to authenticated;
grant select on qms.v_nda_expiring_soon to authenticated;
grant select on qms.v_retroactive_qualification_candidates to authenticated;
grant select on qms.v_qualification_summary to authenticated;
grant select on qms.v_audit_log_recent to authenticated;
grant select on qms.v_unresolved_language_codes to authenticated;
grant select on qms.linguist_performance_snapshot to authenticated;

-- Helpers callable
grant execute on function qms.has_qms_role(qms.qms_role) to authenticated;
grant execute on function qms.is_qms_admin() to authenticated;
grant execute on function qms.is_qms_staff() to authenticated;
grant execute on function qms.current_vendor_id() to authenticated;
grant execute on function qms.resolve_language(text) to authenticated;
grant execute on function qms.verify_audit_log_integrity() to authenticated;

-- ============================================================================
-- Enable RLS on every qms.* table
-- ============================================================================
alter table qms.role_types               enable row level security;
alter table qms.competence_bases         enable row level security;
alter table qms.evidence_types           enable row level security;
alter table qms.subject_matters          enable row level security;
alter table qms.interpreter_modes        enable row level security;
alter table qms.role_assignments         enable row level security;
alter table qms.config                   enable row level security;
alter table qms.policy_versions          enable row level security;
alter table qms.role_qualifications      enable row level security;
alter table qms.competence_evidence      enable row level security;
alter table qms.subject_matter_qualifications  enable row level security;
alter table qms.interpreter_mode_qualifications enable row level security;
alter table qms.language_pair_qualifications   enable row level security;
alter table qms.professional_experience  enable row level security;
alter table qms.nda_agreements           enable row level security;
alter table qms.language_code_aliases    enable row level security;
alter table qms.qualification_audit_log  enable row level security;
alter table qms.performance_events       enable row level security;

-- ============================================================================
-- Reference tables: read for any authenticated; write only for qms_admin
-- ============================================================================
create policy ref_select_all on qms.role_types
  for select to authenticated using (true);
create policy ref_write_admin on qms.role_types
  for all to authenticated using (qms.is_qms_admin()) with check (qms.is_qms_admin());

create policy ref_select_all on qms.competence_bases
  for select to authenticated using (true);
create policy ref_write_admin on qms.competence_bases
  for all to authenticated using (qms.is_qms_admin()) with check (qms.is_qms_admin());

create policy ref_select_all on qms.evidence_types
  for select to authenticated using (true);
create policy ref_write_admin on qms.evidence_types
  for all to authenticated using (qms.is_qms_admin()) with check (qms.is_qms_admin());

create policy ref_select_all on qms.subject_matters
  for select to authenticated using (true);
create policy ref_write_admin on qms.subject_matters
  for all to authenticated using (qms.is_qms_admin()) with check (qms.is_qms_admin());

create policy ref_select_all on qms.interpreter_modes
  for select to authenticated using (true);
create policy ref_write_admin on qms.interpreter_modes
  for all to authenticated using (qms.is_qms_admin()) with check (qms.is_qms_admin());

create policy ref_select_all on qms.language_code_aliases
  for select to authenticated using (true);
create policy ref_write_admin on qms.language_code_aliases
  for all to authenticated using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

-- ============================================================================
-- role_assignments: only qms_admin can read/write
-- ============================================================================
create policy role_assignments_admin on qms.role_assignments
  for all to authenticated using (qms.is_qms_admin())
  with check (qms.is_qms_admin());

-- Also: any user can SELECT their own assignments (for client-side capability checks)
create policy role_assignments_self_select on qms.role_assignments
  for select to authenticated using (auth_user_id = auth.uid());

-- ============================================================================
-- config + policy_versions: qms_admin write, qms_staff and qms_auditor read
-- ============================================================================
create policy config_select on qms.config
  for select to authenticated using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy config_write on qms.config
  for all to authenticated using (qms.is_qms_admin()) with check (qms.is_qms_admin());

create policy policy_versions_select on qms.policy_versions
  for select to authenticated using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy policy_versions_write on qms.policy_versions
  for all to authenticated using (qms.is_qms_admin()) with check (qms.is_qms_admin());

-- ============================================================================
-- role_qualifications: vendor_manager + admin write, project_manager + auditor read,
--                      vendors read their own
-- ============================================================================
create policy rq_select_staff on qms.role_qualifications
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy rq_select_self on qms.role_qualifications
  for select to authenticated
  using (vendor_id = qms.current_vendor_id());
create policy rq_write_authority on qms.role_qualifications
  for all to authenticated
  using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

-- ============================================================================
-- competence_evidence
-- ============================================================================
create policy ce_select_staff on qms.competence_evidence
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy ce_select_self on qms.competence_evidence
  for select to authenticated
  using (vendor_id = qms.current_vendor_id());
create policy ce_insert_self on qms.competence_evidence
  for insert to authenticated
  with check (vendor_id = qms.current_vendor_id() and verified = false);
create policy ce_write_authority on qms.competence_evidence
  for all to authenticated
  using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

-- ============================================================================
-- Sub-qualifications (subject, mode, language pair) — gated by parent role_qual
-- ============================================================================
create policy smq_select_staff on qms.subject_matter_qualifications
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy smq_select_self on qms.subject_matter_qualifications
  for select to authenticated
  using (exists (select 1 from qms.role_qualifications rq
                 where rq.id = role_qualification_id
                   and rq.vendor_id = qms.current_vendor_id()));
create policy smq_write_authority on qms.subject_matter_qualifications
  for all to authenticated
  using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

create policy imq_select_staff on qms.interpreter_mode_qualifications
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy imq_select_self on qms.interpreter_mode_qualifications
  for select to authenticated
  using (exists (select 1 from qms.role_qualifications rq
                 where rq.id = role_qualification_id
                   and rq.vendor_id = qms.current_vendor_id()));
create policy imq_write_authority on qms.interpreter_mode_qualifications
  for all to authenticated
  using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

create policy lpq_select_staff on qms.language_pair_qualifications
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy lpq_select_self on qms.language_pair_qualifications
  for select to authenticated
  using (exists (select 1 from qms.role_qualifications rq
                 where rq.id = role_qualification_id
                   and rq.vendor_id = qms.current_vendor_id()));
create policy lpq_write_authority on qms.language_pair_qualifications
  for all to authenticated
  using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

-- ============================================================================
-- professional_experience
-- ============================================================================
create policy pe_select_staff on qms.professional_experience
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy pe_select_self on qms.professional_experience
  for select to authenticated
  using (vendor_id = qms.current_vendor_id());
create policy pe_insert_self on qms.professional_experience
  for insert to authenticated
  with check (vendor_id = qms.current_vendor_id() and verified = false);
create policy pe_write_authority on qms.professional_experience
  for all to authenticated
  using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

-- ============================================================================
-- nda_agreements
-- ============================================================================
create policy nda_select_staff on qms.nda_agreements
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy nda_select_self on qms.nda_agreements
  for select to authenticated
  using (vendor_id = qms.current_vendor_id());
create policy nda_write_authority on qms.nda_agreements
  for all to authenticated
  using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

-- ============================================================================
-- qualification_audit_log: SELECT for staff/admin/auditor; INSERT for staff/admin
-- (UPDATE/DELETE were REVOKE'd in M3 and blocked by trigger)
-- ============================================================================
create policy audit_log_select_staff on qms.qualification_audit_log
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy audit_log_select_self on qms.qualification_audit_log
  for select to authenticated
  using (vendor_id = qms.current_vendor_id());
create policy audit_log_insert_staff on qms.qualification_audit_log
  for insert to authenticated
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

-- ============================================================================
-- performance_events
-- ============================================================================
create policy perf_select_staff on qms.performance_events
  for select to authenticated
  using (qms.is_qms_staff() or qms.has_qms_role('qms_auditor'));
create policy perf_write_authority on qms.performance_events
  for all to authenticated
  using (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'))
  with check (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager'));

-- ============================================================================
-- Storage bucket policies for qms-evidence
-- ============================================================================
-- staff full read/write
create policy "qms_evidence_staff_full" on storage.objects
  for all to authenticated
  using (bucket_id = 'qms-evidence' and (qms.is_qms_staff() or qms.has_qms_role('qms_auditor')))
  with check (bucket_id = 'qms-evidence' and (qms.is_qms_admin() or qms.has_qms_role('qms_vendor_manager')));

-- vendor self read/write within their own folder (path: {vendor_id}/...)
create policy "qms_evidence_vendor_self_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'qms-evidence'
         and qms.current_vendor_id() is not null
         and (storage.foldername(name))[1] = qms.current_vendor_id()::text);

create policy "qms_evidence_vendor_self_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'qms-evidence'
              and qms.current_vendor_id() is not null
              and (storage.foldername(name))[1] = qms.current_vendor_id()::text);
