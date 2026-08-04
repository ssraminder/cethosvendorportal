-- Backfill cvp_payments.due_date for live (submitted/approved) vendor
-- invoices that never had one set. The vendor-raise-invoice /
-- vendor-submit-invoice edge functions now set due_date at submission as
-- invoice_date + the vendor's NET payment terms
-- (vendor_payment_info.payment_terms_days, default 45); this applies the
-- same rule to the rows created before that change. Draft invoices get
-- their due date at submission; paid/rejected/cancelled history is left
-- untouched.

UPDATE cvp_payments p
SET due_date = COALESCE(p.invoice_date, p.submitted_at::date, p.created_at::date)
             + COALESCE(vpi.payment_terms_days, 45),
    updated_at = now()
FROM vendor_payment_info vpi
WHERE vpi.vendor_id = p.vendor_id
  AND p.due_date IS NULL
  AND p.status IN ('submitted', 'approved');

-- Vendors with no vendor_payment_info row at all: default 45 days.
UPDATE cvp_payments p
SET due_date = COALESCE(p.invoice_date, p.submitted_at::date, p.created_at::date)
             + interval '45 days',
    updated_at = now()
WHERE p.due_date IS NULL
  AND p.status IN ('submitted', 'approved');
