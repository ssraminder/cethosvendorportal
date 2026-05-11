-- QMS RLS, Role Assignments, Auditor Views, Performance Snapshot
-- Purpose: Layer access control + auditor-facing reads on top of the QMS foundation.
-- Source spec: D:\cethos-vendor\Documents\claude-code-prompt-cethos-qms-phase-1.md §7.7, §7.9
-- Dependencies: 20260511150000_qms_schema_foundation.sql
-- Date: 2026-05-11

-- ----------------------------------------------------------------------------
-- Postgres roles for QMS access tiers (briefing §7.7).
-- We add the role NAMES so policies can reference them; actual session-level
-- impersonation is provisioned via Supabase JWT custom claims at the auth layer.
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE ROLE qms_admin           NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE qms_vendor_manager  NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE qms_project_manager NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE qms_linguist        NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE qms_auditor         NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA qms TO qms_admin, qms_vendor_manager, qms_project_manager, qms_linguist, qms_auditor;

-- ----------------------------------------------------------------------------
-- Staff role assignment table — maps staff_users → qms role.
-- The existing public.staff_users table does not carry QMS role info, and the
-- briefing's RLS roles are not yet wired through Supabase JWT custom claims,
-- so application code uses this assignment table to gate writes.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qms.staff_role_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  qms_role      TEXT NOT NULL CHECK (qms_role IN (
    'qms_admin', 'qms_vendor_manager', 'qms_project_manager', 'qms_auditor'
  )),
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by    UUID REFERENCES public.staff_users(id),
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  notes         TEXT,
  UNIQUE (staff_user_id, qms_role)
);

CREATE INDEX IF NOT EXISTS idx_qms_staff_role_active
  ON qms.staff_role_assignments (staff_user_id, qms_role)
  WHERE revoked_at IS NULL;

-- ----------------------------------------------------------------------------
-- Helper functions for RLS policies
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION qms.current_staff_user_id() RETURNS UUID AS $$
  SELECT id FROM public.staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION qms.has_role(p_role TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM qms.staff_role_assignments a
    JOIN public.staff_users s ON s.id = a.staff_user_id
    WHERE s.auth_user_id = auth.uid()
      AND s.is_active = TRUE
      AND a.qms_role = p_role
      AND a.revoked_at IS NULL
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
  )
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION qms.is_qms_admin()         RETURNS BOOLEAN AS $$ SELECT qms.has_role('qms_admin') $$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION qms.is_vendor_manager()    RETURNS BOOLEAN AS $$ SELECT qms.has_role('qms_admin') OR qms.has_role('qms_vendor_manager') $$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION qms.is_project_manager()   RETURNS BOOLEAN AS $$ SELECT qms.has_role('qms_admin') OR qms.has_role('qms_vendor_manager') OR qms.has_role('qms_project_manager') $$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION qms.is_auditor()           RETURNS BOOLEAN AS $$ SELECT qms.has_role('qms_auditor') $$ LANGUAGE sql STABLE;

-- Linguist match: vendor.auth_user_id = the calling JWT
CREATE OR REPLACE FUNCTION qms.is_self_vendor(p_vendor_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.auth_user_id = auth.uid()
  )
$$ LANGUAGE sql STABLE;

-- ----------------------------------------------------------------------------
-- Enable RLS on every qms.* table
-- ----------------------------------------------------------------------------

ALTER TABLE qms.staff_role_assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.role_types                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.competence_bases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.subject_matters                ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.interpreter_modes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.evidence_types                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.role_qualifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.competence_evidence            ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.subject_matter_qualifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.interpreter_mode_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.language_pair_qualifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.nda_agreements                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.professional_experience        ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.performance_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE qms.qualification_audit_log        ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Lookup tables: world-readable for any authenticated session; admin-write only.
-- ----------------------------------------------------------------------------

CREATE POLICY "qms_lookup_role_types_read" ON qms.role_types
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "qms_lookup_role_types_admin_write" ON qms.role_types
  FOR ALL TO authenticated USING (qms.is_qms_admin()) WITH CHECK (qms.is_qms_admin());

