-- ROOT FIX for missing denormalized names on contacts (created_by_name /
-- assigned_to_name). These columns are copies of a user's name that APP code
-- has to remember to set on every insert path — Meta auto-ingest, CSV import,
-- scripts, manual add. Any path that forgets leaves them NULL, so the drawer's
-- "Created By" row silently disappears. 2,922 leads are affected today (all
-- from the auto-ingest that set created_by but not created_by_name).
--
-- Instead of patching each insert path one by one, move the responsibility to
-- ONE database trigger, so NO write path (current or future) can ever leave the
-- name null again. Plus a one-time backfill for the existing rows.

-- 1) Trigger function: fill the *_name copy from `users` whenever the id is set
--    but the name is missing. It only touches EMPTY names, so an app-provided
--    value (e.g. a reassignment that sets assigned_to_name explicitly) is never
--    overwritten. SECURITY DEFINER so it can read `users` regardless of the
--    caller's RLS (otherwise a sales_agent insert couldn't resolve the name).
CREATE OR REPLACE FUNCTION public.fill_contact_denormalized_names()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL AND (NEW.created_by_name IS NULL OR NEW.created_by_name = '') THEN
    SELECT COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar)
      INTO NEW.created_by_name FROM public.users u WHERE u.id = NEW.created_by;
  END IF;
  IF NEW.assigned_to IS NOT NULL AND (NEW.assigned_to_name IS NULL OR NEW.assigned_to_name = '') THEN
    SELECT COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar)
      INTO NEW.assigned_to_name FROM public.users u WHERE u.id = NEW.assigned_to;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Attach it. BEFORE INSERT OR UPDATE, scoped with OF (…) so a status-only
--    update doesn't pay for a users lookup — only writes that touch the id or
--    name columns fire it.
DROP TRIGGER IF EXISTS trg_fill_contact_names ON public.contacts;
CREATE TRIGGER trg_fill_contact_names
  BEFORE INSERT OR UPDATE OF created_by, created_by_name, assigned_to, assigned_to_name
  ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.fill_contact_denormalized_names();

-- 3) One-time backfill of the existing gap. created_by_name ≈ 2,922 rows;
--    assigned_to_name is currently 0 but included for completeness/idempotency.
--    Non-destructive: only fills rows whose name is NULL/'' (never overwrites).
WITH upd AS (
  UPDATE public.contacts c
  SET created_by_name = COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar)
  FROM public.users u
  WHERE u.id = c.created_by
    AND c.created_by IS NOT NULL
    AND (c.created_by_name IS NULL OR c.created_by_name = '')
  RETURNING 1
)
SELECT count(*) AS created_by_name_filled FROM upd;

UPDATE public.contacts c
SET assigned_to_name = COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar)
FROM public.users u
WHERE u.id = c.assigned_to
  AND c.assigned_to IS NOT NULL
  AND (c.assigned_to_name IS NULL OR c.assigned_to_name = '');

-- 4) Record it in audit_logs (best-effort — never breaks the migration if the
--    audit schema differs).
DO $$
BEGIN
  INSERT INTO public.audit_logs (action, entity, entity_name, description)
  VALUES ('backfill', 'contacts', 'denormalized names',
          'Backfilled contacts.created_by_name/assigned_to_name from users, and added the trg_fill_contact_names trigger to keep them in sync on every future write.');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
