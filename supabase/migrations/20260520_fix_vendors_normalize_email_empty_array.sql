-- vendors_normalize_email used to nullify additional_emails when the input
-- was an empty array. ARRAY_AGG() over an empty set returns NULL in
-- PostgreSQL, so the trigger ended up assigning NULL into a NOT NULL
-- column and the insert tripped the constraint check.
--
-- Caught on Sonia's approve flow (APP-26-0108): after PR #197 started
-- passing additional_emails: [] explicitly, the trigger normalised that
-- empty array to NULL and the same error came back. Wrapping the
-- ARRAY_AGG in COALESCE keeps an empty input empty.
CREATE OR REPLACE FUNCTION public.vendors_normalize_email()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;

  IF NEW.additional_emails IS NOT NULL THEN
    NEW.additional_emails := COALESCE(
      (
        SELECT ARRAY_AGG(LOWER(TRIM(ae)))
        FROM unnest(NEW.additional_emails) ae
        WHERE ae IS NOT NULL
      ),
      ARRAY[]::text[]
    );
  END IF;

  RETURN NEW;
END;
$function$;
