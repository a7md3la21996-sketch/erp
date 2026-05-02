-- 006: Sync activity.user_name + task.assigned_to_name with users table
--
-- Same drift pattern we fixed for contacts.assigned_to_name in migration 005,
-- but for two more tables:
--
--   - activities (50,787 rows): the user_name_en / user_name_ar text fields
--     held the user's name AT THE TIME the activity was created. When users
--     were later renamed (e.g. "Employee #31" → "Ahlam"), the old activities
--     kept the stale label. Result: timelines on contacts showed cryptic
--     "Employee #31 called this lead" entries that nobody could identify.
--
--   - tasks (9 rows): same pattern, plus a couple of rows where the name was
--     stored in Arabic ("احمد ماهر") even though the user record's English
--     name is "Ahmed Maher". Same person, mismatched label.
--
-- Decision: sync the text labels to the CURRENT user.full_name_en/ar.
-- Audit value of historical names is low — if a user leaves they are
-- typically renamed to "Former Employee #N", which is exactly what the
-- timeline should display.
--
-- This migration:
--   1. Snapshots the corrupt rows for both tables.
--   2. UPDATEs the text fields to match the user behind user_id / assigned_to.
--   3. Adds BEFORE INSERT OR UPDATE triggers so future writes auto-sync the
--      names from the users table — drift can't come back.

BEGIN;

-- ─── 1. Backup ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public._backup_activities_user_name_drift_2026_05_02 AS
SELECT
  a.id,
  a.contact_id,
  a.user_id,
  a.user_name_en AS old_user_name_en,
  a.user_name_ar AS old_user_name_ar,
  u.full_name_en AS actual_user_name_en,
  u.full_name_ar AS actual_user_name_ar,
  a.created_at,
  NOW() AS backup_date
FROM public.activities a
JOIN public.users u ON u.id = a.user_id
WHERE a.user_id IS NOT NULL
  AND a.user_name_en IS NOT NULL
  AND a.user_name_en <> u.full_name_en
  AND a.user_name_en <> u.full_name_ar;

CREATE TABLE IF NOT EXISTS public._backup_tasks_assigned_name_drift_2026_05_02 AS
SELECT
  t.id,
  t.title,
  t.assigned_to,
  t.assigned_to_name_en AS old_assigned_to_name_en,
  t.assigned_to_name_ar AS old_assigned_to_name_ar,
  u.full_name_en AS actual_assignee_name_en,
  u.full_name_ar AS actual_assignee_name_ar,
  NOW() AS backup_date
FROM public.tasks t
JOIN public.users u ON u.id = t.assigned_to
WHERE t.assigned_to IS NOT NULL
  AND t.assigned_to_name_en IS NOT NULL
  AND t.assigned_to_name_en <> u.full_name_en;

-- ─── 2. Bulk sync ──────────────────────────────────────────────────────────

UPDATE public.activities a
SET user_name_en = u.full_name_en,
    user_name_ar = COALESCE(u.full_name_ar, u.full_name_en)
FROM public.users u
WHERE u.id = a.user_id
  AND a.user_id IS NOT NULL
  AND a.user_name_en IS NOT NULL
  AND a.user_name_en <> u.full_name_en
  AND a.user_name_en <> u.full_name_ar;

UPDATE public.tasks t
SET assigned_to_name_en = u.full_name_en,
    assigned_to_name_ar = COALESCE(u.full_name_ar, u.full_name_en)
FROM public.users u
WHERE u.id = t.assigned_to
  AND t.assigned_to IS NOT NULL
  AND t.assigned_to_name_en IS NOT NULL
  AND t.assigned_to_name_en <> u.full_name_en;

-- ─── 3. Triggers to keep them synced going forward ────────────────────────

CREATE OR REPLACE FUNCTION public.sync_activity_user_names()
RETURNS TRIGGER AS $$
DECLARE
  _en text;
  _ar text;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT full_name_en, COALESCE(full_name_ar, full_name_en)
      INTO _en, _ar
    FROM public.users WHERE id = NEW.user_id;
    NEW.user_name_en := _en;
    NEW.user_name_ar := _ar;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_activity_user_names ON public.activities;
CREATE TRIGGER trg_sync_activity_user_names
  BEFORE INSERT OR UPDATE OF user_id ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_activity_user_names();

CREATE OR REPLACE FUNCTION public.sync_task_assignee_names()
RETURNS TRIGGER AS $$
DECLARE
  _en text;
  _ar text;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT full_name_en, COALESCE(full_name_ar, full_name_en)
      INTO _en, _ar
    FROM public.users WHERE id = NEW.assigned_to;
    NEW.assigned_to_name_en := _en;
    NEW.assigned_to_name_ar := _ar;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_task_assignee_names ON public.tasks;
CREATE TRIGGER trg_sync_task_assignee_names
  BEFORE INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_assignee_names();

COMMIT;

-- Verification (run after the BEGIN/COMMIT):
-- SELECT 'activities' AS source, COUNT(*) AS still_corrupt FROM public.activities a
--   JOIN public.users u ON u.id = a.user_id
--   WHERE a.user_id IS NOT NULL AND a.user_name_en IS NOT NULL
--   AND a.user_name_en <> u.full_name_en AND a.user_name_en <> u.full_name_ar
-- UNION ALL
-- SELECT 'tasks', COUNT(*) FROM public.tasks t
--   JOIN public.users u ON u.id = t.assigned_to
--   WHERE t.assigned_to IS NOT NULL AND t.assigned_to_name_en IS NOT NULL
--   AND t.assigned_to_name_en <> u.full_name_en;
-- Expected: both 0
