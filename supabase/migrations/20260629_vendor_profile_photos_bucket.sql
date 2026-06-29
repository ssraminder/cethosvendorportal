-- Vendor profile photos bucket.
--
-- Re-adds vendor profile-photo support (bug reports 482f3dfa / c9bd65a5:
-- "no option to upload profile picture"). Photos are small, non-sensitive,
-- and shown in the vendor's own profile header, so a PUBLIC bucket is fine —
-- the stored cvp_translators.profile_photo_url is a plain public URL.
--
-- Writes are performed by the vendor-upload-photo edge function using the
-- service-role key (bypasses RLS); public read is implicit for public buckets,
-- so no extra storage.objects policies are required.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-profile-photos',
  'vendor-profile-photos',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
