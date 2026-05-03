-- ─────────────────────────────────────────────────────────────────────────
-- Migration 009: Sync contact_status to has_opportunity for contacts
-- with at least one OPEN opportunity
--
-- Sister migration to 008. After 008 backfilled placeholder opportunities
-- for the 410 contacts whose status said has_opportunity but had no opp,
-- we noticed the inverse drift too:
--
--   1110 contacts had at least one opportunity
--    878 contacts had status = 'has_opportunity'
--   ~232 contacts had a real opportunity but their status was still
--        'new' / 'contacted' / 'following' (the sales agent created the
--        opp but never flipped the status)
--
-- This migration sets status = 'has_opportunity' for any contact that
-- has at least one OPEN opp (stage NOT IN closed_won / closed_lost),
-- skipping:
--   - disqualified contacts (final state, intentional)
--   - blacklisted contacts (intentional)
--   - soft-deleted contacts
--
-- Idempotent: re-running is a no-op once the drift is cleared.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(DISTINCT c.id) INTO n
  FROM public.contacts c
  WHERE COALESCE(c.is_deleted, false) = false
    AND COALESCE(c.is_blacklisted, false) = false
    AND c.contact_status IS DISTINCT FROM 'has_opportunity'
    AND c.contact_status IS DISTINCT FROM 'disqualified'
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.contact_id = c.id
        AND o.stage NOT IN ('closed_won', 'closed_lost')
    );
  RAISE NOTICE 'Will update % contacts', n;
END $$;

UPDATE public.contacts c
SET contact_status = 'has_opportunity',
    updated_at = now()
WHERE COALESCE(c.is_deleted, false) = false
  AND COALESCE(c.is_blacklisted, false) = false
  AND c.contact_status IS DISTINCT FROM 'has_opportunity'
  AND c.contact_status IS DISTINCT FROM 'disqualified'
  AND EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.contact_id = c.id
      AND o.stage NOT IN ('closed_won', 'closed_lost')
  );

DO $$
DECLARE
  with_opp int;
  status_opp int;
  leftover int;
BEGIN
  SELECT COUNT(*) INTO with_opp FROM public.contacts c
  WHERE COALESCE(c.is_deleted, false) = false
    AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = c.id);

  SELECT COUNT(*) INTO status_opp FROM public.contacts
  WHERE contact_status = 'has_opportunity'
    AND COALESCE(is_deleted, false) = false;

  SELECT COUNT(*) INTO leftover FROM public.contacts c
  WHERE COALESCE(c.is_deleted, false) = false
    AND COALESCE(c.is_blacklisted, false) = false
    AND c.contact_status NOT IN ('has_opportunity', 'disqualified')
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.contact_id = c.id
        AND o.stage NOT IN ('closed_won', 'closed_lost')
    );

  RAISE NOTICE 'contacts_with_any_opp = %', with_opp;
  RAISE NOTICE 'contacts_with_status_has_opportunity = %', status_opp;
  RAISE NOTICE 'leftover_open_opp_other_status = %', leftover;
END $$;

COMMIT;
