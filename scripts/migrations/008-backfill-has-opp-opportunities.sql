-- ─────────────────────────────────────────────────────────────────────────
-- Migration 008: Backfill placeholder opportunities for has_opportunity drift
--
-- Problem (May 3, 2026):
--   Leads page reported 878 contacts with status='has_opportunity', but
--   the opportunities table only had real records for 468 of them.
--   Difference: 410 contacts whose status was set (manually by sales,
--   or by an old import) but no actual opportunity row was ever created.
--
--   The two views consequently disagreed on 'how many opportunities do
--   we have?' — leads page counted statuses, opps page counted records.
--
-- Fix:
--   For every contact where contact_status='has_opportunity' AND no
--   opportunity row exists, create a placeholder opportunity at the
--   first stage ('qualification') with the contact's existing
--   assignment / temperature / source / budget. Notes column flags
--   it as auto-created so anyone reviewing knows it didn't come from
--   a real sales action.
--
-- Idempotent: running again is a no-op (the WHERE NOT EXISTS check
-- skips contacts that already have at least one opportunity).
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM public.contacts c
  WHERE c.contact_status = 'has_opportunity'
    AND COALESCE(c.is_deleted, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = c.id);
  RAISE NOTICE 'Will create % opportunities', n;
END $$;

INSERT INTO public.opportunities (
  contact_id,
  contact_name,
  title,
  assigned_to,
  assigned_to_name,
  stage,
  temperature,
  priority,
  budget,
  source,
  dept,
  created_by,
  created_by_name,
  created_at,
  notes
)
SELECT
  c.id,
  c.full_name,
  c.full_name,
  c.assigned_to,
  c.assigned_to_name,
  'qualification',
  COALESCE(c.temperature, 'warm'),
  'medium',
  COALESCE(c.budget_min, 0),
  COALESCE(c.source, 'manual'),
  COALESCE(c.department, 'sales'),
  c.assigned_to,
  c.assigned_to_name,
  COALESCE(c.assigned_at, c.created_at, now()),
  'Auto-created from has_opportunity status backfill (May 3, 2026)'
FROM public.contacts c
WHERE c.contact_status = 'has_opportunity'
  AND COALESCE(c.is_deleted, false) = false
  AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = c.id);

DO $$
DECLARE leftover int; total_opps int;
BEGIN
  SELECT COUNT(*) INTO leftover FROM public.contacts c
  WHERE c.contact_status = 'has_opportunity'
    AND COALESCE(c.is_deleted, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = c.id);
  IF leftover > 0 THEN RAISE EXCEPTION 'Still % contacts without opportunity', leftover; END IF;

  SELECT COUNT(*) INTO total_opps FROM public.opportunities;
  RAISE NOTICE 'Done. Total opportunities now: %', total_opps;
END $$;

COMMIT;
