-- ─────────────────────────────────────────────────────────────────────────────
-- 004 — DROP unused per-agent jsonb columns
--
-- Phase 2 cleanup. After Phase 1 migrated every contact to single-assignment,
-- the per-agent jsonb maps (agent_statuses, agent_temperatures, agent_scores)
-- carry the same value as the global contact_status / temperature / lead_score
-- for the sole assignee. The frontend stopped reading and writing them in
-- Phase 2; this migration removes the columns from the schema.
--
-- BEFORE running this script:
--   1. Deploy the Phase 2 frontend so no client is still writing the columns.
--   2. Confirm no edge functions / triggers / views / policies reference them.
--
-- AFTER running this script:
--   - PostgREST exposes a smaller row payload — fewer bytes per /contacts read.
--   - jsonb GIN indexes (if any) on these columns are dropped automatically.
--
-- Rollback: the columns can be re-added (defaulting to '{}'::jsonb) but the
-- per-agent data they previously held is gone. Re-deriving it from
-- contact_status / temperature / lead_score is the intended reverse path.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Sanity check — surface index/policy references before the DROP fails halfway
DO $$
DECLARE
  ref_count int;
BEGIN
  SELECT COUNT(*) INTO ref_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'contacts'
    AND (qual ILIKE '%agent_statuses%'
      OR qual ILIKE '%agent_temperatures%'
      OR qual ILIKE '%agent_scores%'
      OR with_check ILIKE '%agent_statuses%'
      OR with_check ILIKE '%agent_temperatures%'
      OR with_check ILIKE '%agent_scores%');
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'RLS policy on contacts still references one of the jsonb agent columns. Update the policy first, then re-run.';
  END IF;
END $$;

ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS agent_statuses,
  DROP COLUMN IF EXISTS agent_temperatures,
  DROP COLUMN IF EXISTS agent_scores;

COMMIT;
