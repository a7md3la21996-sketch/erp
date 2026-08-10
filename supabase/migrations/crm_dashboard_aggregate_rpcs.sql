-- CRM dashboard aggregate RPCs — fix the 1000-row PostgREST cap on three
-- manager/admin panels that used to pull raw rows and aggregate client-side.
-- For an org with 200k+ contacts / 200k+ activities the raw fetch silently
-- truncated at 1000, so "Source Performance", the 14-day Activity chart and
-- "Top Performers" showed wrong numbers. Aggregating in the DB removes the cap.
--
-- All three are SECURITY INVOKER so RLS still scopes each caller to their own
-- permitted slice (sales_agent → own, manager/leader → team, admin/ops → all).
-- p_agent_ids further narrows within that (the dashboard scope selector). The
-- client always passes p_agent_ids for a sales_agent (their own id) to mirror
-- the previous explicit self-filter regardless of how activities RLS is set.

-- ── Source Performance: leads + how many have ≥1 deal, per source ────────────
DROP FUNCTION IF EXISTS public.get_source_breakdown(uuid[]);
CREATE OR REPLACE FUNCTION public.get_source_breakdown(p_agent_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH c AS (
    SELECT id, COALESCE(NULLIF(source, ''), 'unknown') AS src
    FROM contacts
    WHERE is_deleted = false
      AND (p_agent_ids IS NULL OR assigned_to = ANY(p_agent_ids))
  ),
  dc AS (
    SELECT DISTINCT contact_id FROM deals
    WHERE contact_id IS NOT NULL
      AND (p_agent_ids IS NULL OR assigned_to = ANY(p_agent_ids))
  ),
  agg AS (
    -- group case-insensitively ("Facebook" == "facebook"); keep a representative
    -- original spelling as the display label.
    SELECT min(c.src) AS source, count(*) AS leads, count(dc.contact_id) AS deals
    FROM c LEFT JOIN dc ON dc.contact_id = c.id
    GROUP BY lower(c.src)
    ORDER BY count(*) DESC
    LIMIT 20
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', source,
    'leads',  leads,
    'deals',  deals,
    'conversion', CASE WHEN leads > 0 THEN round((deals::numeric / leads) * 100, 1) ELSE 0 END
  )), '[]'::jsonb)
  FROM agg;
$$;
GRANT EXECUTE ON FUNCTION public.get_source_breakdown(uuid[]) TO authenticated;

-- ── Activity by day: one bucket per UTC MM-DD since p_since ──────────────────
-- Returns { "MM-DD": count }. UTC to match the previous client-side
-- `created_at.slice(5,10)` bucketing exactly (no day-boundary drift).
DROP FUNCTION IF EXISTS public.get_activity_by_day(timestamptz, uuid[]);
CREATE OR REPLACE FUNCTION public.get_activity_by_day(p_since timestamptz, p_agent_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(d, n), '{}'::jsonb)
  FROM (
    SELECT to_char(created_at AT TIME ZONE 'UTC', 'MM-DD') AS d, count(*) AS n
    FROM activities
    WHERE created_at >= p_since
      AND (p_agent_ids IS NULL OR user_id = ANY(p_agent_ids))
    GROUP BY to_char(created_at AT TIME ZONE 'UTC', 'MM-DD')
  ) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_activity_by_day(timestamptz, uuid[]) TO authenticated;

-- ── Leads created this month, grouped by owner (for Top Performers) ──────────
DROP FUNCTION IF EXISTS public.get_leads_by_user_this_month(timestamptz, uuid[]);
CREATE OR REPLACE FUNCTION public.get_leads_by_user_this_month(p_month_start timestamptz, p_agent_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', assigned_to,
    'name', COALESCE(name, '—'),
    'leads', leads
  )), '[]'::jsonb)
  FROM (
    SELECT assigned_to, max(assigned_to_name) AS name, count(*) AS leads
    FROM contacts
    WHERE is_deleted = false
      AND assigned_to IS NOT NULL
      AND created_at >= p_month_start
      AND (p_agent_ids IS NULL OR assigned_to = ANY(p_agent_ids))
    GROUP BY assigned_to
  ) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_leads_by_user_this_month(timestamptz, uuid[]) TO authenticated;
