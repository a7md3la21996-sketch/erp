-- Add an optional p_lead_category filter to the follow-up chip counts so that
-- picking a lead-origin chip narrows Overdue / Today / Upcoming too. Joins
-- contacts to read lead_category. Replaces the 2-arg version with a 3-arg one
-- (p_lead_category defaults NULL = unchanged behaviour). SECURITY INVOKER so
-- RLS on tasks/contacts still scopes per role.

DROP FUNCTION IF EXISTS public.get_followup_counts(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_followup_counts(
  p_today_start    timestamptz,
  p_tomorrow_start timestamptz,
  p_lead_category  text DEFAULT NULL
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
    SELECT t.contact_id, min(t.due_date) AS next_due
    FROM tasks t
    JOIN contacts c ON c.id = t.contact_id
    WHERE t.status = 'pending' AND t.contact_id IS NOT NULL
      AND (p_lead_category IS NULL OR c.lead_category = p_lead_category)
    GROUP BY t.contact_id
  ) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_followup_counts(timestamptz, timestamptz, text) TO authenticated;
