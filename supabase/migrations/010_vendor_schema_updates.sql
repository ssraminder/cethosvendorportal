-- Migration 010: Vendor schema updates for audit compliance
-- Created: March 24, 2026
--
-- Changes:
-- 1. Add tax_id, tax_rate, preferred_rate_currency to vendors table (moved from vendor_payment_info)
-- 2. Rename preferred_currency to payment_currency in vendor_payment_info
-- 3. Migrate existing tax data from vendor_payment_info to vendors
-- 4. Drop tax_id and tax_rate from vendor_payment_info

-- Step 1: Add new columns to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_rate NUMERIC;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS preferred_rate_currency TEXT DEFAULT 'CAD';

-- Step 2: Migrate existing tax data from vendor_payment_info to vendors
UPDATE vendors v
SET
  tax_id = vpi.tax_id,
  tax_rate = vpi.tax_rate
FROM vendor_payment_info vpi
WHERE vpi.vendor_id = v.id
  AND (vpi.tax_id IS NOT NULL OR vpi.tax_rate IS NOT NULL);

-- Step 3: Rename preferred_currency to payment_currency in vendor_payment_info
ALTER TABLE vendor_payment_info RENAME COLUMN preferred_currency TO payment_currency;

-- Step 4: Drop tax columns from vendor_payment_info (data already migrated)
ALTER TABLE vendor_payment_info DROP COLUMN IF EXISTS tax_id;
ALTER TABLE vendor_payment_info DROP COLUMN IF EXISTS tax_rate;