CREATE POLICY "qms_lookup_competence_bases_read" ON qms.competence_bases
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "qms_lookup_competence_bases_admin_write" ON qms.competence_bases
  FOR ALL TO authenticated USING (qms.is_qms_admin()) WITH CHECK (qms.is_qms_admin());

CREATE POLICY "qms_lookup_subject_matters_read" ON qms.subject_matters
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "qms_lookup_subject_matters_admin_write" ON qms.subject_matters
  FOR ALL TO authenticated USING (qms.is_qms_admin()) WITH CHECK (qms.is_qms_admin());

CREATE POLICY "qms_lookup_interpreter_modes_read" ON qms.interpreter_modes
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "qms_lookup_interpreter_modes_admin_write" ON qms.interpreter_modes
  FOR ALL TO authenticated USING (qms.is_qms_admin()) WITH CHECK (qms.is_qms_admin());

CREATE POLICY "qms_lookup_evidence_types_read" ON qms.evidence_types
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "qms_lookup_evidence_types_admin_write" ON qms.evidence_types
  FOR ALL TO authenticated USING (qms.is_qms_admin()) WITH CHECK (qms.is_qms_admin());

-- ----------------------------------------------------------------------------
-- Staff role assignments — admin-only write; staff read own row.
-- ----------------------------------------------------------------------------

CREATE POLICY "qms_role_assignments_admin_all" ON qms.staff_role_assignments
  FOR ALL TO authenticated USING (qms.is_qms_admin()) WITH CHECK (qms.is_qms_admin());

CREATE POLICY "qms_role_assignments_self_read" ON qms.staff_role_assignments
  FOR SELECT TO authenticated USING (staff_user_id = qms.current_staff_user_id());

-- ----------------------------------------------------------------------------
-- role_qualifications — admin/vendor_manager write; PM read; linguist sees own; auditor read.
-- ----------------------------------------------------------------------------

CREATE POLICY "qms_role_qual_pm_read" ON qms.role_qualifications
  FOR SELECT TO authenticated USING (qms.is_project_manager());

CREATE POLICY "qms_role_qual_auditor_read" ON qms.role_qualifications
  FOR SELECT TO authenticated USING (qms.is_auditor());

CREATE POLICY "qms_role_qual_self_read" ON qms.role_qualifications
  FOR SELECT TO authenticated USING (qms.is_self_vendor(vendor_id));

CREATE POLICY "qms_role_qual_vm_insert" ON qms.role_qualifications
  FOR INSERT TO authenticated WITH CHECK (qms.is_vendor_manager());

CREATE POLICY "qms_role_qual_vm_update" ON qms.role_qualifications
  FOR UPDATE TO authenticated USING (qms.is_vendor_manager()) WITH CHECK (qms.is_vendor_manager());

-- No DELETE policy on role_qualifications — withdrawal is via status change.

-- ----------------------------------------------------------------------------
-- competence_evidence — admin/vendor_manager write; PM read (no internal_notes via view);
-- linguist sees own. NDA tables similarly gated.
-- ----------------------------------------------------------------------------

CREATE POLICY "qms_evidence_pm_read" ON qms.competence_evidence
  FOR SELECT TO authenticated USING (qms.is_project_manager());

CREATE POLICY "qms_evidence_auditor_read" ON qms.competence_evidence
  FOR SELECT TO authenticated USING (qms.is_auditor());

CREATE POLICY "qms_evidence_self_read" ON qms.competence_evidence
  FOR SELECT TO authenticated USING (qms.is_self_vendor(vendor_id));

CREATE POLICY "qms_evidence_vm_insert" ON qms.competence_evidence
  FOR INSERT TO authenticated WITH CHECK (qms.is_vendor_manager());

CREATE POLICY "qms_evidence_vm_update" ON qms.competence_evidence
  FOR UPDATE TO authenticated USING (qms.is_vendor_manager()) WITH CHECK (qms.is_vendor_manager());

CREATE POLICY "qms_smq_pm_read" ON qms.subject_matter_qualifications
  FOR SELECT TO authenticated USING (qms.is_project_manager());
CREATE POLICY "qms_smq_auditor_read" ON qms.subject_matter_qualifications
  FOR SELECT TO authenticated USING (qms.is_auditor());
