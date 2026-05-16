-- Align vendor_payment_info.payment_method CHECK constraint with the
-- methods the vendor portal frontend + update-payment-info Netlify
-- function actually accept.
--
-- The original constraint allowed { bank_transfer, paypal, wise, interac,
-- cheque, other } but the frontend dropdown surfaces { e_transfer,
-- wire_transfer, paypal, bank_transfer, wise, cheque } and the Netlify
-- function's VALID_METHODS Set whitelists the same set plus 'cheque'.
--
-- Picking "Interac e-Transfer" or "Wire Transfer" passed the application-
-- layer validation but tripped the DB CHECK, surfacing as a generic 500
-- "Internal server error" to the vendor. Real-world repro confirmed
-- 2026-05-16 — zero rows actually use the legacy values (interac, other)
-- so this is a pure forward-compat fix.
--
-- Keeps `interac, other` for backward-compat / staff use.

ALTER TABLE public.vendor_payment_info
  DROP CONSTRAINT IF EXISTS vendor_payment_info_payment_method_check;

ALTER TABLE public.vendor_payment_info
  ADD CONSTRAINT vendor_payment_info_payment_method_check
  CHECK (payment_method = ANY (ARRAY[
    'bank_transfer'::text,
    'paypal'::text,
    'wise'::text,
    'e_transfer'::text,
    'wire_transfer'::text,
    'cheque'::text,
    'interac'::text,
    'other'::text
  ]));
