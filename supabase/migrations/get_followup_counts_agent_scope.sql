-- Add an optional p_agent_name to the follow-up counts so the CRM dashboard's
-- scope selector (view-as a specific agent) can narrow Overdue/Today/Upcoming.
-- Resolves the name to a uuid via users and filters contacts.assigned_to.
-- Replaces the 3-arg version with a 4-arg one (both new params default NULL =
-- unchanged behaviour). SECURITY INVOKER so RLS still scopes per role.

DROP FUNCTION IF EXISTS public.get_followup_counts(timestamptz, timestamptz, text);

CREATE OR REPLACE FUNCTION public.get_followup_counts(
  p_today_start    timestamptz,
  p_tomorrow_start timestamptz,
  p_lead_category  text DEFAULT NULL,
  p_agent_name     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ag AS (
    SELECT id FROM users
    WHERE p_agent_name IS NOT NULL
      AND (full_name_en = p_agent_name OR full_name_ar = p_agent_name)
    LIMIT 1
  )
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
      AND (p_agent_name    IS NULL OR c.assigned_to IN (SELECT id FROM ag))
    GROUP BY t.contact_id
  ) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_followup_counts(timestamptz, timestamptz, text, text) TO authenticated;