CREATE POLICY "qms_smq_self_read" ON qms.subject_matter_qualifications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM qms.role_qualifications rq
            WHERE rq.id = role_qualification_id AND qms.is_self_vendor(rq.vendor_id))
  );
CREATE POLICY "qms_smq_vm_write" ON qms.subject_matter_qualifications
  FOR ALL TO authenticated USING (qms.is_vendor_manager()) WITH CHECK (qms.is_vendor_manager());

CREATE POLICY "qms_imq_pm_read" ON qms.interpreter_mode_qualifications
  FOR SELECT TO authenticated USING (qms.is_project_manager());
CREATE POLICY "qms_imq_auditor_read" ON qms.interpreter_mode_qualifications
  FOR SELECT TO authenticated USING (qms.is_auditor());
CREATE POLICY "qms_imq_self_read" ON qms.interpreter_mode_qualifications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM qms.role_qualifications rq
            WHERE rq.id = role_qualification_id AND qms.is_self_vendor(rq.vendor_id))
  );
CREATE POLICY "qms_imq_vm_write" ON qms.interpreter_mode_qualifications
  FOR ALL TO authenticated USING (qms.is_vendor_manager()) WITH CHECK (qms.is_vendor_manager());

CREATE POLICY "qms_lpq_pm_read" ON qms.language_pair_qualifications
  FOR SELECT TO authenticated USING (qms.is_project_manager());
CREATE POLICY "qms_lpq_auditor_read" ON qms.language_pair_qualifications
  FOR SELECT TO authenticated USING (qms.is_auditor());
CREATE POLICY "qms_lpq_self_read" ON qms.language_pair_qualifications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM qms.role_qualifications rq
            WHERE rq.id = role_qualification_id AND qms.is_self_vendor(rq.vendor_id))
  );
CREATE POLICY "qms_lpq_vm_write" ON qms.language_pair_qualifications
  FOR ALL TO authenticated USING (qms.is_vendor_manager()) WITH CHECK (qms.is_vendor_manager());

CREATE POLICY "qms_nda_vm_read" ON qms.nda_agreements
  FOR SELECT TO authenticated USING (qms.is_vendor_manager());
CREATE POLICY "qms_nda_auditor_read" ON qms.nda_agreements
  FOR SELECT TO authenticated USING (qms.is_auditor());
CREATE POLICY "qms_nda_pm_read_min" ON qms.nda_agreements
  FOR SELECT TO authenticated USING (qms.is_project_manager());
CREATE POLICY "qms_nda_self_read" ON qms.nda_agreements
  FOR SELECT TO authenticated USING (qms.is_self_vendor(vendor_id));
CREATE POLICY "qms_nda_vm_write" ON qms.nda_agreements
  FOR ALL TO authenticated USING (qms.is_vendor_manager()) WITH CHECK (qms.is_vendor_manager());

CREATE POLICY "qms_prof_exp_vm_read" ON qms.professional_experience
  FOR SELECT TO authenticated USING (qms.is_vendor_manager());
CREATE POLICY "qms_prof_exp_auditor_read" ON qms.professional_experience
  FOR SELECT TO authenticated USING (qms.is_auditor());
CREATE POLICY "qms_prof_exp_self_read" ON qms.professional_experience
  FOR SELECT TO authenticated USING (qms.is_self_vendor(vendor_id));
CREATE POLICY "qms_prof_exp_vm_write" ON qms.professional_experience
  FOR ALL TO authenticated USING (qms.is_vendor_manager()) WITH CHECK (qms.is_vendor_manager());

CREATE POLICY "qms_perf_events_vm_read" ON qms.performance_events
  FOR SELECT TO authenticated USING (qms.is_vendor_manager());
CREATE POLICY "qms_perf_events_auditor_read" ON qms.performance_events
  FOR SELECT TO authenticated USING (qms.is_auditor());
CREATE POLICY "qms_perf_events_vm_write" ON qms.performance_events
  FOR INSERT TO authenticated WITH CHECK (qms.is_vendor_manager());

-- ----------------------------------------------------------------------------
-- Audit log — INSERT only for admin/vendor_manager. SELECT for all four staff
-- roles plus auditor. NO UPDATE or DELETE for anyone (already REVOKE'd at the
-- privilege level, but enforced again at the policy level for defence-in-depth).
-- ----------------------------------------------------------------------------

