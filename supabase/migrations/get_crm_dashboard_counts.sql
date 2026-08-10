-- One-shot CRM dashboard count aggregate — collapses EIGHT separate count
-- queries (total leads, new-this-month, last-month, hot, 3 aging buckets, SLA
-- breach) into a SINGLE round-trip. The dashboard was firing ~25-30 concurrent
-- Supabase requests per load; browsers/Supabase drop the excess with "network
-- connection was lost", which both slowed the page and left loadAll's stats
-- stuck at the first value (so a scoped Total Leads kept showing the company
-- total). One scan with FILTER aggregates is far cheaper than 8 count queries.
--
-- SECURITY INVOKER so RLS scopes each caller (agent → own, manager → team,
-- admin/ops → all). p_agent_ids narrows further (the dashboard scope selector).
-- Date bounds are passed in so they honour the caller's local (Cairo) day,
-- exactly like the previous client-side `new Date(y, m, 1)` computations.
-- "not deleted" = is_deleted IS NOT TRUE (covers both false and NULL), matching
-- the union of the old loaders' predicates.

DROP FUNCTION IF EXISTS public.get_crm_dashboard_counts(timestamptz, timestamptz, timestamptz, timestamptz, uuid[]);
CREATE OR REPLACE FUNCTION public.get_crm_dashboard_counts(
  p_month_start      timestamptz,
  p_last_month_start timestamptz,
  p_d7               timestamptz,
  p_d30              timestamptz,
  p_agent_ids        uuid[] DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'totalLeads',   count(*) FILTER (WHERE is_deleted IS NOT TRUE),
    'newThisMonth', count(*) FILTER (WHERE is_deleted IS NOT TRUE AND created_at >= p_month_start),
    'lastMonth',    count(*) FILTER (WHERE is_deleted IS NOT TRUE AND created_at >= p_last_month_start AND created_at < p_month_start),
    'hotCount',     count(*) FILTER (WHERE is_deleted IS NOT TRUE AND temperature = 'hot'),
    'agingFresh',   count(*) FILTER (WHERE is_deleted IS NOT TRUE AND contact_status <> 'disqualified' AND created_at >= p_d7),
    'agingAging',   count(*) FILTER (WHERE is_deleted IS NOT TRUE AND contact_status <> 'disqualified' AND created_at < p_d7 AND created_at >= p_d30),
    'agingOld',     count(*) FILTER (WHERE is_deleted IS NOT TRUE AND contact_status <> 'disqualified' AND created_at < p_d30),
    'slaBreach',    count(*) FILTER (WHERE is_deleted IS NOT TRUE AND last_activity_at IS NULL)
  )
  FROM contacts
  WHERE (p_agent_ids IS NULL OR assigned_to = ANY(p_agent_ids));
$$;
GRANT EXECUTE ON FUNCTION public.get_crm_dashboard_counts(timestamptz, timestamptz, timestamptz, timestamptz, uuid[]) TO authenticated;
