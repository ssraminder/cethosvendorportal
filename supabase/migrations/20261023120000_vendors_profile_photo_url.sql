-- Profile photo lost for vendors without a cvp_translators row.
--
-- vendor-upload-photo wrote the public URL only to
-- cvp_translators.profile_photo_url (matched by email). Vendors onboarded
-- directly (no cvp_translators row) matched 0 rows, so the upload "succeeded"
-- but the photo vanished on reload. vendors.profile_photo_url is now the
-- durable, vendor-id-keyed copy; get-profile reads
-- COALESCE(cvp_translators.profile_photo_url, vendors.profile_photo_url).

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS profile_photo_url text;

COMMENT ON COLUMN public.vendors.profile_photo_url IS
  'Public URL of the vendor profile photo in the vendor-profile-photos bucket (set by vendor-upload-photo).';

-- Backfill from storage: path is <vendor_id>/profile.<ext> in the PUBLIC
-- vendor-profile-photos bucket. Build the URL exactly as vendor-upload-photo
-- does: <SUPABASE_URL>/storage/v1/object/public/<bucket>/<path>?v=<epoch ms>.
-- When a vendor has several extensions on file, the most recently written
-- object wins (it is the one the upload function last pointed at).
WITH latest AS (
  SELECT DISTINCT ON (split_part(o.name, '/', 1))
         split_part(o.name, '/', 1) AS vendor_id_text,
         o.name,
         COALESCE(o.updated_at, o.created_at) AS written_at
  FROM storage.objects o
  WHERE o.bucket_id = 'vendor-profile-photos'
    AND o.name ~ '^[0-9a-f-]{36}/profile\.(jpg|png|webp)$'
  ORDER BY split_part(o.name, '/', 1), COALESCE(o.updated_at, o.created_at) DESC
)
UPDATE public.vendors v
SET profile_photo_url =
      'https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/vendor-profile-photos/'
      || l.name
      || '?v=' || (floor(extract(epoch FROM l.written_at) * 1000))::bigint::text
FROM latest l
WHERE v.id::text = l.vendor_id_text
  AND v.profile_photo_url IS NULL;
