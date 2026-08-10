-- Team scope for the CRM dashboard: let the three lens RPCs filter by a SET of
-- agents (a whole team), not just one. Adds p_agent_ids uuid[] to each. When
-- provided, contacts are limited to assigned_to = ANY(p_agent_ids). The single
-- p_agent_name / p_agent_id params stay for backward compatibility (the Leads
-- page still uses them). All keep their existing SECURITY/STABLE settings.

-- ── get_lead_category_counts ───────────────────────────────────────────────
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
  )
  SELECT COALESCE(jsonb_object_agg(cat, n), '{}'::jsonb) || jsonb_build_object('total', COALESCE(SUM(n), 0))
  FROM (SELECT cat, COUNT(*) AS n FROM filtered GROUP BY cat) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_lead_category_counts(text, text, text, text, uuid[]) TO authenticated;

-- ── get_followup_counts ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_followup_counts(timestamptz, timestamptz, text, text);
CREATE OR REPLACE FUNCTION public.get_followup_counts(
  p_today_start timestamptz, p_tomorrow_start timestamptz,
  p_lead_category text DEFAULT NULL, p_agent_name text DEFAULT NULL,
  p_agent_ids uuid[] DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH ag AS (
    SELECT id FROM users WHERE p_agent_name IS NOT NULL
      AND (full_name_en = p_agent_name OR full_name_ar = p_agent_name) LIMIT 1
  )
  SELECT jsonb_build_object(
    'overdue',  count(*) FILTER (WHERE next_due <  p_today_start),
    'today',    count(*) FILTER (WHERE next_due >= p_today_start AND next_due < p_tomorrow_start),
    'upcoming', count(*) FILTER (WHERE next_due >= p_tomorrow_start)
  )
  FROM (
    SELECT t.contact_id, min(t.due_date) AS next_due
    FROM tasks t JOIN contacts c ON c.id = t.contact_id
    WHERE t.status = 'pending' AND t.contact_id IS NOT NULL
      AND (p_lead_category IS NULL OR c.lead_category = p_lead_category)
      AND (p_agent_name    IS NULL OR c.assigned_to IN (SELECT id FROM ag))
      AND (p_agent_ids     IS NULL OR c.assigned_to = ANY(p_agent_ids))
    GROUP BY t.contact_id
  ) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_followup_counts(timestamptz, timestamptz, text, text, uuid[]) TO authenticated;

-- ── get_contact_stats ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_contact_stats(text, uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.get_contact_stats(
  p_dept text DEFAULT NULL, p_agent_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL, p_temperature text DEFAULT NULL,
  p_lead_category text DEFAULT NULL, p_agent_ids uuid[] DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE AS $function$
  WITH base AS (
    SELECT contact_status, temperature, contact_type, is_blacklisted, assigned_to
    FROM public.contacts
    WHERE is_deleted = false
      AND (p_dept          IS NULL OR department    = p_dept)
      AND (p_agent_id      IS NULL OR assigned_to    = p_agent_id)
      AND (p_lead_category IS NULL OR lead_category  = p_lead_category)
      AND (p_agent_ids     IS NULL OR assigned_to = ANY(p_agent_ids))
  ),
  fully_filtered AS (
    SELECT * FROM base WHERE (p_status IS NULL OR contact_status = p_status) AND (p_temperature IS NULL OR temperature = p_temperature)
  ),
  for_status_chips AS (SELECT * FROM base WHERE (p_temperature IS NULL OR temperature = p_temperature)),
  for_temp_chips   AS (SELECT * FROM base WHERE (p_status IS NULL OR contact_status = p_status))
  SELECT jsonb_build_object(
    'total',       (SELECT COUNT(*) FROM fully_filtered),
    'blacklisted', (SELECT COUNT(*) FROM fully_filtered WHERE is_blacklisted = true),
    'unassigned',  (SELECT COUNT(*) FROM fully_filtered WHERE assigned_to IS NULL),
    'status', (SELECT jsonb_object_agg(s, c) FROM (SELECT contact_status AS s, COUNT(*) AS c FROM for_status_chips WHERE contact_status IS NOT NULL GROUP BY contact_status) sx),
    'temperature', (SELECT jsonb_object_agg(t, c) FROM (SELECT temperature AS t, COUNT(*) AS c FROM for_temp_chips WHERE temperature IS NOT NULL GROUP BY temperature) tx),
    'type', (SELECT jsonb_object_agg(ty, c) FROM (SELECT contact_type AS ty, COUNT(*) AS c FROM fully_filtered WHERE contact_type IS NOT NULL GROUP BY contact_type) txx)
  );
$function$;
GRANT EXECUTE ON FUNCTION public.get_contact_stats(text, uuid, text, text, text, uuid[]) TO authenticated;
