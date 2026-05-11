-- QMS Evidence Storage Bucket
-- Purpose: Private bucket for competence evidence files (degrees, certifications, NDAs).
--          Signed URLs issued on demand by qms-evidence-fetch edge function after RLS check.
-- Path convention:
--   qms-evidence/{vendor_id}/evidence/{evidence_id}-{slug}.{ext}
--   qms-evidence/{vendor_id}/nda/{nda_id}-{slug}.pdf
-- Source spec: D:\cethos-vendor\Documents\claude-code-prompt-cethos-qms-phase-1.md §7.8
-- Date: 2026-05-11

INSERT INTO storage.buckets (id, name, public)
VALUES ('qms-evidence', 'qms-evidence', FALSE)
ON CONFLICT (id) DO NOTHING;

-- No public SELECT/INSERT/UPDATE/DELETE policies on the storage object table for
-- the qms-evidence bucket. All access flows through the qms-evidence-fetch edge
-- function (service_role) which checks the caller's qms role before issuing a
-- signed URL.
