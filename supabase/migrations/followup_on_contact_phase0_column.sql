-- ============================================================================
-- Follow-up-on-the-lead, Phase 0 — additive column + backfill (INVISIBLE).
--
-- The "next follow-up" becomes an intrinsic property of the lead. Its owner is
-- always contacts.assigned_to (derived, never stored separately) — killing the
-- task-owner drift that made a team leader (23) and admin (57) see different
-- overdue counts for the same team.
--
-- This phase ONLY adds the column + backfills it from the current pending
-- tasks. Nothing reads it yet, so application behaviour is unchanged. Fully
-- reversible: DROP COLUMN.
-- ============================================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS next_follow_up_at   timestamptz,
  ADD COLUMN IF NOT EXISTS next_follow_up_note text;

CREATE INDEX IF NOT EXISTS idx_contacts_next_follow_up
  ON contacts (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;

-- Backfill: each lead's next follow-up = the earliest pending task on it.
UPDATE contacts c
SET next_follow_up_at = s.next_due
FROM (
  SELECT contact_id, min(due_date) AS next_due
  FROM tasks
  WHERE status = 'pending' AND contact_id IS NOT NULL
  GROUP BY contact_id
) s
WHERE s.contact_id = c.id
  AND c.is_deleted IS NOT TRUE;
