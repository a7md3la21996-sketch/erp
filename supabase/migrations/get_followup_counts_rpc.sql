-- Follow-up buckets for the Leads page — counts + contact-id lists.
--
-- Buckets are MUTUALLY EXCLUSIVE per lead: a lead is classified by its EARLIEST
-- pending task (its next action), not by "has any task in the bucket". So a lead
-- with both an overdue task and a future task counts as overdue only — it won't
-- also show under "upcoming" (which previously confused users).
--
-- Day boundaries are passed in by the client (its local midnight / next local
-- midnight) so the count and the filtered list use the exact same instants — no
-- UTC-vs-local drift. SECURITY INVOKER so RLS on `tasks` scopes per role.

-- Counts: { overdue, today, upcoming } distinct leads, bucketed by next action.
DROP FUNCTION IF EXISTS public.get_followup_counts(timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.get_followup_counts(
  p_today_start    timestamptz,
  p_tomorrow_start timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'overdue',  count(*) FILTER (WHERE next_due <  p_today_start),
    'today',    count(*) FILTER (WHERE next_due >= p_today_start AND next_due < p_tomorrow_start),
    'upcoming', count(*) FILTER (WHERE next_due >= p_tomorrow_start)
  )
  FROM (
    SELECT contact_id, min(due_date) AS next_due
    FROM tasks
    WHERE status = 'pending' AND contact_id IS NOT NULL
    GROUP BY contact_id
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.get_followup_counts(timestamptz, timestamptz) TO authenticated;

-- Contact ids for one bucket — same earliest-task logic, so the filtered list
-- matches the chip count exactly (and is server-side, no 1000-row cap).
CREATE OR REPLACE FUNCTION public.get_followup_contact_ids(
  p_bucket         text,
  p_today_start    timestamptz,
  p_tomorrow_start timestamptz
)
RETURNS TABLE(contact_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT contact_id
  FROM (
    SELECT contact_id, min(due_date) AS next_due
    FROM tasks
    WHERE status = 'pending' AND contact_id IS NOT NULL
    GROUP BY contact_id
  ) t
  WHERE CASE p_bucket
    WHEN 'overdue'  THEN next_due <  p_today_start
    WHEN 'today'    THEN next_due >= p_today_start AND next_due < p_tomorrow_start
    WHEN 'upcoming' THEN next_due >= p_tomorrow_start
    ELSE false
  END;
$$;
GRANT EXECUTE ON FUNCTION public.get_followup_contact_ids(text, timestamptz, timestamptz) TO authenticated;
