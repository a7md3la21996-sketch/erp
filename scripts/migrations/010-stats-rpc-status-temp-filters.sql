-- ════════════════════════════════════════════════════════════════
-- Migration 010: Add p_status + p_temperature to get_contact_stats
--
-- Before: temperature counts ignored the active status filter, so
-- when the user picked status='following' the temp chips still
-- counted across the entire DB. Same for the inverse.
--
-- After:
--   - status chip counts ignore p_status (need to show count for each
--     option so user can switch) but DO honor p_temperature/p_dept/agent
--   - temperature chip counts ignore p_temperature but honor everything
--     else (including p_status)
--   - type chip counts honor everything (no chip group for type
--     conflicts with this)
--   - total / blacklisted / unassigned honor ALL filters (the headline
--     numbers should reflect what the user is currently looking at)
--
-- Idempotent: CREATE OR REPLACE.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_contact_stats(
  p_dept text DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_temperature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH base AS (
    SELECT
      contact_status,
      temperature,
      contact_type,
      is_blacklisted,
      assigned_to
    FROM public.contacts
    WHERE is_deleted = false
      AND (p_dept     IS NULL OR department  = p_dept)
      AND (p_agent_id IS NULL OR assigned_to = p_agent_id)
  ),
  fully_filtered AS (
    SELECT * FROM base
    WHERE (p_status      IS NULL OR contact_status = p_status)
      AND (p_temperature IS NULL OR temperature    = p_temperature)
  ),
  for_status_chips AS (
    -- For status chip counts: apply temp filter but NOT the status filter
    SELECT * FROM base
    WHERE (p_temperature IS NULL OR temperature = p_temperature)
  ),
  for_temp_chips AS (
    -- For temperature chip counts: apply status filter but NOT the temp filter
    SELECT * FROM base
    WHERE (p_status IS NULL OR contact_status = p_status)
  )
  SELECT jsonb_build_object(
    'total',       (SELECT COUNT(*) FROM fully_filtered),
    'blacklisted', (SELECT COUNT(*) FROM fully_filtered WHERE is_blacklisted = true),
    'unassigned',  (SELECT COUNT(*) FROM fully_filtered WHERE assigned_to IS NULL),
    'status', (
      SELECT jsonb_object_agg(s, c)
      FROM (
        SELECT contact_status AS s, COUNT(*) AS c
        FROM for_status_chips WHERE contact_status IS NOT NULL
        GROUP BY contact_status
      ) sx
    ),
    'temperature', (
      SELECT jsonb_object_agg(t, c)
      FROM (
        SELECT temperature AS t, COUNT(*) AS c
        FROM for_temp_chips WHERE temperature IS NOT NULL
        GROUP BY temperature
      ) tx
    ),
    'type', (
      SELECT jsonb_object_agg(ty, c)
      FROM (
        SELECT contact_type AS ty, COUNT(*) AS c
        FROM fully_filtered WHERE contact_type IS NOT NULL
        GROUP BY contact_type
      ) txx
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_stats(text, uuid, text, text) TO authenticated;

-- Smoke tests
-- SELECT public.get_contact_stats(NULL, NULL, NULL, NULL);
-- SELECT public.get_contact_stats(NULL, NULL, 'following', NULL);
-- SELECT public.get_contact_stats(NULL, NULL, NULL, 'hot');
-- SELECT public.get_contact_stats('sales', NULL, 'following', 'hot');
