-- Add draft status and vendor-submitted fields to cvp_payments

-- 1. Widen status constraint to include 'draft'
ALTER TABLE cvp_payments DROP CONSTRAINT IF EXISTS cvp_payments_status_check;
ALTER TABLE cvp_payments ADD CONSTRAINT cvp_payments_status_check
  CHECK (status IN ('draft','pending','submitted','approved','paid','cancelled'));

-- 2. Default new rows to draft
ALTER TABLE cvp_payments ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Link to the workflow step that triggered the invoice
ALTER TABLE cvp_payments ADD COLUMN IF NOT EXISTS step_id UUID;
CREATE INDEX IF NOT EXISTS idx_cvp_payments_step ON cvp_payments(step_id);

-- 4. Vendor's own invoice reference number (their accounting system)
ALTER TABLE cvp_payments ADD COLUMN IF NOT EXISTS vendor_invoice_number VARCHAR(100);

-- 5. Vendor-uploaded invoice file
ALTER TABLE cvp_payments ADD COLUMN IF NOT EXISTS vendor_invoice_file_path TEXT;

-- 6. Order reference for display (denormalized from order_workflow_steps → orders)
ALTER TABLE cvp_payments ADD COLUMN IF NOT EXISTS order_reference TEXT;

-- 7. Description (e.g. "Translation — EN→FR")
ALTER TABLE cvp_payments ADD COLUMN IF NOT EXISTS description TEXT;

-- 8. Track when vendor submitted the invoice
ALTER TABLE cvp_payments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
