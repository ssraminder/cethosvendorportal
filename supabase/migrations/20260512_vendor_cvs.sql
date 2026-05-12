-- vendor_cvs: versioned CV history per vendor
--
-- Vendors can upload/replace their CV from the vendor portal. Admin
-- portal shows the full version history with download links. Each
-- upload bumps the version; only the latest row has is_current = true.
--
-- The recruitment-era CV (cvp_applications.cv_storage_path) is left
-- alone — admin can still surface it as the "first / recruitment CV"
-- separately. This table is for post-onboarding CV management.

CREATE TABLE IF NOT EXISTS public.vendor_cvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  version integer NOT NULL,
  file_storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint,
  content_type text,
  uploaded_by_vendor boolean NOT NULL DEFAULT true,
  uploaded_by_staff_id uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  notes text,
  is_current boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, version)
);

CREATE INDEX IF NOT EXISTS vendor_cvs_vendor_version_idx
  ON public.vendor_cvs (vendor_id, version DESC);

CREATE INDEX IF NOT EXISTS vendor_cvs_current_idx
  ON public.vendor_cvs (vendor_id) WHERE is_current = true;

-- Private bucket for vendor-uploaded CVs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-cvs', 'vendor-cvs', false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.vendor_cvs IS
  'Versioned CV history per vendor. Upload bumps version; only latest is_current = true. Read via edge functions, not direct RLS.';
