-- Document-upload outage fix (2026-06-20): vendor-upload-certification threw a
-- generic 500 ("Internal server error") for every vendor whose
-- vendors.certifications was a legacy empty object {} instead of an array,
-- because `certs.push(...)` fails on a non-array (the `|| []` guard doesn't
-- catch a truthy {}). The function now coerces non-arrays to [] (Array.isArray);
-- this migration normalizes the 357 existing rows (verified: 0 held data) and
-- pins the column default so new rows are always arrays.
UPDATE vendors
SET certifications = '[]'::jsonb
WHERE jsonb_typeof(certifications) IS DISTINCT FROM 'array';

ALTER TABLE vendors ALTER COLUMN certifications SET DEFAULT '[]'::jsonb;
