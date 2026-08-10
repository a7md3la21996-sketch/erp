-- ROOT FIX (part 2) for denormalized-name drift on contacts. Part 1
-- (fill_contact_denormalized_names.sql) filled NULL names. But names can also
-- DRIFT to a wrong-but-non-null value: the same user's leads were stamped both
-- "saeed yasser" (full_name_en) and "saeed yasser saeed" (romanized full_name_ar)
-- by different write paths, and a stale name lingers after a user is renamed.
-- Because the drawer used to decide ownership by this name, a drifted name made
-- the owner's own leads read-only. The UI is now id-based (can't be broken by
-- drift), and here we stop the drift at the source so the DISPLAYED owner label
-- is always consistent — for every user, forever.
--
-- Two enforcement points:
--   A) contacts trigger: whenever created_by/assigned_to is set, OVERWRITE the
--      *_name copy with the canonical users name (only when the user resolves —
--      a lead pointing at a since-deleted user keeps its existing label rather
--      than being blanked).
--   B) users trigger: when a user is renamed, cascade the new name to all of
--      their contacts. Renames are rare; the UPDATE only touches rows that differ.

-- ── A) Enforce canonical names on every contacts write ──────────────────────
CREATE OR REPLACE FUNCTION public.fill_contact_denormalized_names()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar) INTO v_name
    FROM public.users u WHERE u.id = NEW.created_by;
    IF v_name IS NOT NULL THEN NEW.created_by_name := v_name; END IF;
  END IF;
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar) INTO v_name
    FROM public.users u WHERE u.id = NEW.assigned_to;
    IF v_name IS NOT NULL THEN NEW.assigned_to_name := v_name; END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- (trigger trg_fill_contact_names already exists from part 1 and stays attached;
--  only the function body changed above.)

-- ── B) Cascade a user rename to their contacts ──────────────────────────────
CREATE OR REPLACE FUNCTION public.cascade_user_name_to_contacts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE canon text;
BEGIN
  IF NEW.full_name_en IS DISTINCT FROM OLD.full_name_en
     OR NEW.full_name_ar IS DISTINCT FROM OLD.full_name_ar THEN
    canon := COALESCE(NULLIF(NEW.full_name_en, ''), NEW.full_name_ar);
    IF canon IS NOT NULL THEN
      UPDATE public.contacts SET assigned_to_name = canon
        WHERE assigned_to = NEW.id AND assigned_to_name IS DISTINCT FROM canon;
      UPDATE public.contacts SET created_by_name = canon
        WHERE created_by = NEW.id AND created_by_name IS DISTINCT FROM canon;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_user_name ON public.users;
CREATE TRIGGER trg_cascade_user_name
  AFTER UPDATE OF full_name_en, full_name_ar ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.cascade_user_name_to_contacts();

-- ── One-time general re-sync: fix ANY current drift (not just the 2 users
--    already corrected), so the whole table matches canonical now. ──────────
UPDATE public.contacts c
SET assigned_to_name = COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar)
FROM public.users u
WHERE u.id = c.assigned_to
  AND c.assigned_to IS NOT NULL
  AND c.assigned_to_name IS DISTINCT FROM COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar);

UPDATE public.contacts c
SET created_by_name = COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar)
FROM public.users u
WHERE u.id = c.created_by
  AND c.created_by IS NOT NULL
  AND c.created_by_name IS DISTINCT FROM COALESCE(NULLIF(u.full_name_en, ''), u.full_name_ar);

DO $$
BEGIN
  INSERT INTO public.audit_logs (action, entity, entity_name, description)
  VALUES ('backfill', 'contacts', 'name-drift enforcement',
          'Upgraded trg_fill_contact_names to enforce canonical names on write, added trg_cascade_user_name for renames, and re-synced any drifted assigned_to_name/created_by_name.');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