CREATE POLICY "qms_audit_log_read" ON qms.qualification_audit_log
  FOR SELECT TO authenticated USING (
    qms.is_project_manager() OR qms.is_auditor()
  );

CREATE POLICY "qms_audit_log_self_read" ON qms.qualification_audit_log
  FOR SELECT TO authenticated USING (qms.is_self_vendor(vendor_id));

CREATE POLICY "qms_audit_log_vm_insert" ON qms.qualification_audit_log
  FOR INSERT TO authenticated WITH CHECK (qms.is_vendor_manager());

-- No UPDATE or DELETE policies. REVOKE in foundation migration blocks them at
-- the privilege level; absence of policy blocks them at the RLS level.

-- ----------------------------------------------------------------------------
-- Hide internal_notes from non-admin via views (briefing §7.7 column-level grants).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW qms.v_role_qualifications_public AS
SELECT
  id, vendor_id, role_type_id, competence_basis_id, status,
  qualified_at, qualified_by, last_re_qualified_at, re_qualification_due,
  competence_basis_notes, suspended_at, suspension_reason,
  withdrawn_at, withdrawal_reason,
  created_at, updated_at
FROM qms.role_qualifications;

CREATE OR REPLACE VIEW qms.v_competence_evidence_public AS
SELECT
  id, vendor_id, role_qualification_id, evidence_type_id, title,
  issuing_organization, issuing_country_code, issued_date, expiry_date,
  storage_path, file_name, file_mime, file_size_bytes, sha256,
  verified, verified_by, verified_at, verification_method, verification_notes,
  superseded_by, source_cvp_application_id, source_cvp_test_submission_id,
  created_at, updated_at
FROM qms.competence_evidence;

CREATE OR REPLACE VIEW qms.v_nda_agreements_public AS
SELECT
  id, vendor_id, template_version, signed_date, effective_date, expiry_date,
  status, signed_method, signed_via, storage_path,
  countersigned, countersigned_by, countersigned_date, superseded_by,
  revoked_at, revoke_reason,
  created_at, updated_at
FROM qms.nda_agreements;

-- ----------------------------------------------------------------------------
-- Auditor-facing decisive query (briefing §7.9) — qualified translators by
-- language pair and subject matter, with active NDA.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW qms.v_qualified_translators_by_pair_and_subject AS
SELECT
  v.id              AS vendor_id,
  v.full_name,
  v.email,
  v.country,
  rq.id             AS role_qualification_id,
  rq.qualified_at,
  rq.re_qualification_due,
  cb.code           AS competence_basis_code,
  cb.iso_clause     AS competence_basis_iso_clause,
  src.id            AS source_language_id,
  src.code          AS source_language_code,
  tgt.id            AS target_language_id,
  tgt.code          AS target_language_code,
  sm.id             AS subject_matter_id,
  sm.code           AS subject_matter_code,
  sm.name           AS subject_matter_name,
  parent_sm.code    AS subject_matter_parent_code,
  nda.id            AS active_nda_id,
  nda.signed_date   AS nda_signed_date,
  nda.expiry_date   AS nda_expiry_date
FROM public.vendors v
JOIN qms.role_qualifications rq                 ON rq.vendor_id = v.id
JOIN qms.role_types rt                          ON rt.id = rq.role_type_id AND rt.code = 'translator'
JOIN qms.competence_bases cb                    ON cb.id = rq.competence_basis_id
JOIN qms.language_pair_qualifications lpq       ON lpq.role_qualification_id = rq.id
JOIN public.languages src                       ON src.id = lpq.source_language_id
JOIN public.languages tgt                       ON tgt.id = lpq.target_language_id
JOIN qms.subject_matter_qualifications smq      ON smq.role_qualification_id = rq.id
JOIN qms.subject_matters sm                     ON sm.id = smq.subject_matter_id
LEFT JOIN qms.subject_matters parent_sm         ON parent_sm.id = sm.parent_id
JOIN qms.nda_agreements nda
  ON nda.vendor_id = v.id
 AND nda.status = 'active'
 AND (nda.expiry_date IS NULL OR nda.expiry_date > NOW())
