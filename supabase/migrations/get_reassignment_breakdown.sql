-- Per-agent lead-distribution (reassignment) breakdown for the Reports
-- "Distribution" tab. Aggregates SERVER-SIDE so the client never scans the
-- (large) activities table under RLS — a broad reassignment scan under the
-- row-level policy times out with a 500. SECURITY DEFINER + an explicit role
-- scope replicate the visibility rules instead:
--   admin / operations / sales_director → everyone
--   sales_manager / team_leader          → their team (+ child teams) + self
--   anyone else (agent)                  → just themselves
--
-- Returns: {
--   rows:        [ {agent_id, agent_name, received, given}, ... ]  (received desc)
--   total_moves: <int>                     -- reassignment rows in scope + range
--   top_actor:   {name, count} | null      -- who performed the most moves
-- }
CREATE OR REPLACE FUNCTION public.get_reassignment_breakdown(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_role    text;
  v_team    uuid;
  v_allowed uuid[];   -- NULL = no restriction (see everyone)
  v_result  jsonb;
BEGIN
  SELECT role, team_id INTO v_role, v_team FROM users WHERE id = v_uid;

  IF v_role IN ('admin','operations','sales_director') THEN
    v_allowed := NULL;
  ELSIF v_role IN ('sales_manager','team_leader') THEN
    SELECT array_agg(id) INTO v_allowed FROM users
      WHERE team_id = v_team
         OR team_id IN (SELECT id FROM departments WHERE parent_id = v_team);
    v_allowed := COALESCE(v_allowed, ARRAY[]::uuid[]) || v_uid;
  ELSE
    v_allowed := ARRAY[v_uid];
  END IF;

  WITH base AS (
    SELECT user_id, from_user_id, to_user_id
    FROM activities
    WHERE type = 'reassignment'
      AND created_at >= p_from AND created_at < p_to
      AND (v_allowed IS NULL
           OR to_user_id   = ANY(v_allowed)
           OR from_user_id = ANY(v_allowed))
  ),
  rec AS (SELECT to_user_id   AS uid, count(*) c FROM base WHERE to_user_id   IS NOT NULL GROUP BY to_user_id),
  giv AS (SELECT from_user_id AS uid, count(*) c FROM base WHERE from_user_id IS NOT NULL GROUP BY from_user_id),
  agg AS (
    SELECT COALESCE(rec.uid, giv.uid) AS uid,
           COALESCE(rec.c, 0) AS received,
           COALESCE(giv.c, 0) AS given
    FROM rec FULL OUTER JOIN giv ON rec.uid = giv.uid
    WHERE v_allowed IS NULL OR COALESCE(rec.uid, giv.uid) = ANY(v_allowed)
  ),
  rows AS (
    SELECT jsonb_agg(jsonb_build_object(
             'agent_id',   a.uid,
             'agent_name', COALESCE(u.full_name_en, u.full_name_ar, '—'),
             'received',   a.received,
             'given',      a.given
           ) ORDER BY a.received DESC, a.given DESC) AS j
    FROM agg a LEFT JOIN users u ON u.id = a.uid
  ),
  tot AS (SELECT count(*) c FROM base),
  actor AS (
    SELECT user_id, count(*) c FROM base
    WHERE user_id IS NOT NULL
    GROUP BY user_id ORDER BY count(*) DESC LIMIT 1
  ),
  top AS (
    SELECT jsonb_build_object(
             'name',  COALESCE(u.full_name_en, u.full_name_ar, '—'),
             'count', a.c
           ) AS j
    FROM actor a LEFT JOIN users u ON u.id = a.user_id
  )
  SELECT jsonb_build_object(
           'rows',        COALESCE((SELECT j FROM rows), '[]'::jsonb),
           'total_moves', (SELECT c FROM tot),
           'top_actor',   (SELECT j FROM top)
         )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reassignment_breakdown(timestamptz, timestamptz) TO authenticated;
