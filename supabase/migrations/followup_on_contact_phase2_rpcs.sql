-- ============================================================================
-- Follow-up-on-the-lead, Phase 2 — switch the READS to contacts.next_follow_up_at.
--
-- Rewrites the four follow-up RPCs to read the lead's column instead of joining
-- tasks. Same names + signatures, so NO frontend change is needed — the call
-- sites keep working. All stay SECURITY INVOKER: contacts RLS scopes correctly
-- (admin = all; team_leader = their team INCLUDING inactive members; agent =
-- own). That is exactly why a team leader and an admin filtering the same team
-- now get the SAME number — the old task-table RLS (which hid tasks assigned to
-- departed agents on the team's leads) is no longer in the path.
--
-- ⚠️ APPLY AT GO-LIVE. Applying this file flips production immediately (the live
-- app already calls these names). Old definitions are preserved in git for
-- rollback (get_followup_counts_rpc / get_per_agent_breakdown / etc.).
-- ============================================================================

-- 1) Bucketed counts (CRM dashboard lens + Leads chips)
CREATE OR REPLACE FUNCTION get_followup_counts(
  p_today_start    timestamptz,
  p_tomorrow_start timestamptz,
  p_lead_category  text   DEFAULT NULL,
  p_agent_name     text   DEFAULT NULL,
  p_agent_ids      uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
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
    SELECT c.next_follow_up_at AS next_due
    FROM contacts c
    WHERE c.next_follow_up_at IS NOT NULL
      AND c.is_deleted IS NOT TRUE
      AND c.contact_status <> 'disqualified'   -- dead leads carry no live follow-up
      AND (p_lead_category IS NULL OR c.lead_category = p_lead_category)
      AND (p_agent_name    IS NULL OR c.assigned_to IN (SELECT id FROM ag))
      AND (p_agent_ids     IS NULL OR c.assigned_to = ANY(p_agent_ids))
  ) s;
$$;

-- 2) Contact IDs per bucket (Leads list filter — keeps chip == list)
CREATE OR REPLACE FUNCTION get_followup_contact_ids(
  p_bucket         text,
  p_today_start    timestamptz,
  p_tomorrow_start timestamptz
) RETURNS TABLE(contact_id uuid)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT c.id
  FROM contacts c
  WHERE c.next_follow_up_at IS NOT NULL
    AND c.is_deleted IS NOT TRUE
    AND c.contact_status <> 'disqualified'   -- dead leads carry no live follow-up
    AND CASE p_bucket
      WHEN 'overdue'  THEN c.next_follow_up_at <  p_today_start
      WHEN 'today'    THEN c.next_follow_up_at >= p_today_start AND c.next_follow_up_at < p_tomorrow_start
      WHEN 'upcoming' THEN c.next_follow_up_at >= p_tomorrow_start
      ELSE false
    END;
$$;

-- 3) Per-row next follow-up (Leads table column). pending/overdue collapse to
--    0/1 now that a lead carries a single next follow-up.
CREATE OR REPLACE FUNCTION get_next_followup_per_contact(p_contact_ids uuid[])
RETURNS TABLE(contact_id uuid, next_due timestamptz, overdue_count bigint, pending_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.next_follow_up_at,
    (CASE WHEN c.next_follow_up_at <  now() THEN 1 ELSE 0 END)::bigint,
    (CASE WHEN c.next_follow_up_at IS NOT NULL THEN 1 ELSE 0 END)::bigint
  FROM contacts c
  WHERE c.id = ANY(p_contact_ids)
    AND c.next_follow_up_at IS NOT NULL;
$$;

-- 4) Per-agent breakdown report (overdue/today/upcoming columns)
CREATE OR REPLACE FUNCTION get_per_agent_breakdown(
  p_today_start    timestamptz,
  p_tomorrow_start timestamptz
) RETURNS TABLE(
  agent_id uuid, agent_name text, total_leads bigint, fresh bigint, untouched_fresh bigint,
  rotation bigint, distributed bigint, cold_calls bigint, s_new bigint, s_contacted bigint,
  s_following bigint, s_has_opportunity bigint, s_disqualified bigint,
  overdue bigint, today bigint, upcoming bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.assigned_to                                                                 AS agent_id,
    max(c.assigned_to_name)                                                        AS agent_name,
    count(*)                                                                       AS total_leads,
    count(*) FILTER (WHERE c.lead_category = 'fresh')                              AS fresh,
    count(*) FILTER (WHERE c.lead_category = 'fresh' AND c.contact_status = 'new') AS untouched_fresh,
    count(*) FILTER (WHERE c.lead_category = 'rotation')                           AS rotation,
    count(*) FILTER (WHERE c.lead_category = 'distributed')                        AS distributed,
    count(*) FILTER (WHERE c.lead_category = 'cold_calls')                         AS cold_calls,
    count(*) FILTER (WHERE c.contact_status = 'new')                               AS s_new,
    count(*) FILTER (WHERE c.contact_status = 'contacted')                         AS s_contacted,
    count(*) FILTER (WHERE c.contact_status = 'following')                         AS s_following,
    count(*) FILTER (WHERE c.contact_status = 'has_opportunity')                   AS s_has_opportunity,
    count(*) FILTER (WHERE c.contact_status = 'disqualified')                      AS s_disqualified,
    count(*) FILTER (WHERE c.next_follow_up_at <  p_today_start)                                          AS overdue,
    count(*) FILTER (WHERE c.next_follow_up_at >= p_today_start AND c.next_follow_up_at < p_tomorrow_start) AS today,
    count(*) FILTER (WHERE c.next_follow_up_at >= p_tomorrow_start)                                       AS upcoming
  FROM contacts c
  WHERE c.assigned_to IS NOT NULL
    AND coalesce(c.is_deleted, false) = false
  GROUP BY c.assigned_to
  ORDER BY count(*) DESC;
$$;