WHERE rq.status = 'qualified';

CREATE OR REPLACE VIEW qms.v_qualified_revisers_by_pair_and_subject AS
SELECT
  v.id AS vendor_id, v.full_name, v.email, v.country,
  rq.id AS role_qualification_id, rq.qualified_at, rq.re_qualification_due,
  cb.code AS competence_basis_code, cb.iso_clause AS competence_basis_iso_clause,
  src.id AS source_language_id, src.code AS source_language_code,
  tgt.id AS target_language_id, tgt.code AS target_language_code,
  sm.id AS subject_matter_id, sm.code AS subject_matter_code, sm.name AS subject_matter_name,
  parent_sm.code AS subject_matter_parent_code,
  nda.id AS active_nda_id, nda.signed_date AS nda_signed_date, nda.expiry_date AS nda_expiry_date
FROM public.vendors v
JOIN qms.role_qualifications rq            ON rq.vendor_id = v.id
JOIN qms.role_types rt                     ON rt.id = rq.role_type_id AND rt.code = 'reviser'
JOIN qms.competence_bases cb               ON cb.id = rq.competence_basis_id
JOIN qms.language_pair_qualifications lpq  ON lpq.role_qualification_id = rq.id
JOIN public.languages src                  ON src.id = lpq.source_language_id
JOIN public.languages tgt                  ON tgt.id = lpq.target_language_id
JOIN qms.subject_matter_qualifications smq ON smq.role_qualification_id = rq.id
JOIN qms.subject_matters sm                ON sm.id = smq.subject_matter_id
LEFT JOIN qms.subject_matters parent_sm    ON parent_sm.id = sm.parent_id
JOIN qms.nda_agreements nda
  ON nda.vendor_id = v.id
 AND nda.status = 'active'
 AND (nda.expiry_date IS NULL OR nda.expiry_date > NOW())
WHERE rq.status = 'qualified';

CREATE OR REPLACE VIEW qms.v_qualified_post_editors_by_pair_and_subject AS
SELECT
  v.id AS vendor_id, v.full_name, v.email, v.country,
  rq.id AS role_qualification_id, rq.qualified_at, rq.re_qualification_due,
  cb.code AS competence_basis_code, cb.iso_clause AS competence_basis_iso_clause,
  src.id AS source_language_id, src.code AS source_language_code,
  tgt.id AS target_language_id, tgt.code AS target_language_code,
  sm.id AS subject_matter_id, sm.code AS subject_matter_code, sm.name AS subject_matter_name,
  parent_sm.code AS subject_matter_parent_code,
  nda.id AS active_nda_id, nda.signed_date AS nda_signed_date, nda.expiry_date AS nda_expiry_date
FROM public.vendors v
JOIN qms.role_qualifications rq            ON rq.vendor_id = v.id
JOIN qms.role_types rt                     ON rt.id = rq.role_type_id AND rt.code = 'post_editor'
JOIN qms.competence_bases cb               ON cb.id = rq.competence_basis_id
JOIN qms.language_pair_qualifications lpq  ON lpq.role_qualification_id = rq.id
JOIN public.languages src                  ON src.id = lpq.source_language_id
JOIN public.languages tgt                  ON tgt.id = lpq.target_language_id
JOIN qms.subject_matter_qualifications smq ON smq.role_qualification_id = rq.id
JOIN qms.subject_matters sm                ON sm.id = smq.subject_matter_id
LEFT JOIN qms.subject_matters parent_sm    ON parent_sm.id = sm.parent_id
JOIN qms.nda_agreements nda
  ON nda.vendor_id = v.id
 AND nda.status = 'active'
 AND (nda.expiry_date IS NULL OR nda.expiry_date > NOW())
WHERE rq.status = 'qualified';

CREATE OR REPLACE VIEW qms.v_qualified_interpreters_by_mode_and_domain AS
SELECT
  v.id AS vendor_id, v.full_name, v.email, v.country,
  rq.id AS role_qualification_id, rq.qualified_at, rq.re_qualification_due,
  cb.code AS competence_basis_code, cb.iso_clause AS competence_basis_iso_clause,
  im.id AS mode_id, im.code AS mode_code, im.display_name AS mode_display_name,
  sm.id AS subject_matter_id, sm.code AS subject_matter_code, sm.name AS subject_matter_name,
  parent_sm.code AS subject_matter_parent_code,
  nda.id AS active_nda_id, nda.signed_date AS nda_signed_date, nda.expiry_date AS nda_expiry_date
