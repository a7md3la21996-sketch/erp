-- Backfill agent_statuses / agent_temperatures / agent_scores from the legacy
-- global fields, so the per-agent-first UI never renders an "empty" per-agent
-- state for contacts that existed before we started writing per-agent.
--
-- For every assigned agent on a contact:
--   - If agent_statuses[agent]       is missing → set to contact_status
--   - If agent_temperatures[agent]   is missing → set to temperature
--   - If agent_scores[agent]         is missing → set to lead_score
--
-- Idempotent: the jsonb_set with 'false' (do-nothing-if-present) semantics
-- means re-running only fills new gaps.

WITH expanded AS (
  SELECT
    c.id,
    name_elem AS agent_name
  FROM contacts c
  CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(c.assigned_to_names, to_jsonb(ARRAY[c.assigned_to_name]::text[]))
  ) AS name_elem
  WHERE c.assigned_to_names IS NOT NULL
     OR c.assigned_to_name  IS NOT NULL
),
patched AS (
  SELECT
    c.id,
    -- For each agent, insert into agent_statuses only if absent.
    (
      SELECT COALESCE(
               jsonb_object_agg(agent_name,
                 COALESCE(c.agent_statuses->>agent_name, c.contact_status, 'new')),
               '{}'::jsonb
             )
        || COALESCE(c.agent_statuses, '{}'::jsonb)
      FROM (SELECT DISTINCT agent_name FROM expanded e WHERE e.id = c.id) a
    ) AS new_statuses,
    (
      SELECT COALESCE(
               jsonb_object_agg(agent_name,
                 COALESCE(c.agent_temperatures->>agent_name, c.temperature, 'warm')),
               '{}'::jsonb
             )
        || COALESCE(c.agent_temperatures, '{}'::jsonb)
      FROM (SELECT DISTINCT agent_name FROM expanded e WHERE e.id = c.id) a
    ) AS new_temps,
    (
      SELECT COALESCE(
               jsonb_object_agg(agent_name,
                 to_jsonb(COALESCE((c.agent_scores->>agent_name)::numeric,
                                   c.lead_score, 0))),
               '{}'::jsonb
             )
        || COALESCE(c.agent_scores, '{}'::jsonb)
      FROM (SELECT DISTINCT agent_name FROM expanded e WHERE e.id = c.id) a
    ) AS new_scores
  FROM contacts c
  WHERE EXISTS (SELECT 1 FROM expanded e WHERE e.id = c.id)
)
UPDATE contacts c
SET agent_statuses      = p.new_statuses,
    agent_temperatures  = p.new_temps,
    agent_scores        = p.new_scores
FROM patched p
WHERE c.id = p.id
  AND (
       COALESCE(c.agent_statuses,     '{}'::jsonb) IS DISTINCT FROM p.new_statuses
    OR COALESCE(c.agent_temperatures, '{}'::jsonb) IS DISTINCT FROM p.new_temps
    OR COALESCE(c.agent_scores,       '{}'::jsonb) IS DISTINCT FROM p.new_scores
  );

-- Sanity check (uncomment to preview):
-- SELECT id, full_name, assigned_to_names, agent_statuses, agent_temperatures, agent_scores
-- FROM contacts
-- WHERE assigned_to_names IS NOT NULL
-- ORDER BY updated_at DESC
-- LIMIT 10;
