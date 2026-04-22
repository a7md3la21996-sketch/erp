-- Comprehensive backfill for assigned_at on existing contacts.
--
-- The original migration (add_assigned_at_column.sql) only backfilled rows
-- where assigned_to_name IS NOT NULL. Contacts that had only the
-- assigned_to_names[] array populated, or that were created between that
-- migration and the app-side fix landing today, still have NULL — so
-- "Sort: Assignment Date" sinks them to the bottom and the drawer shows "----".
--
-- This migration stamps assigned_at = created_at for EVERY contact that
-- currently has an assignee but no timestamp. It is idempotent — re-running
-- is safe because the WHERE clause excludes rows already stamped.

UPDATE contacts
SET    assigned_at = created_at
WHERE  assigned_at IS NULL
  AND  (
         assigned_to_name IS NOT NULL
         OR (assigned_to_names IS NOT NULL AND jsonb_array_length(assigned_to_names) > 0)
       );

-- Sanity check: how many rows were affected?
-- SELECT COUNT(*) AS backfilled FROM contacts WHERE assigned_at IS NOT NULL;
