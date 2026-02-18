-- CVP Add Translator FK
-- Purpose: Add FK from cvp_applications.translator_id to cvp_translators (circular dependency resolved)
-- Dependencies: cvp_applications, cvp_translators
-- Date: 2026-02-18

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_cvp_applications_translator'
  ) THEN
    ALTER TABLE cvp_applications
      ADD CONSTRAINT fk_cvp_applications_translator
      FOREIGN KEY (translator_id) REFERENCES cvp_translators(id);
  END IF;
END $$;
