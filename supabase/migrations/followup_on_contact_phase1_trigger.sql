-- ============================================================================
-- Follow-up-on-the-lead, Phase 1 — trigger keeps contacts.next_follow_up_at live.
--
-- Whenever a task's status / due_date / contact_id changes (or it is inserted /
-- deleted), recompute the parent lead's next_follow_up_at = earliest remaining
-- pending task (or NULL). This keeps the column authoritative no matter which
-- existing code path writes tasks — so we don't have to touch any write site to
-- get a correct column. INVISIBLE to the app (nothing reads the column yet).
--
-- SECURITY DEFINER so the recompute can update contacts regardless of the
-- writer's RLS. No recursion: contacts' own triggers fire only on assigned_to /
-- assigned_to_name / INSERT, and this only writes next_follow_up_at.
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_contact_next_follow_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- recompute the OLD parent (UPDATE/DELETE)
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.contact_id IS NOT NULL THEN
    UPDATE contacts c
    SET next_follow_up_at = (
      SELECT min(t.due_date) FROM tasks t
      WHERE t.contact_id = OLD.contact_id AND t.status = 'pending'
    )
    WHERE c.id = OLD.contact_id;
  END IF;

  -- recompute the NEW parent (INSERT, or UPDATE that moved the task)
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.contact_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.contact_id IS DISTINCT FROM OLD.contact_id) THEN
    UPDATE contacts c
    SET next_follow_up_at = (
      SELECT min(t.due_date) FROM tasks t
      WHERE t.contact_id = NEW.contact_id AND t.status = 'pending'
    )
    WHERE c.id = NEW.contact_id;
  END IF;

  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_next_follow_up ON tasks;
CREATE TRIGGER trg_sync_contact_next_follow_up
AFTER INSERT OR DELETE OR UPDATE OF status, due_date, contact_id
ON tasks
FOR EACH ROW
EXECUTE FUNCTION sync_contact_next_follow_up();
