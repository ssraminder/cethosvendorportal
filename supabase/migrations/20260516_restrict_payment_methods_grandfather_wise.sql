-- Restrict vendor_payment_info.payment_method to the 4 product-approved
-- methods: bank_transfer, paypal, wire_transfer, cheque (2026-05-16
-- product directive: "direct deposit, wire transfer, cheque, paypal
-- should work. no other payment method").
--
-- 'wise' is grandfathered at the DB layer (8 existing rows in prod);
-- the Netlify update-payment-info VALID_METHODS allowlist + the UI
-- payment-method dropdown both DROP wise so no new selections can land
-- it in the column. Those 8 vendors keep being paid via Wise until they
-- re-save, at which point they're forced to pick one of the 4.
--
-- Drops legacy 'interac' and 'other' (verified 0 rows each in prod).
-- Drops 'e_transfer' (added in the 2026-05-16 alignment migration but
-- never adopted — Product reversed course same day).

ALTER TABLE public.vendor_payment_info
  DROP CONSTRAINT IF EXISTS vendor_payment_info_payment_method_check;

ALTER TABLE public.vendor_payment_info
  ADD CONSTRAINT vendor_payment_info_payment_method_check
  CHECK (payment_method = ANY (ARRAY[
    'bank_transfer'::text,
    'paypal'::text,
    'wire_transfer'::text,
    'cheque'::text,
    'wise'::text
  ]));
