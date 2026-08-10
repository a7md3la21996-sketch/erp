-- Phase 0: category chips reflect the ACTIVE pipeline.
--
-- The APP calls the 5-arg overload (…, p_agent_ids uuid[]) from
-- lens_rpcs_agent_ids_team_scope.sql — that's the one to patch. We also DROP the
-- older 4-arg overload so a call that omits p_agent_ids isn't ambiguous
-- (PostgREST PGRST203 "could not choose the best candidate function").
--
-- Only change vs the lens version: the WHERE gains
--   AND (p_status IS NOT NULL OR contact_status IS DISTINCT FROM 'disqualified')
-- so the default "all" view (p_status IS NULL) excludes disqualified, while any
-- explicit status — including the Archive view (p_status = 'disqualified') —
-- stands the exclusion down.

DROP FUNCTION IF EXISTS public.get_lead_category_counts(text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_lead_category_counts(
  p_dept text DEFAULT NULL, p_agent_name text DEFAULT NULL,
  p_status text DEFAULT NULL, p_temperature text DEFAULT NULL,
  p_agent_ids uuid[] DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH ag AS (
    SELECT id FROM users WHERE p_agent_name IS NOT NULL
      AND (full_name_en = p_agent_name OR full_name_ar = p_agent_name) LIMIT 1
  ),
  filtered AS (
    SELECT COALESCE(lead_category, '(none)') AS cat
    FROM contacts
    WHERE is_deleted IS NOT TRUE
      AND (p_dept        IS NULL OR department     = p_dept)
      AND (p_status      IS NULL OR contact_status = p_status)
      AND (p_temperature IS NULL OR temperature    = p_temperature)
      AND (p_agent_name  IS NULL OR assigned_to IN (SELECT id FROM ag))
      AND (p_agent_ids   IS NULL OR assigned_to = ANY(p_agent_ids))
      -- Active-pipeline default: drop disqualified from the "all" view.
      AND (p_status IS NOT NULL OR contact_status IS DISTINCT FROM 'disqualified')
  )
  SELECT COALESCE(jsonb_object_agg(cat, n), '{}'::jsonb) || jsonb_build_object('total', COALESCE(SUM(n), 0))
  FROM (SELECT cat, COUNT(*) AS n FROM filtered GROUP BY cat) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_lead_category_counts(text, text, text, text, uuid[]) TO authenticated;
