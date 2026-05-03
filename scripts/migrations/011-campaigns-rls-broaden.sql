-- ════════════════════════════════════════════════════════════════
-- Migration 011: Broaden RLS on public.campaigns
--
-- Problem:
--   Original policies (campaigns_select, campaigns_write) gated
--   everything on is_marketing(), so non-marketing users (operations,
--   sales agents, sales_manager, etc.) couldn't see or create
--   campaigns. When operations tried to add a new campaign inline
--   from the lead form, the INSERT failed silently (the service
--   swallowed the error and returned a local-only object), so the
--   campaign appeared in the session dropdown but vanished on reload.
--
-- Fix:
--   Split the broad campaigns_write policy into per-command policies
--   and let any authenticated user SELECT + INSERT campaigns. UPDATE
--   and DELETE remain gated on is_marketing() since editing/deleting
--   an existing campaign affects everyone's reporting.
--
-- Run once on Supabase. Already ran on production May 3, 2026.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- Replace the original broad policies
DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
DROP POLICY IF EXISTS campaigns_write  ON public.campaigns;

CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY campaigns_insert ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY campaigns_update ON public.campaigns
  FOR UPDATE TO authenticated
  USING (is_marketing())
  WITH CHECK (is_marketing());

CREATE POLICY campaigns_delete ON public.campaigns
  FOR DELETE TO authenticated
  USING (is_marketing());

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verify (should return 4 rows: select / insert / update / delete)
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
-- FROM pg_policy WHERE polrelid = 'public.campaigns'::regclass ORDER BY polname;
