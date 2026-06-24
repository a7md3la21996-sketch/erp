-- Accurate follow-up bucket counts for the Leads page dropdown.
--
-- The page was tallying these client-side from a .select('contact_id') that
-- Supabase silently caps at 1000 rows, so the "overdue" number was wrong (the
-- real backlog is ~2200 distinct contacts). This computes the distinct-contact
-- counts server-side in one call.
--
-- SECURITY INVOKER so RLS on `tasks` scopes the counts per role (a sales_agent's
-- numbers reflect their own tasks; a manager's, the team's).
--
-- Returns: { overdue, today, upcoming } — distinct contacts with a pending task
-- due before today / today / after today.

CREATE OR REPLACE FUNCTION public.get_followup_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'overdue',  count(DISTINCT contact_id) FILTER (WHERE due_date <  date_trunc('day', now())),
    'today',    count(DISTINCT contact_id) FILTER (WHERE due_date >= date_trunc('day', now())
                                                     AND due_date <  date_trunc('day', now()) + interval '1 day'),
    'upcoming', count(DISTINCT contact_id) FILTER (WHERE due_date >= date_trunc('day', now()) + interval '1 day')
  )
  FROM tasks
  WHERE status = 'pending' AND contact_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_followup_counts() TO authenticated;
