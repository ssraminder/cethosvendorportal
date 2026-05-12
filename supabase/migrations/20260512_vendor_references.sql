-- vendor_reference_requests + vendor_references
--
-- Post-onboarding parallel to cvp_application_reference_requests and
-- cvp_application_references. Lets admins request fresh references
-- from already-onboarded vendors (e.g. for tier upgrades, ISO 17100
-- evidence collection, periodic re-checks).
--
-- Two-step flow:
--   1. Admin triggers `vendor-request-references` → row in
--      vendor_reference_requests with request_token, email to vendor.
--   2. Vendor visits /vendor-references/<request_token>, submits 1-3
--      contacts → rows in vendor_references with feedback_token, V19-
--      style emails to each contact.
--   3. Each reference fills /vendor-reference-feedback/<feedback_token>
--      → updates the vendor_references row with feedback + rating.

CREATE TABLE IF NOT EXISTS public.vendor_reference_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  request_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  request_token_expires_at timestamptz NOT NULL,
  staff_id uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  staff_message text,
  ai_drafted_message text,
  -- sent | contacts_received | expired | cancelled
  status text NOT NULL DEFAULT 'sent',
  contacts_submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_reference_requests_vendor_idx
  ON public.vendor_reference_requests (vendor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.vendor_reference_requests(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  reference_name text NOT NULL,
  reference_email text NOT NULL,
  reference_company text,
  reference_relationship text,
  feedback_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  feedback_token_expires_at timestamptz NOT NULL,
  feedback_text text,
  feedback_rating integer CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)),
  feedback_received_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  ai_analysis jsonb,
  ai_analysis_at timestamptz,
  ai_analysis_error text,
  -- requested | received | declined | expired | invalid
  status text NOT NULL DEFAULT 'requested',
  reviewed_by uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_references_vendor_idx
  ON public.vendor_references (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_references_request_idx
  ON public.vendor_references (request_id);

COMMENT ON TABLE public.vendor_reference_requests IS
  'Admin-initiated reference collection asks for an already-onboarded vendor. Parallel to cvp_application_reference_requests.';
COMMENT ON TABLE public.vendor_references IS
  'Reference feedback rows tied to a vendor_reference_requests. Parallel to cvp_application_references.';
