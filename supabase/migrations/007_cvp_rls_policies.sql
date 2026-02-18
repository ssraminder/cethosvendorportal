-- CVP RLS Policies
-- Purpose: Row-Level Security for all CVP tables
-- Dependencies: All CVP tables, staff_users (shared)
-- Date: 2026-02-18

-- Enable RLS on all CVP tables
ALTER TABLE cvp_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_test_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_test_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_translators ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_profile_nudges ENABLE ROW LEVEL SECURITY;

-- === Public access (anon) ===

-- Allow public to submit applications
CREATE POLICY "Public can submit applications"
  ON cvp_applications FOR INSERT
  TO anon
  WITH CHECK (true);

-- === Staff access (authenticated) ===

-- Staff can read all CVP tables
CREATE POLICY "Staff can read cvp_applications"
  ON cvp_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can update cvp_applications"
  ON cvp_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can read cvp_test_combinations"
  ON cvp_test_combinations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can update cvp_test_combinations"
  ON cvp_test_combinations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can read cvp_test_library"
  ON cvp_test_library FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can insert cvp_test_library"
  ON cvp_test_library FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can update cvp_test_library"
  ON cvp_test_library FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can read cvp_test_submissions"
  ON cvp_test_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can update cvp_test_submissions"
  ON cvp_test_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can read cvp_translators"
  ON cvp_translators FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
    OR auth_user_id = auth.uid()
  );

CREATE POLICY "Staff can update cvp_translators"
  ON cvp_translators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

-- Translators can update their own profile
CREATE POLICY "Translators update own profile"
  ON cvp_translators FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Staff can read cvp_profile_nudges"
  ON cvp_profile_nudges FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can insert cvp_profile_nudges"
  ON cvp_profile_nudges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Staff can update cvp_profile_nudges"
  ON cvp_profile_nudges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = TRUE)
  );
