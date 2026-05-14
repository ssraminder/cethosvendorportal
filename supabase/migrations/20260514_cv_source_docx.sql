-- ============================================================================
-- 20260514_cv_source_docx.sql
--
-- When a vendor uploads a CV as a .docx, the portal converts it to PDF in
-- the browser before sending. Keep the source .docx around too:
--   1. ISO 17100 evidence integrity prefers the source artifact.
--   2. If we ever improve the converter, we can regenerate the PDF.
--   3. Staff has a fallback if the converted PDF loses formatting.
-- ============================================================================

ALTER TABLE vendor_cvs
  ADD COLUMN IF NOT EXISTS source_docx_storage_path     TEXT,
  ADD COLUMN IF NOT EXISTS source_docx_file_size_bytes  BIGINT,
  ADD COLUMN IF NOT EXISTS source_docx_original_name    TEXT;

COMMENT ON COLUMN vendor_cvs.source_docx_storage_path IS
  'Path in vendor-cvs bucket to the original .docx (if vendor uploaded a Word doc that we converted to PDF for the primary file_storage_path).';
