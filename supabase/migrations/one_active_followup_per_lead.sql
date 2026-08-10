-- ============================================================================
-- Enforce ONE active follow-up per lead (interim patch before Phase 3).
--
-- Problem: a lead could accumulate several pending tasks (an old overdue one +
-- a newly-set one). next_follow_up_at = min(due_date) picks the OLD overdue
-- one, so the lead keeps showing overdue even though the rep set a new date.
--
-- Fix: when a new pending task is created for a lead, supersede (cancel) its
-- other pending tasks — the newest follow-up wins. The tasks trigger then
-- recomputes next_follow_up_at to that single remaining date.
--
-- No recursion: fires only AFTER INSERT (the cancel UPDATE can't re-fire it).
-- ============================================================================

CREATE OR REPLACE FUNCTION supersede_prior_followups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tasks
  SET status = 'cancelled', completed_at = now()
  WHERE contact_id = NEW.contact_id
    AND status = 'pending'
    AND id <> NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supersede_prior_followups ON tasks;
CREATE TRIGGER trg_supersede_prior_followups
AFTER INSERT ON tasks
FOR EACH ROW
WHEN (NEW.status = 'pending' AND NEW.contact_id IS NOT NULL)
EXECUTE FUNCTION supersede_prior_followups();
