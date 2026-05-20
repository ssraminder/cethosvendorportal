-- vendors.cvp_translator_id — direct link back to the recruitment
-- artifact so the admin vendor profile can find "the application this
-- vendor came from" without round-tripping via email. Email join was
-- the only previous path and would break if a vendor ever rotated their
-- address. ON DELETE SET NULL keeps the vendor row alive if the
-- cvp_translators row is wiped.
--
-- Already applied to prod via apply_migration on 2026-05-20.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS cvp_translator_id uuid
    REFERENCES cvp_translators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_cvp_translator_id
  ON vendors (cvp_translator_id);

-- Backfill: match by lower(email). Only sets vendors with no link yet,
-- so re-running is safe.
UPDATE vendors v
SET cvp_translator_id = t.id
FROM cvp_translators t
WHERE LOWER(v.email) = LOWER(t.email)
  AND v.cvp_translator_id IS NULL;