FROM public.vendors v
JOIN qms.role_qualifications rq             ON rq.vendor_id = v.id
JOIN qms.role_types rt                      ON rt.id = rq.role_type_id AND rt.code = 'interpreter'
JOIN qms.competence_bases cb                ON cb.id = rq.competence_basis_id
JOIN qms.interpreter_mode_qualifications imq ON imq.role_qualification_id = rq.id
JOIN qms.interpreter_modes im               ON im.id = imq.mode_id
JOIN qms.subject_matter_qualifications smq  ON smq.role_qualification_id = rq.id
JOIN qms.subject_matters sm                 ON sm.id = smq.subject_matter_id
LEFT JOIN qms.subject_matters parent_sm     ON parent_sm.id = sm.parent_id
JOIN qms.nda_agreements nda
  ON nda.vendor_id = v.id
 AND nda.status = 'active'
 AND (nda.expiry_date IS NULL OR nda.expiry_date > NOW())
WHERE rq.status = 'qualified';

-- ----------------------------------------------------------------------------
-- Performance snapshot — daily-refreshed materialized view per linguist × role.
-- ----------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS qms.linguist_performance_snapshot AS
SELECT
  rq.id                                                                              AS role_qualification_id,
  rq.vendor_id,
  rq.role_type_id,
  COUNT(*) FILTER (WHERE pe.event_type = 'project_completed')                        AS projects_completed,
  COUNT(*) FILTER (WHERE pe.event_type = 'revision_finding')                         AS revision_findings,
  COUNT(*) FILTER (WHERE pe.event_type = 'client_complaint')                         AS client_complaints,
  COUNT(*) FILTER (WHERE pe.event_type = 'client_compliment')                        AS client_compliments,
  COUNT(*) FILTER (WHERE pe.event_type = 'late_delivery')                            AS late_deliveries,
  COUNT(*) FILTER (WHERE pe.event_type = 'quality_issue')                            AS quality_issues,
  COUNT(*) FILTER (WHERE pe.event_type = 'capa_action_opened')                       AS capa_actions_opened,
  COUNT(*) FILTER (WHERE pe.event_type = 'capa_action_closed')                       AS capa_actions_closed,
  COUNT(*) FILTER (WHERE pe.severity IN ('high', 'critical'))                        AS high_severity_events,
  MAX(pe.recorded_at)                                                                AS last_event_at,
  NOW()                                                                              AS snapshot_at
FROM qms.role_qualifications rq
LEFT JOIN qms.performance_events pe ON pe.role_qualification_id = rq.id
GROUP BY rq.id, rq.vendor_id, rq.role_type_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_qms_perf_snapshot_role_qual
  ON qms.linguist_performance_snapshot (role_qualification_id);

CREATE INDEX IF NOT EXISTS idx_qms_perf_snapshot_vendor
  ON qms.linguist_performance_snapshot (vendor_id);

-- Refresh function (called by cron or after bulk event ingest)
CREATE OR REPLACE FUNCTION qms.refresh_linguist_performance_snapshot() RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY qms.linguist_performance_snapshot;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Grant SELECT on the auditor-facing views to all internal roles.
-- ----------------------------------------------------------------------------

GRANT SELECT ON qms.v_qualified_translators_by_pair_and_subject     TO authenticated;
GRANT SELECT ON qms.v_qualified_revisers_by_pair_and_subject        TO authenticated;
GRANT SELECT ON qms.v_qualified_post_editors_by_pair_and_subject    TO authenticated;
GRANT SELECT ON qms.v_qualified_interpreters_by_mode_and_domain     TO authenticated;
GRANT SELECT ON qms.linguist_performance_snapshot                   TO authenticated;
GRANT SELECT ON qms.v_role_qualifications_public                    TO authenticated;
GRANT SELECT ON qms.v_competence_evidence_public                    TO authenticated;
GRANT SELECT ON qms.v_nda_agreements_public                         TO authenticated;
