-- Accurate follow-up bucket counts for the Leads page chips.
--
-- The page was tallying these client-side from a .select('contact_id') that
-- Supabase silently caps at 1000 rows, so "overdue" was wrong. This computes the
-- distinct-contact counts server-side in one call.
--
-- The day boundaries are PASSED IN by the client (its local-midnight / next
-- local-midnight as timestamptz) and are the SAME instants the overdue/today/
-- upcoming filters use — so the chip number always equals the filtered list,
-- with no UTC-vs-local timezone drift (which caused a 57-vs-58 mismatch).
--
-- SECURITY INVOKER so RLS on `tasks` scopes the counts per role.
-- Returns: { overdue, today, upcoming } distinct-contact counts.

DROP FUNCTION IF EXISTS public.get_followup_counts();

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
    'overdue',  count(DISTINCT contact_id) FILTER (WHERE due_date <  p_today_start),
    'today',    count(DISTINCT contact_id) FILTER (WHERE due_date >= p_today_start
                                                     AND due_date <  p_tomorrow_start),
    'upcoming', count(DISTINCT contact_id) FILTER (WHERE due_date >= p_tomorrow_start)
  )
  FROM tasks
  WHERE status = 'pending' AND contact_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_followup_counts(timestamptz, timestamptz) TO authenticated;
