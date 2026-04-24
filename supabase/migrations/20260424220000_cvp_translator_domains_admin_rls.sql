-- Admin access to cvp_translator_domains
--
-- The table was created in 20260424200100 with a service_role-only policy.
-- Admin portal UI (VendorDomainsTab + future write actions) needs to
-- read/write the table under the staff's authenticated Supabase session,
-- matching the pattern used by cvp_translators + the cvp_training_* tables.
--
-- Vendor-facing access remains routed through the cvp-get-my-domains /
-- cvp-request-test edge functions (service_role) — vendors never hit this
-- table with anon or authenticated roles.

BEGIN;

-- Staff (logged into the admin portal via Supabase Auth) can read the full
-- domain matrix for any vendor. The portal currently has no row-level
-- tenancy beyond "is staff", so we grant SELECT broadly to authenticated.
DROP POLICY IF EXISTS "Staff can read cvp_translator_domains" ON cvp_translator_domains;
CREATE POLICY "Staff can read cvp_translator_domains"
  ON cvp_translator_domains
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff can manually add a domain approval (add, revoke, override).
-- Writes go through this same policy until we gate by staff_users.role
-- in a later iteration.
DROP POLICY IF EXISTS "Staff can insert cvp_translator_domains" ON cvp_translator_domains;
CREATE POLICY "Staff can insert cvp_translator_domains"
  ON cvp_translator_domains
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update cvp_translator_domains" ON cvp_translator_domains;
CREATE POLICY "Staff can update cvp_translator_domains"
  ON cvp_translator_domains
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
