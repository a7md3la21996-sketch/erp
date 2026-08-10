-- Per-category lead counts for the Leads-page filter chips.
--
-- SECURITY INVOKER so the existing contacts RLS (contacts_select) scopes the
-- counts like the page list (sales_agent = own, manager = team, admin = all).
--
-- FILTER-AWARE: honours the same filters the table list / other chips honour so
-- every chip stays consistent:
--   p_dept / p_agent_name  — the Global Filter (agent resolved to uuid here).
--   p_status / p_temperature — selecting a status/temperature chip narrows the
--                              category counts too (the reverse direction).
--
-- DYNAMIC: groups by whatever lead_category values exist (jsonb_object_agg) so a
-- custom category added in System Config is counted with no hardcoded key list.

DROP FUNCTION IF EXISTS public.get_lead_category_counts();
DROP FUNCTION IF EXISTS public.get_lead_category_counts(text, text);

CREATE OR REPLACE FUNCTION public.get_lead_category_counts(
  p_dept        text DEFAULT NULL,
  p_agent_name  text DEFAULT NULL,
  p_status      text DEFAULT NULL,
  p_temperature text DEFAULT NULL
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
  ),
  filtered AS (
    SELECT COALESCE(lead_category, '(none)') AS cat
    FROM contacts
    WHERE is_deleted IS NOT TRUE
      AND (p_dept        IS NULL OR department     = p_dept)
      AND (p_status      IS NULL OR contact_status = p_status)
      AND (p_temperature IS NULL OR temperature    = p_temperature)
      AND (p_agent_name  IS NULL OR assigned_to IN (SELECT id FROM ag))
  )
  SELECT COALESCE(jsonb_object_agg(cat, n), '{}'::jsonb)
         || jsonb_build_object('total', COALESCE(SUM(n), 0))
  FROM (SELECT cat, COUNT(*) AS n FROM filtered GROUP BY cat) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_lead_category_counts(text, text, text, text) TO authenticated;
