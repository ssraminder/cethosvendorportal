-- =====================================================================
-- Audit finding H-12: 31 public schema views were created with
-- SECURITY DEFINER (the implicit Postgres default through PG14, and
-- the explicit default for many older Supabase-generated views).
-- Definer views bypass the caller's RLS — they run with the view
-- owner's (postgres') privileges, so anon-callable views could read
-- rows the caller would otherwise be denied.
--
-- Postgres 15+ supports `security_invoker = true` on views: the view
-- runs with the CALLER's privileges + RLS. After v6's RLS lockdown
-- on the underlying tables, switching these views to invoker means
-- anon queries return nothing on staff-only views, and continue to
-- work on truly-public views (lookup data with anon SELECT policies).
--
-- This migration flips all 31 affected views. If a view turns out
-- to be legitimately reached by anon-context callers that need
-- DEFINER semantics, the fix is to add explicit anon-SELECT policies
-- on the underlying tables — not to revert.
--
-- Caveat: this exposed a pre-existing leak in the `quotes_select_own`
-- and `quote_files_select` RLS policies (their qual `OR
-- recovery_token IS NOT NULL` lets anon read every row with a non-
-- null recovery_token). v_quote_summary still leaks for that reason.
-- Tracked separately as audit finding C-4 — not blocked on this
-- migration.
-- =====================================================================

ALTER VIEW public.api_usage_summary                       SET (security_invoker = true);
ALTER VIEW public.cethosweb_blog_posts_public             SET (security_invoker = true);
ALTER VIEW public.cethosweb_site_settings_by_category     SET (security_invoker = true);
ALTER VIEW public.customer_ar_aging                       SET (security_invoker = true);
ALTER VIEW public.daily_audit_trends                      SET (security_invoker = true);
ALTER VIEW public.latest_marketing_actions                SET (security_invoker = true);
ALTER VIEW public.seo_country_trends                      SET (security_invoker = true);
ALTER VIEW public.seo_keyword_changes                     SET (security_invoker = true);
ALTER VIEW public.v_active_quotes                         SET (security_invoker = true);
ALTER VIEW public.v_active_tax_rates                      SET (security_invoker = true);
ALTER VIEW public.v_ai_accuracy_summary                   SET (security_invoker = true);
ALTER VIEW public.v_ai_knowledge_base                     SET (security_invoker = true);
ALTER VIEW public.v_ar_aging                              SET (security_invoker = true);
ALTER VIEW public.v_ar_summary                            SET (security_invoker = true);
ALTER VIEW public.v_branding_settings                     SET (security_invoker = true);
ALTER VIEW public.v_cvp_tms_migration_status              SET (security_invoker = true);
ALTER VIEW public.v_delivery_options_grouped              SET (security_invoker = true);
ALTER VIEW public.v_document_groups_with_items            SET (security_invoker = true);
ALTER VIEW public.v_hitl_queue                            SET (security_invoker = true);
ALTER VIEW public.v_hitl_review_detail                    SET (security_invoker = true);
ALTER VIEW public.v_hitl_review_documents                 SET (security_invoker = true);
ALTER VIEW public.v_languages_with_tiers                  SET (security_invoker = true);
ALTER VIEW public.v_pending_recommendations               SET (security_invoker = true);
ALTER VIEW public.v_project_payables                      SET (security_invoker = true);
ALTER VIEW public.v_quote_document_groups                 SET (security_invoker = true);
ALTER VIEW public.v_quote_summary                         SET (security_invoker = true);
ALTER VIEW public.v_staff_workload                        SET (security_invoker = true);
ALTER VIEW public.v_thresholds_with_history               SET (security_invoker = true);
ALTER VIEW public.v_unassigned_quote_items                SET (security_invoker = true);
ALTER VIEW public.v_unreviewed_learning_patterns          SET (security_invoker = true);
ALTER VIEW public.v_website_embed_analytics               SET (security_invoker = true);
