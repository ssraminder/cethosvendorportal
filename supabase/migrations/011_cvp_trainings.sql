-- CVP Trainings
-- Purpose: Generic staff training module engine (trainings, lessons, assignments, progress)
-- First training seeded: "Vendor Management" (see 012_seed_vendor_management_training.sql)
-- Dependencies: staff_users (shared CETHOS portal table)
-- Date: 2026-04-22

-- ==========================================
-- cvp_trainings
-- ==========================================
CREATE TABLE IF NOT EXISTS cvp_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cvp_trainings_active ON cvp_trainings (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cvp_trainings_category ON cvp_trainings (category);

COMMENT ON TABLE cvp_trainings IS 'Staff training modules (generic engine). First training: vendor-management.';

-- ==========================================
-- cvp_training_lessons
-- ==========================================
CREATE TABLE IF NOT EXISTS cvp_training_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES cvp_trainings(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  body_markdown text NOT NULL,
  screenshot_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  key_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  route_reference text,
  estimated_minutes int NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_id, slug),
  UNIQUE (training_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_cvp_training_lessons_training ON cvp_training_lessons (training_id, order_index);

COMMENT ON COLUMN cvp_training_lessons.key_rules IS 'JSONB array of {rule, reason} objects surfaced as callouts in the lesson UI.';
COMMENT ON COLUMN cvp_training_lessons.route_reference IS 'Admin-portal route a learner can click to "try it yourself" (e.g. /admin/recruitment).';

-- ==========================================
-- cvp_training_assignments
-- ==========================================
CREATE TABLE IF NOT EXISTS cvp_training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES cvp_trainings(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (training_id, staff_user_id)
);

CREATE INDEX IF NOT EXISTS idx_cvp_training_assignments_staff ON cvp_training_assignments (staff_user_id);
CREATE INDEX IF NOT EXISTS idx_cvp_training_assignments_training ON cvp_training_assignments (training_id);
CREATE INDEX IF NOT EXISTS idx_cvp_training_assignments_incomplete ON cvp_training_assignments (staff_user_id) WHERE completed_at IS NULL;

-- ==========================================
-- cvp_training_lesson_progress
-- ==========================================
CREATE TABLE IF NOT EXISTS cvp_training_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES cvp_training_assignments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES cvp_training_lessons(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  UNIQUE (assignment_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_cvp_training_lesson_progress_assignment ON cvp_training_lesson_progress (assignment_id);

-- ==========================================
-- updated_at triggers
-- ==========================================
CREATE OR REPLACE FUNCTION cvp_training_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cvp_trainings_updated_at ON cvp_trainings;
CREATE TRIGGER trg_cvp_trainings_updated_at
  BEFORE UPDATE ON cvp_trainings
  FOR EACH ROW EXECUTE FUNCTION cvp_training_set_updated_at();

DROP TRIGGER IF EXISTS trg_cvp_training_lessons_updated_at ON cvp_training_lessons;
CREATE TRIGGER trg_cvp_training_lessons_updated_at
  BEFORE UPDATE ON cvp_training_lessons
  FOR EACH ROW EXECUTE FUNCTION cvp_training_set_updated_at();

-- ==========================================
-- RLS
-- ==========================================
ALTER TABLE cvp_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_training_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvp_training_lesson_progress ENABLE ROW LEVEL SECURITY;

-- Helper: is the current auth user an active admin/super_admin?
CREATE OR REPLACE FUNCTION cvp_is_training_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_users
    WHERE auth_user_id = auth.uid()
      AND is_active = TRUE
      AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: any active staff user (for viewing trainings they're assigned to)
CREATE OR REPLACE FUNCTION cvp_is_active_staff() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_users
    WHERE auth_user_id = auth.uid() AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: staff_users.id for the current auth user
CREATE OR REPLACE FUNCTION cvp_current_staff_id() RETURNS uuid AS $$
  SELECT id FROM staff_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- === cvp_trainings ===
CREATE POLICY "Staff can read active trainings"
  ON cvp_trainings FOR SELECT
  TO authenticated
  USING (is_active = TRUE AND cvp_is_active_staff());

CREATE POLICY "Admins can manage trainings"
  ON cvp_trainings FOR ALL
  TO authenticated
  USING (cvp_is_training_admin())
  WITH CHECK (cvp_is_training_admin());

-- === cvp_training_lessons ===
CREATE POLICY "Staff can read lessons of visible trainings"
  ON cvp_training_lessons FOR SELECT
  TO authenticated
  USING (
    cvp_is_active_staff() AND
    EXISTS (SELECT 1 FROM cvp_trainings t WHERE t.id = training_id AND t.is_active = TRUE)
  );

CREATE POLICY "Admins can manage lessons"
  ON cvp_training_lessons FOR ALL
  TO authenticated
  USING (cvp_is_training_admin())
  WITH CHECK (cvp_is_training_admin());

-- === cvp_training_assignments ===
CREATE POLICY "Staff can read their own assignments"
  ON cvp_training_assignments FOR SELECT
  TO authenticated
  USING (
    cvp_is_training_admin() OR staff_user_id = cvp_current_staff_id()
  );

CREATE POLICY "Staff can update their own assignment progress"
  ON cvp_training_assignments FOR UPDATE
  TO authenticated
  USING (staff_user_id = cvp_current_staff_id() OR cvp_is_training_admin())
  WITH CHECK (staff_user_id = cvp_current_staff_id() OR cvp_is_training_admin());

CREATE POLICY "Admins can create assignments"
  ON cvp_training_assignments FOR INSERT
  TO authenticated
  WITH CHECK (cvp_is_training_admin());

CREATE POLICY "Admins can delete assignments"
  ON cvp_training_assignments FOR DELETE
  TO authenticated
  USING (cvp_is_training_admin());

-- === cvp_training_lesson_progress ===
CREATE POLICY "Staff can read their own progress"
  ON cvp_training_lesson_progress FOR SELECT
  TO authenticated
  USING (
    cvp_is_training_admin() OR
    EXISTS (
      SELECT 1 FROM cvp_training_assignments a
      WHERE a.id = assignment_id AND a.staff_user_id = cvp_current_staff_id()
    )
  );

CREATE POLICY "Staff can insert their own progress"
  ON cvp_training_lesson_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cvp_training_assignments a
      WHERE a.id = assignment_id AND a.staff_user_id = cvp_current_staff_id()
    )
  );

CREATE POLICY "Staff can update their own progress"
  ON cvp_training_lesson_progress FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cvp_training_assignments a
      WHERE a.id = assignment_id AND a.staff_user_id = cvp_current_staff_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cvp_training_assignments a
      WHERE a.id = assignment_id AND a.staff_user_id = cvp_current_staff_id()
    )
  );
