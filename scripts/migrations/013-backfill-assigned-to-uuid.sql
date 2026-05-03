-- ════════════════════════════════════════════════════════════════
-- Migration 013: Re-sync contacts.assigned_to (UUID) from
--                contacts.assigned_to_name
--
-- Root cause:
--   handleBulkReassign + a few other paths called updateContact with
--   only assigned_to_name and never touched the assigned_to UUID. RLS
--   on contacts gates SELECT by `assigned_to = auth.uid()`, so the
--   row updates wrote the new agent's NAME but the UUID still pointed
--   at the OLD owner. Sales agents who 'received' leads via reassign
--   actually couldn't see them; the chip count showed 1 while the
--   list showed 22 because stats RPC counted by UUID and the list
--   filtered by name. The two views disagreed on every reassigned row.
--
--   Frontend fix: commit 218ad2a5 makes updateContact auto-resolve the
--   UUID from name when only the name is changed. This migration
--   cleans the existing rows.
--
-- Run once on Supabase. Already ran on production May 3, 2026.
-- For ambiguous names (multiple users sharing the same display name),
-- the WHERE clause's full_name_en/ar match resolves to ONE row, so
-- ambiguous cases are handled manually (Esraa Bakr vs Esraa Mahmoud
-- on prod needed a separate UPDATE — see commit message for ids).
-- ════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.contacts c
SET assigned_to = u.id,
    updated_at = now()
FROM public.users u
WHERE c.assigned_to_name IS NOT NULL
  AND c.assigned_to_name <> ''
  AND (u.full_name_en = c.assigned_to_name OR u.full_name_ar = c.assigned_to_name)
  AND (
    c.assigned_to IS NULL
    OR c.assigned_to <> u.id
  );

-- Verify (should be 0 once all ambiguous cases are resolved manually)
-- SELECT COUNT(*) FROM public.contacts c
-- WHERE c.assigned_to_name IS NOT NULL
--   AND c.assigned_to_name <> ''
--   AND (
--     c.assigned_to IS NULL
--     OR NOT EXISTS (
--       SELECT 1 FROM public.users u
--       WHERE u.id = c.assigned_to
--         AND (u.full_name_en = c.assigned_to_name OR u.full_name_ar = c.assigned_to_name)
--     )
--   );

COMMIT;
