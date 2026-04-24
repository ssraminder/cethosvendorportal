-- Safe-mode config + extended decision action types
-- Purpose: while the pipeline is young (first 30 days / 200 applications), no
-- decisive vendor-facing email goes out without explicit staff approval. This
-- migration adds the config store that gates that behaviour plus the new
-- decision-action enum values used when staff approves/denies each outbound.
-- Date: 2026-04-24

-- ============================================================
-- cvp_system_config — generic key/value for pipeline-wide switches
-- ============================================================
CREATE TABLE IF NOT EXISTS cvp_system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL
);

COMMENT ON TABLE cvp_system_config IS
  'Pipeline-wide configuration toggles. Reads go through helpers in supabase/functions/_shared/.';

ALTER TABLE cvp_system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read system config"
  ON cvp_system_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Admins can update system config"
  ON cvp_system_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE auth_user_id = auth.uid()
        AND is_active = TRUE
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert system config"
  ON cvp_system_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE auth_user_id = auth.uid()
        AND is_active = TRUE
        AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- Seed safe-mode config
-- ============================================================
-- safe_mode lifts automatically once EITHER condition is met:
--   * (now - started_at) >= target_days days
--   * count(cvp_applications with status = 'approved') >= target_apps
-- Admins may also flip `manual_override` to 'on' or 'off' to force state.
INSERT INTO cvp_system_config (key, value, description)
VALUES (
  'safe_mode',
  jsonb_build_object(
    'manual_override', null,           -- 'on' | 'off' | null (auto)
    'started_at', now()::text,
    'target_days', 30,
    'target_apps', 200
  ),
  'Gate automated vendor-facing emails + auto-status-advances until either target is met. Staff must explicitly approve each decisive outbound while active.'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Extend cvp_application_decisions.action to include prescreen approvals
-- ============================================================
ALTER TABLE cvp_application_decisions
  DROP CONSTRAINT IF EXISTS cvp_application_decisions_action_check;

ALTER TABLE cvp_application_decisions
  ADD CONSTRAINT cvp_application_decisions_action_check
  CHECK (action IN (
    'approved',
    'rejected',
    'waitlisted',
    'info_requested',
    -- New safe-mode staff-approval actions:
    'prescreen_advanced',       -- staff approved V2 (passed prescreen) send
    'prescreen_manual_review',  -- staff approved V8 (under manual review) send
    'prescreen_silent'          -- staff chose to advance status without any vendor email
  ));
