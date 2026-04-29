-- ════════════════════════════════════════════════════════════════
-- Migration 003: Single-RPC stats aggregation for ContactsPage
-- Replaces 23 parallel COUNT queries with one grouped aggregate.
-- Caller: ContactsPage.loadStats()
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_contact_stats(
  p_dept text DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER  -- run as caller so RLS applies (admin sees all, manager sees team)
AS $$
  WITH filtered AS (
    SELECT
      contact_status,
      temperature,
      contact_type,
      is_blacklisted,
      assigned_to,
      assigned_to_name
    FROM public.contacts
    WHERE is_deleted = false
      AND (p_dept IS NULL OR department = p_dept)
      AND (p_agent_id IS NULL OR assigned_to = p_agent_id)
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'blacklisted', COUNT(*) FILTER (WHERE is_blacklisted = true),
    'unassigned', COUNT(*) FILTER (WHERE assigned_to IS NULL),
    'status', (
      SELECT jsonb_object_agg(s, c)
      FROM (
        SELECT contact_status AS s, COUNT(*) AS c
        FROM filtered WHERE contact_status IS NOT NULL
        GROUP BY contact_status
      ) sx
    ),
    'temperature', (
      SELECT jsonb_object_agg(t, c)
      FROM (
        SELECT temperature AS t, COUNT(*) AS c
        FROM filtered WHERE temperature IS NOT NULL
        GROUP BY temperature
      ) tx
    ),
    'type', (
      SELECT jsonb_object_agg(ty, c)
      FROM (
        SELECT contact_type AS ty, COUNT(*) AS c
        FROM filtered WHERE contact_type IS NOT NULL
        GROUP BY contact_type
      ) txx
    )
  ) FROM filtered;
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_stats(text, uuid) TO authenticated;

-- Smoke test (admin-style): should return jsonb with counts
-- SELECT public.get_contact_stats(NULL, NULL);
-- SELECT public.get_contact_stats('sales', NULL);
