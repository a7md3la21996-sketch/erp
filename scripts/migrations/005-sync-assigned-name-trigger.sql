-- 005: Sync assigned_to_name with assigned_to UUID
--
-- Background: between Phase 0 (UUID backfill) and Phase 1 (single-assignment
-- migration), bulk reassignments updated `assigned_to` (UUID) without
-- updating `assigned_to_name` (text). Result: 602 contacts ended up with
-- a stale text name pointing to a different agent than the one in the UUID.
--
-- Symptom: a manager (e.g. Khaled, sales_manager of team A) saw contacts
-- whose `assigned_to_name` text said "Shahd" (in team B) but whose
-- `assigned_to` UUID actually pointed to a member of team A. The contacts
-- were correctly his (RLS uses UUID), but the displayed name was wrong,
-- making it look like a privacy leak.
--
-- This migration:
--   1. Creates a backup table snapshotting the corrupt rows BEFORE the fix
--      (so we can audit what changed).
--   2. Updates `assigned_to_name` and `assigned_to_names` to match the
--      actual user behind `assigned_to` (UUID is authoritative — RLS uses it).
--   3. Adds a BEFORE UPDATE trigger so future UUID changes auto-sync the
--      name field. Prevents the drift from coming back.

BEGIN;

-- 1. Backup the rows we're about to fix
CREATE TABLE IF NOT EXISTS public._backup_assigned_name_corrupt_2026_05_02 AS
SELECT
  c.id,
  c.full_name,
  c.assigned_to,
  c.assigned_to_name AS old_assigned_to_name,
  c.assigned_to_names AS old_assigned_to_names,
  u.full_name_en AS actual_owner_name,
  u.team_id AS actual_owner_team,
  NOW() AS backup_date
FROM public.contacts c
JOIN public.users u ON u.id = c.assigned_to
WHERE c.assigned_to IS NOT NULL
  AND c.assigned_to_name IS NOT NULL
  AND c.assigned_to_name <> u.full_name_en
  AND c.assigned_to_name <> u.full_name_ar;

-- 2. Sync name to UUID (UUID is the source of truth)
UPDATE public.contacts c
SET assigned_to_name = u.full_name_en,
    assigned_to_names = jsonb_build_array(u.full_name_en)
FROM public.users u
WHERE u.id = c.assigned_to
  AND c.assigned_to IS NOT NULL
  AND c.assigned_to_name IS NOT NULL
  AND c.assigned_to_name <> u.full_name_en
  AND c.assigned_to_name <> u.full_name_ar;

-- 3. Trigger: keep assigned_to_name in lockstep with assigned_to going forward
CREATE OR REPLACE FUNCTION public.sync_assigned_name_from_uuid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    SELECT full_name_en INTO NEW.assigned_to_name
    FROM public.users WHERE id = NEW.assigned_to;
    NEW.assigned_to_names := jsonb_build_array(NEW.assigned_to_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_assigned_name_contacts ON public.contacts;
CREATE TRIGGER trg_sync_assigned_name_contacts
  BEFORE UPDATE OF assigned_to ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_assigned_name_from_uuid();

COMMIT;

-- Verification (run after the BEGIN/COMMIT block):
-- SELECT COUNT(*) AS still_corrupt FROM public.contacts c
-- JOIN public.users u ON u.id = c.assigned_to
-- WHERE c.assigned_to_name <> u.full_name_en AND c.assigned_to_name <> u.full_name_ar;
-- Expected: 0
