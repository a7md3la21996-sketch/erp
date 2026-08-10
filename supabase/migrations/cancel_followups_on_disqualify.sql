-- ============================================================================
-- Disqualifying a lead must cancel its pending follow-ups.
--
-- A disqualified lead is dead → it needs no next action. But nothing was
-- cancelling its pending tasks, so `contacts.next_follow_up_at` (synced from
-- pending tasks by trg_sync_contact_next_follow_up) stayed set → ~166 DQ leads
-- kept showing an (overdue) follow-up. This trigger cancels pending tasks the
-- moment a lead transitions into 'disqualified', from ANY path (UI / bulk /
-- RPC / raw SQL). The tasks trigger then clears next_follow_up_at.
--
-- No recursion: this fires only AFTER UPDATE OF contact_status with the WHEN
-- transition guard; the tasks-side trigger only writes next_follow_up_at, which
-- doesn't touch contact_status.
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_tasks_on_disqualify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tasks
  SET status = 'cancelled', completed_at = now()
  WHERE contact_id = NEW.id AND status = 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_tasks_on_disqualify ON contacts;
CREATE TRIGGER trg_cancel_tasks_on_disqualify
AFTER UPDATE OF contact_status ON contacts
FOR EACH ROW
WHEN (NEW.contact_status = 'disqualified' AND OLD.contact_status IS DISTINCT FROM 'disqualified')
EXECUTE FUNCTION cancel_tasks_on_disqualify();
