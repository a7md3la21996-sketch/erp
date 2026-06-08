-- Next-follow-up RPC for the Leads (contacts) list.
--
-- Surfaces, per contact, the next pending follow-up task so the page can show
-- a "Next Action" badge on every row (overdue / due-today / upcoming) instead
-- of burying that signal in filters. Mirrors the existing per-contact RPCs
-- get_latest_feedback_per_contact / get_contact_opp_counts.
--
-- Source of truth = the `tasks` table (pending tasks linked by contact_id),
-- the same data the __overdue_tasks / __today_followup quick filters use.
--
-- SECURITY INVOKER so RLS scopes which tasks each caller can see: a
-- sales_agent's badge reflects their own tasks; a manager's reflects the
-- team's. next_due is the earliest pending due_date (the most-overdue one when
-- any are overdue). NULL due_dates are ignored for next_due / overdue_count.

CREATE OR REPLACE FUNCTION get_next_followup_per_contact(p_contact_ids uuid[])
RETURNS TABLE(
  contact_id uuid,
  next_due timestamptz,
  overdue_count bigint,
  pending_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    contact_id,
    MIN(due_date)::timestamptz                                   AS next_due,
    COUNT(*) FILTER (WHERE due_date < now())::bigint             AS overdue_count,
    COUNT(*)::bigint                                             AS pending_count
  FROM tasks
  WHERE contact_id = ANY(p_contact_ids)
    AND status = 'pending'
  GROUP BY contact_id;
$$;

GRANT EXECUTE ON FUNCTION get_next_followup_per_contact(uuid[]) TO authenticated;
