-- CVP Guides
-- Purpose: Vendor-facing "Guides" library — embeddable how-to guides
--   (Guidde / YouTube iframes) and/or uploaded reference documents. Managed by
--   staff from the admin panel (/admin/guides via cvp-manage-guides), shown to
--   vendors at /guides (via vendor-list-guides). Distinct from the file-only
--   portal_documents library (CETHOS-portal shared table).
-- Dependencies: staff_users (shared CETHOS portal table)
-- Date: 2026-06-30

-- ==========================================
-- cvp_guides
-- ==========================================
CREATE TABLE IF NOT EXISTS cvp_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  description text,
  -- Embeddable player URL (Guidde playbook, YouTube, Loom, …). The admin
  -- supplies the iframe `src`; the vendor page renders it in a sandboxed iframe.
  embed_url text,
  -- OR an uploaded reference file in the private `cvp-guides` bucket.
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT TRUE,
  is_archived boolean NOT NULL DEFAULT FALSE,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A guide must carry content: an embed, a file, or both.
  CONSTRAINT cvp_guides_has_content CHECK (embed_url IS NOT NULL OR file_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cvp_guides_published
  ON cvp_guides (is_published) WHERE is_published = TRUE AND is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_cvp_guides_category ON cvp_guides (category);

COMMENT ON TABLE cvp_guides IS 'Vendor-facing guides: embeddable how-to videos (Guidde/YouTube) and/or uploaded docs. Managed by staff, shown at vendor /guides.';
COMMENT ON COLUMN cvp_guides.embed_url IS 'iframe src for an embedded player (Guidde playbook, YouTube, etc.). Optional if a file is uploaded.';
COMMENT ON COLUMN cvp_guides.file_path IS 'Storage path in the private cvp-guides bucket. Optional if embed_url is set.';

-- ==========================================
-- updated_at trigger
-- ==========================================
CREATE OR REPLACE FUNCTION cvp_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cvp_guides_updated_at ON cvp_guides;
CREATE TRIGGER trg_cvp_guides_updated_at
  BEFORE UPDATE ON cvp_guides
  FOR EACH ROW EXECUTE FUNCTION cvp_set_updated_at();

-- ==========================================
-- RLS — vendors never touch this table directly; vendor-list-guides reads it
-- with the service role. Only active staff admins may manage rows from an
-- authenticated session (defense in depth; service_role bypasses RLS).
-- ==========================================
ALTER TABLE cvp_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage guides" ON cvp_guides;
CREATE POLICY "Admins manage guides"
  ON cvp_guides FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff_users
    WHERE auth_user_id = auth.uid() AND is_active = TRUE AND role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff_users
    WHERE auth_user_id = auth.uid() AND is_active = TRUE AND role IN ('admin', 'super_admin')
  ));

-- ==========================================
-- Private storage bucket for uploaded guide files. Access is brokered through
-- the service-role edge functions only (no anon/authenticated storage policies).
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvp-guides', 'cvp-guides', FALSE)
ON CONFLICT (id) DO NOTHING;
