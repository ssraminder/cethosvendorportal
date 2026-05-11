-- ============================================================================
-- QMS Phase 1 / Hotfix
-- Set explicit search_path on all qms.* functions to satisfy
-- 0011 function_search_path_mutable (Supabase security advisor).
-- ============================================================================

alter function qms.audit_log_no_mutate() set search_path = qms, public;
alter function qms.touch_updated_at() set search_path = qms, public;
alter function qms.log_role_qualification_change() set search_path = qms, public;
alter function qms.log_evidence_change() set search_path = qms, public;
alter function qms.log_nda_change() set search_path = qms, public;
alter function qms.enforce_qualification_preconditions() set search_path = qms, public;
alter function qms.resolve_language(text) set search_path = qms, public;
