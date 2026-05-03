-- ════════════════════════════════════════════════════════════════
-- Migration 012: Trim trailing/leading whitespace from name caches
--
-- Found Dina's user record stored as 'Dina ' (trailing space). Reassign
-- failed with 'unknown agent: Dina' because the dropdown displayed
-- the trimmed name but the validator queried for the exact match.
--
-- Fixed users.full_name_* (separate UPDATE on production), then
-- discovered the same trailing space lived on every CACHED copy of
-- the name across other tables — assigned_to_name on contacts /
-- opportunities, user_name_* on activities, assigned_to_name_* on
-- tasks. So even after fixing users, list filters by name still
-- returned 0 rows because contacts.assigned_to_name was 'Dina '.
--
-- This migration trims everywhere. Frontend (UsersPage save handler)
-- now also trims on insert/update so this can't happen again from
-- the create flow.
--
-- Already ran on production May 3, 2026. Idempotent.
-- ════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.contacts
SET assigned_to_name  = trim(assigned_to_name),
    assigned_by_name  = trim(assigned_by_name),
    created_by_name   = trim(created_by_name)
WHERE assigned_to_name <> trim(assigned_to_name)
   OR assigned_by_name <> trim(assigned_by_name)
   OR created_by_name  <> trim(created_by_name);

UPDATE public.contacts
SET assigned_to_names = (
  SELECT jsonb_agg(trim(value::text, '"'))
  FROM jsonb_array_elements(assigned_to_names)
)
WHERE assigned_to_names IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(assigned_to_names) v
    WHERE v <> trim(v)
  );

UPDATE public.opportunities
SET assigned_to_name  = trim(assigned_to_name),
    agent_name        = trim(agent_name),
    contact_name      = trim(contact_name),
    created_by_name   = trim(created_by_name)
WHERE assigned_to_name <> trim(assigned_to_name)
   OR agent_name       <> trim(agent_name)
   OR contact_name     <> trim(contact_name)
   OR created_by_name  <> trim(created_by_name);

UPDATE public.activities
SET user_name_en = trim(user_name_en),
    user_name_ar = trim(user_name_ar)
WHERE user_name_en <> trim(user_name_en)
   OR user_name_ar <> trim(user_name_ar);

UPDATE public.tasks
SET assigned_to_name_en = trim(assigned_to_name_en),
    assigned_to_name_ar = trim(assigned_to_name_ar)
WHERE assigned_to_name_en <> trim(assigned_to_name_en)
   OR assigned_to_name_ar <> trim(assigned_to_name_ar);

-- Also clean the source — users.full_name_*  (ran first on production)
UPDATE public.users
SET full_name_en = trim(full_name_en),
    full_name_ar = trim(full_name_ar)
WHERE full_name_en <> trim(full_name_en)
   OR full_name_ar <> trim(full_name_ar);

-- Verify all four caches are clean
-- SELECT 'contacts', COUNT(*) FROM public.contacts WHERE assigned_to_name <> trim(assigned_to_name)
-- UNION ALL SELECT 'opportunities', COUNT(*) FROM public.opportunities WHERE assigned_to_name <> trim(assigned_to_name)
-- UNION ALL SELECT 'activities',    COUNT(*) FROM public.activities    WHERE user_name_en      <> trim(user_name_en)
-- UNION ALL SELECT 'tasks',         COUNT(*) FROM public.tasks         WHERE assigned_to_name_en <> trim(assigned_to_name_en);

COMMIT;
